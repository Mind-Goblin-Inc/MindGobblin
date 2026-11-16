#!/usr/bin/env python3
"""Build the captured Jakeboy sources with pinned Emscripten into a web bundle."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'tools/sharkboy'
VERSION = '4.0.23'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(output, compiler):
    version = subprocess.check_output([compiler, '--version'], text=True).splitlines()[0]
    if (' ' + VERSION + ' ') not in version:
        raise ValueError(f'Use Emscripten {VERSION}; found {version}')
    captured = json.loads((SOURCE / 'source-manifest.json').read_text())
    actual = {p.relative_to(SOURCE / 'source').as_posix(): digest(p)
              for p in (SOURCE / 'source').rglob('*') if p.is_file()}
    if actual != captured['files']:
        raise ValueError('Captured source files differ from source-manifest.json')
    inputs = {p.relative_to(SOURCE).as_posix(): digest(p) for p in SOURCE.rglob('*') if p.is_file()}
    inputs['build_sharkboy.py'] = digest(Path(__file__))
    with tempfile.TemporaryDirectory(prefix='sharkboy-build-') as scratch:
        work = Path(scratch)
        arcade = SOURCE / 'source/arcade'
        tabs = [arcade / 'Jakeboy_Arcade.ino', *sorted(p for p in arcade.glob('*.ino') if p.name != 'Jakeboy_Arcade.ino')]
        (work / 'SimGame.h').write_text('#pragma once\n#define SIM_ARCADE 1\n' +
            ''.join('#include "' + str(p) + '"\n' for p in tabs) +
            '\nnamespace SimGame { inline void enter() { ::setup(); }\n'
            'inline void update(const GameInput &) { ::loop(); } }\n')
        command = [compiler, str(SOURCE / 'runtime.cpp'), '-std=c++17', '-O2',
                   '-I' + str(SOURCE / 'compat'), '-I' + str(SOURCE / 'source/simulator/include'),
                   '-I' + str(arcade), '-I' + str(work), '--use-port=sdl2',
                   '-sASYNCIFY', '-sASYNCIFY_STACK_SIZE=131072', '-sSTACK_SIZE=2097152',
                   '-sINITIAL_MEMORY=33554432', '-sALLOW_MEMORY_GROWTH',
                   '-sMODULARIZE', '-sEXPORT_ES6', '-sEXPORT_NAME=createSharkBoy',
                   '-sENVIRONMENT=web', '-sDYNAMIC_EXECUTION=0',
                   '-sEXPORTED_RUNTIME_METHODS=["callMain","UTF8ToString"]',
                   '-sEXPORTED_FUNCTIONS=["_main"]',
                   '-o', str(work / 'sharkboy.js')]
        subprocess.run(command, check=True)
        bundle = work / 'bundle'
        shutil.copytree(SOURCE / 'page', bundle)
        for name in ('sharkboy.js', 'sharkboy.wasm'):
            shutil.copyfile(work / name, bundle / name)
        manifest = {'format_version': 1, 'emscripten_version': VERSION,
                    'arcade_revision': captured['arcade_revision'], 'arcade_dirty': captured['arcade_dirty'],
                    'source_files': inputs,
                    'source_sha256': hashlib.sha256(json.dumps(inputs, sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
                    'files': {p.relative_to(bundle).as_posix(): digest(p) for p in sorted(bundle.rglob('*')) if p.is_file()}}
        (bundle / 'manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
        from verify_sharkboy import REQUIRED, verify, verify_sources
        verify(bundle)
        verify_sources(manifest)
        if output.exists():
            if output.is_symlink() or not output.is_dir() or any(
                    not p.is_file() or p.is_symlink() or p.name not in REQUIRED | {'manifest.json'}
                    for p in output.iterdir()):
                raise ValueError('Output directory contains files outside the managed browser bundle')
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.' + output.name + '-', dir=output.parent) as stage:
            stage = Path(stage)
            shutil.copytree(bundle, stage / 'new')
            if output.exists():
                output.rename(stage / 'prior')
            try:
                (stage / 'new').rename(output)
            except OSError:
                if (stage / 'prior').exists():
                    (stage / 'prior').rename(output)
                raise
    print(f'SharkBoy Emulator built: {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--emxx', default='em++')
    parser.add_argument('--output', type=Path, default=ROOT / 'wwwroot/SharkBoyEmulator')
    args = parser.parse_args()
    try:
        build(args.output.resolve(), args.emxx)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'SharkBoy build failed: {error}')
