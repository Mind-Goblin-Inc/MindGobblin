#!/usr/bin/env python3
"""Check the served game bytes, MIME types, route policy, and homepage link."""
import argparse
import hashlib
import json
from pathlib import Path
import time
from urllib.error import URLError
from urllib.request import urlopen


def check(base, require_policy=True):
    base = base.rstrip('/')
    with urlopen(base + '/heliobound/manifest.json', timeout=10) as response:
        manifest = json.load(response)
    mime = {'.js': ('application/javascript', 'text/javascript'), '.wasm': ('application/wasm',),
            '.html': ('text/html',), '.css': ('text/css',), '.png': ('image/png',)}
    for name, checksum in manifest['files'].items():
        with urlopen(base + '/heliobound/' + name, timeout=10) as response:
            assert response.status == 200, name
            assert hashlib.sha256(response.read()).hexdigest() == checksum, name
            assert response.headers.get_content_type() in mime[Path(name).suffix], (name, response.headers)
            if require_policy:
                assert "'wasm-unsafe-eval'" in response.headers.get('Content-Security-Policy', ''), name
                assert response.headers.get('X-Content-Type-Options') == 'nosniff', name
                assert not response.headers.get('Cross-Origin-Embedder-Policy'), name
    with urlopen(base + '/heliobound/', timeout=10) as response:
        assert b'HelioBound' in response.read()
    with urlopen(base + '/', timeout=10) as response:
        home = response.read()
        assert b'href="heliobound/" data-project' in home
        assert b'>33 games &amp; projects<' in home and b'>14 games<' in home
        if require_policy:
            assert not response.headers.get('Content-Security-Policy'), 'Game policy leaked to homepage'
    print(f'HTTP checks passed: {len(manifest["files"])} files, checksums, MIME types, game route, and homepage')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('base', nargs='?', default='http://127.0.0.1:8080')
    parser.add_argument('--static-preview', action='store_true', help='Skip .NET-specific response header checks')
    args = parser.parse_args()
    for attempt in range(30):
        try:
            check(args.base, not args.static_preview)
            return
        except URLError:
            if attempt == 29: raise
            time.sleep(1)


if __name__ == '__main__':
    main()
