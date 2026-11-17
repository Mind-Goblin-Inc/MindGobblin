#!/usr/bin/env python3
"""Check SharkBoy's served artifact, response policy, and homepage integration."""
import argparse
import hashlib
import json
from urllib.request import urlopen


def check(base):
    base = base.rstrip('/')
    with urlopen(base + '/SharkBoyEmulator/manifest.json', timeout=10) as response:
        manifest = json.load(response)
    mime = {'.html': 'text/html', '.js': 'application/javascript',
            '.css': 'text/css', '.wasm': 'application/wasm'}
    for name, checksum in manifest['files'].items():
        with urlopen(base + '/SharkBoyEmulator/' + name, timeout=15) as response:
            assert response.status == 200, name
            assert hashlib.sha256(response.read()).hexdigest() == checksum, name
            assert response.headers.get_content_type() == mime['.' + name.rsplit('.', 1)[1]], name
            policy = response.headers.get('Content-Security-Policy', '')
            assert "'wasm-unsafe-eval'" in policy and "'unsafe-eval'" not in policy, name
            assert response.headers.get('X-Content-Type-Options') == 'nosniff', name
            assert not response.headers.get('Cross-Origin-Embedder-Policy'), name
    with urlopen(base + '/SharkBoyEmulator', timeout=10) as response:
        assert response.url.endswith('/SharkBoyEmulator/'), response.url
        assert b'SharkBoy Emulator' in response.read()
    with urlopen(base + '/', timeout=10) as response:
        home = response.read()
        assert b'href="SharkBoyEmulator/" data-project' in home
        assert b'>58 games &amp; projects<' in home and b'>13 games<' in home
        assert not response.headers.get('Content-Security-Policy'), 'Game policy leaked to home'
    print('SharkBoy HTTP checks passed: bytes, MIME, route policy, canonical path, homepage')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('base', nargs='?', default='http://127.0.0.1:8080')
    check(parser.parse_args().base)
