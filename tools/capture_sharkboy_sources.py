#!/usr/bin/env python3
"""Deliberately refresh the source snapshot used by the SharkBoy browser build."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

TARGET = Path(__file__).resolve().parent / 'sharkboy'


def capture(arcade, simulator):
    if not (arcade / 'Jakeboy_Arcade.ino').is_file() or not (simulator / 'include/Arduino.h').is_file():
        raise ValueError('Provide the Jakeboy_Arcade and JakeboySimulator source directories')
    files = {}
    paths = [(arcade, 'arcade', [*arcade.glob('*.h'), *arcade.glob('*.ino'), *arcade.glob('MenuPosters/*.h')]),
             (simulator, 'simulator', [p for p in simulator.glob('include/*.h')
                                      if p.name not in ('SimGame.h', 'GameAPI.h', 'Hardware.h')])]
    with tempfile.TemporaryDirectory(prefix='sharkboy-capture-', dir=TARGET.parent) as temp:
        stage = Path(temp)
        for directory, prefix, entries in paths:
            for path in sorted(entries):
                if path.is_symlink() or not path.is_file():
                    raise ValueError(f'Unsupported source entry: {path}')
                relative = Path(prefix) / path.relative_to(directory)
                destination = stage / 'source' / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, destination)
                files[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
        revision = subprocess.check_output(['git', '-C', str(arcade), 'rev-parse', 'HEAD'], text=True).strip()
        dirty = bool(subprocess.check_output(['git', '-C', str(arcade), 'status', '--porcelain'], text=True).strip())
        manifest = {'format_version': 1, 'arcade_revision': revision, 'arcade_dirty': dirty,
                    'simulator_revision': None, 'files': files}
        (stage / 'source-manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
        # Stage first so invalid input cannot erase the previous snapshot.
        if (TARGET / 'source').exists():
            (TARGET / 'source').rename(stage / 'prior')
        try:
            (stage / 'source').rename(TARGET / 'source')
        except OSError:
            if (stage / 'prior').exists():
                (stage / 'prior').rename(TARGET / 'source')
            raise
        shutil.copyfile(stage / 'source-manifest.json', TARGET / 'source-manifest.json')
    print(f'Captured {len(files)} source files. Rebuild and review the browser artifact next.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--arcade', required=True, type=Path)
    parser.add_argument('--simulator', required=True, type=Path)
    args = parser.parse_args()
    try:
        capture(args.arcade.resolve(), args.simulator.resolve())
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'Source capture failed: {error}')
