from contextlib import redirect_stdout
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import StringIO
from pathlib import Path
import socket
import struct
import threading
import unittest
from unittest.mock import patch

from check_heliobound_http import check_with_retry


class StartupRetries(unittest.TestCase):
    def test_reset_before_ready_then_verify_real_bundle(self):
        class StartingServer(SimpleHTTPRequestHandler):
            manifest_requests = 0

            def do_GET(self):
                if self.path == '/heliobound/manifest.json':
                    type(self).manifest_requests += 1
                    if self.manifest_requests == 1:
                        # Reproduce an accepted connection reset by Docker before
                        # the application is ready, rather than a refused connect.
                        self.connection.setsockopt(
                            socket.SOL_SOCKET, socket.SO_LINGER, struct.pack('ii', 1, 0))
                        self.close_connection = True
                        self.connection.close()
                        return
                super().do_GET()

            def log_message(self, *args):
                pass

        root = Path(__file__).resolve().parents[1] / 'wwwroot'
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(StartingServer, directory=str(root)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with redirect_stdout(StringIO()) as output:
                check_with_retry(f'http://127.0.0.1:{server.server_port}',
                                 require_policy=False, attempts=3, retry_delay=0)
            self.assertEqual(StartingServer.manifest_requests, 2)
            self.assertIn('HTTP checks passed:', output.getvalue())
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_persistent_reset_exhausts_retries(self):
        with patch('check_heliobound_http.check', side_effect=ConnectionResetError('not ready')) as check:
            with self.assertRaises(ConnectionResetError):
                check_with_retry('http://unused', attempts=3, retry_delay=0)
            self.assertEqual(check.call_count, 3)

    def test_content_failure_is_not_retried(self):
        with patch('check_heliobound_http.check', side_effect=AssertionError('wrong checksum')) as check:
            with self.assertRaisesRegex(AssertionError, 'wrong checksum'):
                check_with_retry('http://unused', attempts=3, retry_delay=0)
            check.assert_called_once()


if __name__ == '__main__':
    unittest.main()
