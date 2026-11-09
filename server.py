import asyncio, base64, json, os, re, shutil, subprocess, sys, tempfile, threading, webbrowser
import urllib.error, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8000
LIB = os.path.join(ROOT, "library")
IDX = os.path.join(LIB, "index.json")
KIND_DIR = {"icon": "icons", "image": "images", "sfx": "sfx"}
OK_EXT = {"svg", "png", "webp", "jpg", "jpeg", "wav", "mp3", "ogg"}
_lib_lock = threading.Lock()


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


# ---------- TTS offline (pyttsx3 lewat subprocess) ----------
def _offline_script():
    return os.path.join(ROOT, "tools", "offline_tts.py")


def offline_voices():
    r = subprocess.run([sys.executable, _offline_script(), "--list"], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError("pyttsx3 belum terpasang / gagal: jalankan  pip install pyttsx3  (" + r.stderr.strip()[-160:] + ")")
    return json.loads(r.stdout.strip().splitlines()[-1])


def offline_tts(text, pct, voice):
    with tempfile.TemporaryDirectory() as td:
        tf, out = os.path.join(td, "t.txt"), os.path.join(td, "o.wav")
        open(tf, "w", encoding="utf-8").write(text)
        r = subprocess.run([sys.executable, _offline_script(), tf, out, str(int(pct)), voice or ""],
                           capture_output=True, text=True, timeout=180)
        if r.returncode != 0 or not os.path.exists(out):
            raise RuntimeError("TTS offline gagal: " + r.stderr.strip()[-200:])
        return open(out, "rb").read()


# ---------- WebM -> MP4 (butuh ffmpeg) ----------
def to_mp4(raw):
    ff = shutil.which("ffmpeg")
    if not ff:
        raise RuntimeError("ffmpeg tidak ditemukan di PATH. Install ffmpeg dulu (winget install ffmpeg).")
    with tempfile.TemporaryDirectory() as td:
        a, b = os.path.join(td, "in.webm"), os.path.join(td, "out.mp4")
        open(a, "wb").write(raw)
        r = subprocess.run([ff, "-y", "-i", a, "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "20",
                            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", b],
                           capture_output=True, timeout=1800)
        if r.returncode != 0:
            raise RuntimeError("ffmpeg gagal: " + r.stderr.decode(errors="ignore")[-200:])
        return open(b, "rb").read()


# ---------- Library aset ----------
def lib_load():
    with open(IDX, encoding="utf-8") as f:
        return json.load(f)


def lib_save(d):
    with open(IDX, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=1, ensure_ascii=False)


def lib_add(d):
    aid = str(d.get("id", "")).strip().lower()
    kind = d.get("kind")
    ext = str(d.get("ext", "")).lower().lstrip(".")
    if not re.fullmatch(r"[a-z0-9_]{2,40}", aid):
        raise RuntimeError("ID hanya huruf kecil/angka/underscore (2-40 karakter)")
    if kind not in KIND_DIR or ext not in OK_EXT:
        raise RuntimeError("Jenis atau format file tidak didukung")
    if not str(d.get("license", "")).strip():
        raise RuntimeError("Lisensi wajib diisi (mis. CC0-1.0, CC-BY-4.0, Pixabay)")
    with _lib_lock:
        idx = lib_load()
        if any(a["id"] == aid for a in idx["assets"]):
            raise RuntimeError("ID sudah dipakai")
        rel = "%s/%s.%s" % (KIND_DIR[kind], aid, ext)
        os.makedirs(os.path.join(LIB, KIND_DIR[kind]), exist_ok=True)
        with open(os.path.join(LIB, rel), "wb") as f:
            f.write(base64.b64decode(d["data"]))
        idx["assets"].append({
            "id": aid, "kind": kind, "file": rel,
            "tags": [t.strip().lower() for t in re.split(r"[,\s]+", d.get("tags", "")) if t.strip()],
            "tint": bool(d.get("tint", kind == "icon")),
            "license": d["license"].strip(), "author": d.get("author", "").strip(), "source": d.get("source", "").strip()})
        lib_save(idx)
    return {"ok": True}


def lib_delete(aid):
    with _lib_lock:
        idx = lib_load()
        hit = [a for a in idx["assets"] if a["id"] == aid]
        if not hit:
            raise RuntimeError("Aset tidak ditemukan")
        p = os.path.join(LIB, hit[0]["file"])
        if os.path.abspath(p).startswith(os.path.abspath(LIB)) and os.path.exists(p):
            os.remove(p)
        idx["assets"] = [a for a in idx["assets"] if a["id"] != aid]
        lib_save(idx)
    return {"ok": True}


def _json(h, obj):
    body = json.dumps(obj).encode()
    h.send_response(200)
    h.send_header("Content-Type", "application/json")
    h.send_header("Content-Length", str(len(body)))
    h.end_headers()
    h.wfile.write(body)


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_GET(self):
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

    def do_POST(self):
        routes = ("/tts", "/openai", "/tts-offline", "/api/to-mp4", "/api/library/add", "/api/library/delete")
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
            else:
                out = {"text": call_openai(d)}
        except Exception as e:
            out = {"error": str(e)}
        _json(self, out)


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), H)
    url = f"http://localhost:{PORT}"
    print("Story Engine jalan di", url, "(tutup jendela ini untuk berhenti)")
    threading.Timer(1, lambda: webbrowser.open(url)).start()
    srv.serve_forever()
