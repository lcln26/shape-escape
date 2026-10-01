#!/usr/bin/env python3
"""Dev server for Shape Escape.

Serves the repo on http://localhost:8000 with caching disabled, so code
changes show up on a normal reload. It also accepts benchmark results from
tools/framepace.html (POST /__bench) and saves them to .bench/, so they can
be read back from the command line.
"""
import http.server
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BENCH_DIR = os.path.join(ROOT, '.bench')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if self.path != '/__bench':
            self.send_error(404)
            return
        length = min(int(self.headers.get('Content-Length', 0)), 1_000_000)
        try:
            result = json.loads(self.rfile.read(length))
        except ValueError:
            self.send_error(400)
            return
        os.makedirs(BENCH_DIR, exist_ok=True)
        name = f"{time.strftime('%Y%m%d-%H%M%S')}-{result.get('browser', 'unknown')}.json"
        with open(os.path.join(BENCH_DIR, name), 'w') as f:
            json.dump(result, f, indent=2)
        self.send_response(204)
        self.end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    # Bound to localhost only: this is a dev server.
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'Serving Shape Escape on http://localhost:{port}')
    server.serve_forever()
