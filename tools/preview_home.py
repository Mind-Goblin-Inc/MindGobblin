#!/usr/bin/env python3
"""Loopback-only homepage preview with temporary demo accounts; no production access."""

import argparse
from datetime import datetime, timezone
from functools import partial
import hashlib
import hmac
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import threading
import time
from urllib.parse import parse_qs, urlsplit


ROOT = Path(__file__).resolve().parents[1] / "wwwroot"
USERS = {}
SESSIONS = {}
TETRIS_SCORES = []
LOCK = threading.RLock()


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if urlsplit(self.path).path.endswith(".br"):
            self.send_header("Content-Encoding", "br")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".wasm.br"):
            return "application/wasm"
        if path.endswith(".js.br"):
            return "application/javascript"
        if path.endswith(".data.br"):
            return "application/octet-stream"
        return super().guess_type(path)

    def reply(self, payload, status=HTTPStatus.OK, cookie=None):
        encoded = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(encoded)

    def session(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except CookieError:
            return None, None
        token = cookie.get("mg_preview")
        token = token.value if token else None
        return token, USERS.get(SESSIONS.get(token))

    def do_GET(self):
        path = urlsplit(self.path).path
        with LOCK:
            _, user = self.session()
            if path == "/api/auth/me":
                self.reply({"preview": True, "loggedIn": bool(user), "user": {"username": user["username"]} if user else None})
                return
            if path == "/api/clinkbits/me":
                if not user:
                    self.reply({"error": "Log in first."}, HTTPStatus.UNAUTHORIZED)
                    return
                next_claim = max(time.time(), user["lastClaim"] + 86400)
                self.reply({"balance": user["balance"], "dailyReward": 25,
                            "canClaimNow": time.time() >= user["lastClaim"] + 86400,
                            "nextClaimUtc": datetime.fromtimestamp(next_claim, timezone.utc).isoformat()})
                return
            if path in ("/api/tetrisscores", "/api/tetrisscoreshl"):
                ranked = [dict(score, placement=i + 1) for i, score in enumerate(sorted(TETRIS_SCORES, key=lambda s: -s["points"]))]
                if path.endswith("scoreshl"):
                    player_id = parse_qs(urlsplit(self.path).query).get("playerId", [""])[0]
                    self.reply({"top": ranked[:10], "player": next((s for s in ranked if str(s["id"]) == player_id), None)})
                else:
                    self.reply(ranked[:10])
                return
        if path == "/health":
            self.reply({"ok": True, "preview": True})
        elif path.startswith(("/api/", "/cr/")):
            self.reply({"error": "This game’s backend is not included in the local homepage preview."}, HTTPStatus.SERVICE_UNAVAILABLE)
        else:
            super().do_GET()

    def do_POST(self):
        # Demo state is private to this loopback server and is discarded on exit.
        origin = self.headers.get("Origin")
        if origin and origin not in (f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}"):
            self.reply({"error": "Invalid origin."}, HTTPStatus.FORBIDDEN)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 8192:
                raise ValueError()
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError()
        except (ValueError, json.JSONDecodeError):
            self.reply({"error": "Invalid request."}, HTTPStatus.BAD_REQUEST)
            return
        path = urlsplit(self.path).path
        with LOCK:
            token, user = self.session()
            if path in ("/api/auth/login", "/api/auth/register"):
                username, password = data.get("username", ""), data.get("password", "")
                if not isinstance(username, str) or not isinstance(password, str):
                    self.reply({"error": "Invalid credentials."}, HTTPStatus.BAD_REQUEST)
                    return
                username = username.strip()
                key = username.lower()
                if path.endswith("register"):
                    if not 3 <= len(username) <= 32 or not all(c.isalnum() or c in "_.-" for c in username):
                        self.reply({"error": "Choose a username of 3–32 letters, numbers, dots, dashes, or underscores."}, HTTPStatus.BAD_REQUEST)
                        return
                    if not 8 <= len(password) <= 128 or not password.strip():
                        self.reply({"error": "Use a password of 8–128 characters."}, HTTPStatus.BAD_REQUEST)
                        return
                    if key in USERS:
                        self.reply({"error": "That demo username is already taken."}, HTTPStatus.CONFLICT)
                        return
                    salt = secrets.token_bytes(16)
                    USERS[key] = {"username": username, "salt": salt,
                                  "hash": hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120000),
                                  "balance": 0, "lastClaim": 0}
                candidate = USERS.get(key)
                if not candidate or not hmac.compare_digest(candidate["hash"], hashlib.pbkdf2_hmac("sha256", password.encode(), candidate["salt"], 120000)):
                    self.reply({"error": "Invalid username or password."}, HTTPStatus.UNAUTHORIZED)
                    return
                if token:
                    SESSIONS.pop(token, None)
                token = secrets.token_urlsafe(24)
                SESSIONS[token] = key
                self.reply({"ok": True}, cookie=f"mg_preview={token}; Path=/; HttpOnly; SameSite=Strict")
            elif path == "/api/auth/logout":
                SESSIONS.pop(token, None)
                self.reply({"ok": True}, cookie="mg_preview=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0")
            elif path == "/api/clinkbits/claim-daily":
                if not user:
                    self.reply({"error": "Log in first."}, HTTPStatus.UNAUTHORIZED)
                elif time.time() < user["lastClaim"] + 86400:
                    self.reply({"error": "Daily clinkbits already claimed."}, HTTPStatus.BAD_REQUEST)
                else:
                    user["balance"] += 25
                    user["lastClaim"] = time.time()
                    self.reply({"ok": True, "awarded": 25, "balance": user["balance"]})
            elif path == "/api/tetrisscores":
                player, points = data.get("player", ""), data.get("points")
                if (not isinstance(player, str) or not 1 <= len(player) <= 32
                        or not all(c.isalnum() or c in " _.-" for c in player)
                        or type(points) is not int or not 0 <= points <= 2147483647):
                    self.reply({"error": "Enter a player name and a valid score."}, HTTPStatus.BAD_REQUEST)
                    return
                score = {"id": len(TETRIS_SCORES) + 1, "player": player, "points": points,
                         "playedAt": datetime.now(timezone.utc).isoformat()}
                TETRIS_SCORES.append(score)
                self.reply(score, HTTPStatus.CREATED)
            else:
                self.reply({"error": "This action is unavailable in the homepage preview."}, HTTPStatus.SERVICE_UNAVAILABLE)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(PreviewHandler, directory=str(ROOT)))
    print(f"Mind Goblin local demo: http://127.0.0.1:{args.port}", flush=True)
    print("Temporary demo accounts only. Production is never contacted. Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
