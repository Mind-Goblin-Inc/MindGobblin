#!/usr/bin/env python3
"""Validate HelioEngine bundle integrity before import or packaging."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re

REQUIRED = {'index.html', 'launcher.js', 'style.css', 'pkg/heliobound.js',
            'pkg/heliobound_bg.wasm', 'pkg/audio.js', 'pkg/runtime.js', 'mind-goblin.png'}


def verify(directory):
    directory = Path(directory)
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError('Bundle must be a real directory')
    for path in directory.rglob('*'):
        if path.is_symlink() or (not path.is_dir() and not path.is_file()):
            raise ValueError(f'Unsupported entry: {path.name}')
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest.get('format_version') != 1:
        raise ValueError('Unsupported manifest version')
    if not re.fullmatch(r'[0-9a-f]{40}', manifest.get('engine_revision', '')):
        raise ValueError('Manifest must pin a full engine commit')
    if type(manifest.get('engine_dirty')) is not bool:
        raise ValueError('Manifest must declare whether the engine was dirty')
    if manifest.get('release_status') not in ('preview', 'release'):
        raise ValueError('Unknown release status')
    if manifest.get('wasm_bindgen_version') != '0.2.127' or manifest.get('rust_version') != '1.98.0':
        raise ValueError('Unexpected browser build tool versions')
    sources = manifest.get('source_files', {})
    if not sources or hashlib.sha256(json.dumps(sources, sort_keys=True, separators=(',', ':')).encode()).hexdigest() != manifest.get('source_sha256'):
        raise ValueError('Source fingerprint is invalid')
    files = manifest.get('files', {})
    if not isinstance(files, dict) or not REQUIRED <= files.keys():
        raise ValueError('Bundle is missing required browser files')
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file()}
    if actual != set(files) | {'manifest.json'}:
        raise ValueError('Unlisted or missing bundle files')
    for name, expected in files.items():
        logical = PurePosixPath(name)
        if logical.is_absolute() or '..' in logical.parts or '\\' in name or str(logical) != name:
            raise ValueError(f'Unsafe bundle path: {name}')
        if logical.suffix not in ('.html', '.js', '.css', '.wasm', '.png'):
            raise ValueError(f'Unexpected public file type: {name}')
        if not re.fullmatch(r'[0-9a-f]{64}', expected):
            raise ValueError(f'Invalid checksum: {name}')
        path = directory / name
        if path.stat().st_size > 64 * 1024 * 1024:
            raise ValueError(f'Bundle file exceeds 64 MiB: {name}')
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f'Checksum mismatch: {name}')
    if (directory / 'pkg/heliobound_bg.wasm').read_bytes()[:8] != b'\0asm\x01\0\0\0':
        raise ValueError('Invalid WebAssembly header')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', nargs='?', type=Path, default=Path(__file__).resolve().parents[1] / 'wwwroot/heliobound')
    args = parser.parse_args()
    try:
        manifest = verify(args.directory)
    except (ValueError, OSError, KeyError, TypeError) as error:
        raise SystemExit(f'HelioEngine validation failed: {error}')
    print(f"HelioEngine {manifest['release_status']}: {len(manifest['files'])} verified files; engine {manifest['engine_revision']}")


if __name__ == '__main__':
    main()
