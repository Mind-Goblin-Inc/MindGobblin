#!/usr/bin/env python3
"""Import one selected, verified engine release. Never fetch or deploy."""
import argparse
from pathlib import Path
import shutil
import tempfile
from verify_heliobound import verify

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('bundle', type=Path)
parser.add_argument('--replace', action='store_true', help='Replace the current bundle and manifest together')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
destination = root / 'wwwroot/heliobound'
verify(args.bundle)
if destination.exists() and not args.replace:
    raise SystemExit('A bundle already exists. Review it before using --replace.')
with tempfile.TemporaryDirectory(prefix='.heliobound-import-', dir=root) as temporary:
    staging = Path(temporary) / 'bundle'
    shutil.copytree(args.bundle, staging)
    verify(staging)
    backup = Path(temporary) / 'previous'
    if destination.exists():
        if destination.is_symlink():
            raise SystemExit('Refusing to replace a symlink')
        destination.rename(backup)
    try:
        staging.rename(destination)
    except OSError:
        if backup.exists(): backup.rename(destination)
        raise
print(f'Imported local preview into {destination}. No push or deployment occurred.')
