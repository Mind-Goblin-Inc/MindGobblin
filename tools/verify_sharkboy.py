#!/usr/bin/env python3
"""Verify the reviewed SharkBoy browser bundle before packaging or deployment."""
import argparse
import hashlib
import json
from pathlib import Path
import re

REQUIRED = {'index.html', 'style.css', 'launcher.js', 'sharkboy.js', 'sharkboy.wasm'}


def verify(directory):
    directory = Path(directory)
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError('Bundle must be a real directory')
    if any(p.is_symlink() or (not p.is_file() and not p.is_dir()) for p in directory.rglob('*')):
        raise ValueError('Unsupported bundle entry')
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest.get('format_version') != 1 or manifest.get('emscripten_version') != '4.0.23':
        raise ValueError('Unsupported bundle/toolchain version')
    if not re.fullmatch('[0-9a-f]{40}', manifest.get('arcade_revision', '')) or type(manifest.get('arcade_dirty')) is not bool:
        raise ValueError('Missing source provenance')
    sources = manifest.get('source_files', {})
    if not sources or hashlib.sha256(json.dumps(sources, sort_keys=True, separators=(',', ':')).encode()).hexdigest() != manifest.get('source_sha256'):
        raise ValueError('Invalid source fingerprint')
    files = manifest.get('files', {})
    if set(files) != REQUIRED:
        raise ValueError('Unexpected or missing public files')
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file()}
    if actual != REQUIRED | {'manifest.json'}:
        raise ValueError('Unlisted bundle files')
    for name, expected in files.items():
        path = directory / name
        if not re.fullmatch('[0-9a-f]{64}', expected) or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f'Checksum mismatch: {name}')
        if path.stat().st_size > 32 * 1024 * 1024:
            raise ValueError(f'File too large: {name}')
    if (directory / 'sharkboy.wasm').read_bytes()[:8] != b'\0asm\x01\0\0\0':
        raise ValueError('Invalid WebAssembly file')
    return manifest


def verify_sources(manifest):
    root = Path(__file__).resolve().parents[1]
    source = root / 'tools/sharkboy'
    inputs = {p.relative_to(source).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in source.rglob('*') if p.is_file()}
    inputs['build_sharkboy.py'] = hashlib.sha256((root / 'tools/build_sharkboy.py').read_bytes()).hexdigest()
    if inputs != manifest['source_files']:
        raise ValueError('Browser bundle is stale; rebuild after changing its source files')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', nargs='?', type=Path, default=Path(__file__).resolve().parents[1] / 'wwwroot/SharkBoyEmulator')
    args = parser.parse_args()
    try:
        result = verify(args.directory)
        verify_sources(result)
    except (ValueError, OSError, KeyError, TypeError) as error:
        raise SystemExit(f'SharkBoy validation failed: {error}')
    print(f"SharkBoy Emulator: {len(result['files'])} verified files; Emscripten {result['emscripten_version']}")
