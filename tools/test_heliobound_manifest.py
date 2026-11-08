import json
from pathlib import Path
import shutil
import tempfile
import unittest
from verify_heliobound import verify


class ManifestValidation(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.bundle = Path(self.temporary.name) / 'bundle'
        shutil.copytree(Path(__file__).resolve().parents[1] / 'wwwroot/heliobound', self.bundle)

    def test_exact_bundle(self):
        self.assertIn(verify(self.bundle)['release_status'], ('preview', 'release'))

    def test_tampered_wasm_is_rejected(self):
        with (self.bundle / 'pkg/heliobound_bg.wasm').open('ab') as wasm:
            wasm.write(b'bad')
        with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            verify(self.bundle)

    def test_extra_public_file_is_rejected(self):
        (self.bundle / 'private.key').write_text('not a real credential')
        with self.assertRaisesRegex(ValueError, 'Unlisted'):
            verify(self.bundle)

    def test_missing_file_is_rejected(self):
        (self.bundle / 'launcher.js').unlink()
        with self.assertRaisesRegex(ValueError, 'missing'):
            verify(self.bundle)

    def test_traversal_is_rejected(self):
        path = self.bundle / 'manifest.json'
        manifest = json.loads(path.read_text())
        manifest['files']['../escape.js'] = '0' * 64
        path.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError): verify(self.bundle)

    def test_symlink_is_rejected(self):
        (self.bundle / 'pkg/link.js').symlink_to('audio.js')
        with self.assertRaisesRegex(ValueError, 'Unsupported entry'):
            verify(self.bundle)

    def test_preview_cannot_pass_production_gate(self):
        path = self.bundle / 'manifest.json'
        manifest = json.loads(path.read_text())
        manifest['release_status'] = 'preview'
        path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'Production is blocked'):
            verify(self.bundle, require_release=True)


if __name__ == '__main__':
    unittest.main()
