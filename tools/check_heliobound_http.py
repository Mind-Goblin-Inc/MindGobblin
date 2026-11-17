#!/usr/bin/env python3
"""Check the served game bytes, MIME types, route policy, and homepage link."""
import argparse
import hashlib
from http.client import IncompleteRead
import json
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, build_opener, urlopen


def check_redirects(base):
    class KeepRedirect(HTTPRedirectHandler):
        def redirect_request(self, request, response, code, message, headers, target):
            return None

    opener = build_opener(KeepRedirect())
    paths = (
        ('/heliobound', '/helioengine/'),
        ('/heliobound/', '/helioengine/'),
        ('/heliobound?mode=maze&return=%2Fgames%2F', '/helioengine/?mode=maze&return=%2Fgames%2F'),
        ('/heliobound/manifest.json', '/helioengine/manifest.json'),
        ('/heliobound/pkg/heliobound_bg.wasm?download=1', '/helioengine/pkg/heliobound_bg.wasm?download=1'),
    )
    for old, new in paths:
        try:
            response = opener.open(base + old, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            assert response.status == 308, (old, response.status)
            assert response.headers.get('Location') == new, (old, response.headers)


def check(base, require_policy=True):
    base = base.rstrip('/')
    with urlopen(base + '/helioengine/manifest.json', timeout=10) as response:
        manifest = json.load(response)
    mime = {'.js': ('application/javascript', 'text/javascript'), '.wasm': ('application/wasm',),
            '.html': ('text/html',), '.css': ('text/css',), '.png': ('image/png',)}
    for name, checksum in manifest['files'].items():
        with urlopen(base + '/helioengine/' + name, timeout=10) as response:
            assert response.status == 200, name
            assert hashlib.sha256(response.read()).hexdigest() == checksum, name
            assert response.headers.get_content_type() in mime[Path(name).suffix], (name, response.headers)
            if require_policy:
                assert "'wasm-unsafe-eval'" in response.headers.get('Content-Security-Policy', ''), name
                assert response.headers.get('X-Content-Type-Options') == 'nosniff', name
                assert not response.headers.get('Cross-Origin-Embedder-Policy'), name
    with urlopen(base + '/helioengine/', timeout=10) as response:
        assert b'HelioEngine' in response.read()
    with urlopen(base + '/helioengine', timeout=10) as response:
        assert response.geturl() == base + '/helioengine/'
    if require_policy:
        check_redirects(base)
    with urlopen(base + '/', timeout=10) as response:
        home = response.read()
        assert b'href="helioengine/" data-project' in home
        assert b'>58 games &amp; projects<' in home and b'>13 games<' in home
        assert b'id="GameEngine"' in home and b'>12 projects<' in home
        if require_policy:
            assert not response.headers.get('Content-Security-Policy'), 'Game policy leaked to homepage'
    print(f'HTTP checks passed: {len(manifest["files"])} files, checksums, MIME types, game route, legacy redirects, and homepage')


def check_with_retry(base, require_policy=True, attempts=30, retry_delay=1):
    for attempt in range(attempts):
        try:
            check(base, require_policy)
            return
        except (URLError, ConnectionError, TimeoutError, IncompleteRead):
            # A published Docker port may reset an accepted connection before
            # Kestrel finishes starting. urllib does not wrap every reset in URLError.
            if attempt == attempts - 1: raise
            time.sleep(retry_delay)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('base', nargs='?', default='http://127.0.0.1:8080')
    parser.add_argument('--static-preview', action='store_true', help='Skip .NET-specific response header checks')
    args = parser.parse_args()
    check_with_retry(args.base, not args.static_preview)


if __name__ == '__main__':
    main()
