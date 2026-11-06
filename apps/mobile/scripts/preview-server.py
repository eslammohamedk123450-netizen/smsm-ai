#!/usr/bin/env python3
"""Serve an Expo web export with single-page-app fallback for route verification."""
import http.server
import os
import sys


class SpaHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path.split("?")[0])
        if not os.path.exists(path) or os.path.isdir(path):
            if not os.path.exists(os.path.join(path, "index.html")):
                self.path = "/index.html"
        return super().send_head()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))


if __name__ == "__main__":
    directory = sys.argv[1] if len(sys.argv) > 1 else "dist-preview"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8100
    os.chdir(directory)
    http.server.ThreadingHTTPServer(("0.0.0.0", port), SpaHandler).serve_forever()