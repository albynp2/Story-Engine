import asyncio, base64, json, os, re, shutil, subprocess, sys, tempfile, threading, webbrowser
import time, uuid
import urllib.error, urllib.request, urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

try:  # Fact Explainer (modular). Kalau gagal dimuat, menu lama tetap jalan.
    from engines import api as fact_api
except Exception as _e:  # noqa
    fact_api = None
    print("Fact Explainer tidak aktif:", _e)

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("SE_HOST", "127.0.0.1")  # Docker: set SE_HOST=0.0.0.0
def origin_ok(o):
    return bool(o) and (o.startswith("chrome-extension://") or o.startswith("moz-extension://") or re.match(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$", o))


def _json(h, obj):
    body = json.dumps(obj).encode()
    h.send_response(200)
    h.send_header("Content-Type", "application/json")
    h.send_header("Content-Length", str(len(body)))
    o = h.headers.get("Origin", "")
    if origin_ok(o):
        h.send_header("Access-Control-Allow-Origin", o)
    h.end_headers()
    h.wfile.write(body)


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def _fact(self, method):
        """Teruskan /api/project*, /api/projects, /api/stages ke engines.api."""
        o = self.headers.get("Origin", "")
        if fact_api is None:
            status, out = 503, {"error": "Fact Explainer tidak aktif"}
        elif method != "GET" and o and not origin_ok(o):
            status, out = 403, {"error": "Origin tidak diizinkan"}
        else:
            body = None
            if method == "POST":
                try:
                    body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
                except ValueError:
                    status, out = 400, {"error": "JSON tidak valid", "code": "INVALID_INPUT"}
                    return self._send(status, out)
            status, out = fact_api.handle(method, self.path, body)
        self._send(status, out)

    def _send(self, status, obj):
        b = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        o = self.headers.get("Origin", "")
        if origin_ok(o):
            self.send_header("Access-Control-Allow-Origin", o)
        self.end_headers()
        self.wfile.write(b)

    def do_DELETE(self):
        if self.path.startswith("/api/project/"):
            return self._fact("DELETE")
        self.send_error(404)

    def do_GET(self):
>>>>>>> 2c3ca03c71db8b4c9842013b69df3211a8f67c2a
        if self.path.startswith("/api/health"):
            try:
                import edge_tts  # noqa
                edge = True
            except Exception:
                edge = False
            return _json(self, {"ffmpeg": bool(shutil.which("ffmpeg")), "edge": edge,
<<<<<<< HEAD
                                "openai_env": bool(os.environ.get("OPENAI_API_KEY")),
=======
                                "openai_env": bool(os.environ.get("OPENAI_API_KEY")), "freesound_env": bool(os.environ.get("FREESOUND_API_KEY")),
                                "flow_ext": time.time() - FLOW["seen"] < 15})
        if self.path.startswith("/api/flow/next"):
            return _json(self, flow_next())
        if self.path.startswith("/api/flow/job"):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            return _json(self, flow_status((q.get("id") or [""])[0]))
        if self.path.startswith("/api/flow/file"):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            with _flow_lock:
                j = FLOW["jobs"].get((q.get("id") or [""])[0])
                p = j["files"].get(int((q.get("no") or ["0"])[0])) if j else None
            if not p or not os.path.exists(p):
                self.send_error(404)
                return
            with open(p, "rb") as f:
                b = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
            return
        if self.path == "/api/capabilities":
            try:
                import edge_tts  # noqa
                edge = True
            except Exception:
                edge = False
            return _json(self, {"ffmpeg": bool(shutil.which("ffmpeg")), "edge": edge})
        if self.path == "/api/offline-voices":
            try:
                return _json(self, {"voices": offline_voices()})
            except Exception as e:
                return _json(self, {"error": str(e)})
        return super().do_GET()

    def end_headers(self):  # library/index.json berubah-ubah, jangan di-cache
        if self.path.startswith("/library/index.json"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        o = self.headers.get("Origin", "")
        if origin_ok(o):
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        routes = ("/tts", "/openai", "/tts-offline", "/api/to-mp4", "/api/library/add", "/api/library/delete",
                  "/api/flow/jobs", "/api/flow/progress", "/api/flow/result", "/api/flow/cancel",
                  "/api/freesound/search", "/api/freesound/add", "/api/research")
        if self.path not in routes:
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(n)
            if self.path == "/api/to-mp4":
                mp4 = to_mp4(raw)
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(len(mp4)))
                self.end_headers()
                self.wfile.write(mp4)
                return
            d = json.loads(raw)
            if self.path == "/tts":
                audio, srt = asyncio.run(synth(d["text"], d["voice"], d.get("rate", "+0%")))
                out = {"audio": base64.b64encode(audio).decode(), "srt": srt}
            elif self.path == "/tts-offline":
                wav = offline_tts(d["text"], d.get("rate", 0), d.get("voice", ""))
                out = {"audio": base64.b64encode(wav).decode()}
            elif self.path == "/api/library/add":
                out = lib_add(d)
            elif self.path == "/api/library/delete":
                out = lib_delete(d["id"])
<<<<<<< HEAD
=======
            elif self.path == "/api/research":
                out = research(d)
            elif self.path == "/api/freesound/search":
                out = freesound_search(d)
            elif self.path == "/api/freesound/add":
                out = freesound_add(d)
>>>>>>> 2c3ca03c71db8b4c9842013b69df3211a8f67c2a
            elif self.path == "/api/flow/jobs":
                out = flow_new(d)
            elif self.path == "/api/flow/progress":
                out = flow_progress(d)
            elif self.path == "/api/flow/result":
                out = flow_result(d)
            elif self.path == "/api/flow/cancel":
                out = flow_cancel(d)
            else:
                out = {"text": call_openai(d)}
        except Exception as e:
            out = {"error": str(e)}
        _json(self, out)


if __name__ == "__main__":
    srv = ThreadingHTTPServer((HOST, PORT), H)
    url = f"http://localhost:{PORT}"
    print("Story Engine jalan di", url, "(tutup jendela ini untuk berhenti)")
    threading.Timer(1, lambda: webbrowser.open(url)).start()
    srv.serve_forever()
