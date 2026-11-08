import asyncio, base64, json, os, threading, webbrowser
import urllib.error, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8000


async def synth(text, voice, rate):
    import edge_tts
    comm = edge_tts.Communicate(text, voice, rate=rate)
    sub = edge_tts.SubMaker()
    audio = bytearray()
    async for ch in comm.stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] in ("WordBoundary", "SentenceBoundary"):
            sub.feed(ch)
    return bytes(audio), sub.get_srt()


def call_openai(d):
    key = d.get("key") or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise RuntimeError("API key OpenAI belum diisi")
    body = json.dumps({
        "model": d.get("model") or "gpt-4o-mini",
        "messages": [{"role": "user", "content": d["prompt"]}],
        "response_format": {"type": "json_object"},
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions", data=body,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            j = json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read())["error"]["message"]
        except Exception:
            msg = str(e)
        raise RuntimeError(msg)
    return j["choices"][0]["message"]["content"]


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_POST(self):
        if self.path not in ("/tts", "/openai"):
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            d = json.loads(self.rfile.read(n))
            if self.path == "/tts":
                audio, srt = asyncio.run(synth(d["text"], d["voice"], d.get("rate", "+0%")))
                out = {"audio": base64.b64encode(audio).decode(), "srt": srt}
            else:
                out = {"text": call_openai(d)}
        except Exception as e:
            out = {"error": str(e)}
        body = json.dumps(out).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), H)
    url = f"http://localhost:{PORT}"
    print("Story Engine jalan di", url, "(tutup jendela ini untuk berhenti)")
    threading.Timer(1, lambda: webbrowser.open(url)).start()
    srv.serve_forever()
