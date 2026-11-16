import json
from pathlib import Path
import shutil
import tempfile
import unittest

from verify_sharkboy import verify, verify_sources


class BundleIntegrity(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.bundle = Path(self.temporary.name) / 'bundle'
        shutil.copytree(Path(__file__).resolve().parents[1] / 'wwwroot/SharkBoyEmulator', self.bundle)

    def test_reviewed_bundle_and_sources_match(self):
        verify_sources(verify(self.bundle))

    def test_corrupted_wasm_is_rejected(self):
        with (self.bundle / 'sharkboy.wasm').open('ab') as stream:
            stream.write(b'changed')
        with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            verify(self.bundle)

    def test_unlisted_file_is_rejected(self):
        (self.bundle / 'accidental-config.txt').write_text('not a web asset')
        with self.assertRaisesRegex(ValueError, 'Unlisted'):
            verify(self.bundle)

    def test_symlink_is_rejected(self):
        (self.bundle / 'outside').symlink_to(Path(self.temporary.name))
        with self.assertRaisesRegex(ValueError, 'Unsupported'):
            verify(self.bundle)

    def test_modified_source_fingerprint_is_rejected(self):
        path = self.bundle / 'manifest.json'
        manifest = json.loads(path.read_text())
        manifest['source_files']['runtime.cpp'] = '0' * 64
        path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'source fingerprint'):
            verify(self.bundle)

    def test_stale_artifact_is_rejected(self):
        manifest = verify(self.bundle)
        manifest['source_files']['runtime.cpp'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'stale'):
            verify_sources(manifest)


if __name__ == '__main__':
    unittest.main()
