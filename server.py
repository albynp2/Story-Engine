import asyncio, base64, json, os, re, shutil, subprocess, sys, tempfile, threading, webbrowser
import time, uuid
import urllib.error, urllib.request, urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8000"))
LIB = os.path.join(ROOT, "library")
IDX = os.path.join(LIB, "index.json")
KIND_DIR = {"image": "images", "sfx": "sfx", "bgm": "bgm", "meme": "memes", "char": "characters"}
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


OPENAI_BASE = os.environ.get("OPENAI_BASE", "https://api.openai.com/v1")


class OAError(RuntimeError):
    def __init__(self, msg, code=0):
        super().__init__(msg)
        self.code = code


def _oa_post(path, payload, key, timeout=180):
    req = urllib.request.Request(
        OPENAI_BASE + path, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read())["error"]["message"]
        except Exception:
            msg = str(e)
        raise OAError(msg, e.code)
    except urllib.error.URLError as e:
        raise OAError("Tidak bisa menghubungi OpenAI: %s" % e.reason)


def _oa_key(d):
    key = d.get("key") or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise RuntimeError("API key OpenAI belum diisi")
    return key


def call_openai(d):
    j = _oa_post("/chat/completions", {
        "model": d.get("model") or "gpt-4o-mini",
        "messages": [{"role": "user", "content": d["prompt"]}],
        "response_format": {"type": "json_object"},
    }, _oa_key(d))
    return j["choices"][0]["message"]["content"]


RESEARCH_PROMPT = (
    "Cari di web dan susun dossier fakta tentang topik berikut: \"%s\".\n"
    "ATURAN KETAT:\n"
    "- Tulis HANYA fakta yang kamu temukan di sumber web. Jangan menebak, jangan mengarang, jangan melengkapi dari ingatan.\n"
    "- Setiap fakta sebutkan nama sumbernya. Angka, tahun, nama orang dan tempat harus persis seperti di sumber.\n"
    "- Kalau sumber saling bertentangan, tulis kedua versinya. Kalau tidak ditemukan, tulis \"Tidak ditemukan\".\n"
    "- Kalau sumber sendiri bilang belum pasti, tulis bahwa itu belum pasti.\n"
    "FORMAT (Bahasa Indonesia, sekitar 400-700 kata):\n"
    "1) Ringkasan singkat.\n2) Fakta terverifikasi (poin, urut kronologis jika sejarah, tiap poin ada sumbernya).\n"
    "3) Hal yang belum jelas atau tidak ditemukan.\n4) Daftar sumber.")


def research(d):
    topic = str(d.get("topic", "")).strip()
    if len(topic.split()) < 2:
        raise RuntimeError("Tulis topik yang jelas dulu (minimal 2 kata)")
    key = _oa_key(d)
    model = d.get("model") or "gpt-4o-mini"
    prompt = RESEARCH_PROMPT % topic.replace('"', "'")
    j = None
    err = None
    for tool in ("web_search", "web_search_preview"):
        try:
            j = _oa_post("/responses", {"model": model, "tools": [{"type": tool}], "input": prompt}, key, timeout=240)
            break
        except OAError as e:
            err = e
            if e.code != 400:
                raise
    if j is None:
        raise RuntimeError("Riset web gagal: %s (model %s mungkin tidak mendukung web search, coba gpt-4o-mini atau gpt-4.1-mini)" % (err, model))
    text, srcs = "", []
    for it in j.get("output", []):
        if it.get("type") != "message":
            continue
        for c in it.get("content", []):
            if c.get("type") == "output_text":
                text += c.get("text", "")
                for a in c.get("annotations", []):
                    if a.get("type") == "url_citation" and a.get("url") and a["url"] not in [x["url"] for x in srcs]:
                        srcs.append({"title": a.get("title", ""), "url": a["url"]})
    if not text.strip():
        raise RuntimeError("Riset web tidak mengembalikan teks")
    full = text.strip()
    if srcs:
        full += "\n\nSUMBER (URL):\n" + "\n".join("- %s: %s" % (x["title"] or "sumber", x["url"]) for x in srcs[:15])
    return {"text": full, "sources": srcs[:15]}


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


# ---------- Antrian Google Flow (dipakai ekstensi browser) ----------
_flow_lock = threading.Lock()
FLOW = {"jobs": {}, "seen": 0.0}
FLOW_DIR = os.path.join(ROOT, "data", "flow")


def flow_new(d):
    prompts = d.get("prompts") or []
    if not prompts:
        raise RuntimeError("Tidak ada prompt")
    jid = uuid.uuid4().hex[:10]
    job = {"id": jid, "title": str(d.get("title", ""))[:60], "aspect": str(d.get("aspect", "")),
           "prompts": [{"no": int(p["no"]), "prompt": str(p["prompt"]), "refs": [str(r) for r in p.get("refs", [])]} for p in prompts],
           "status": "queued", "msg": "Menunggu ekstensi Flow", "done": [], "files": {}, "t": time.time(), "tp": time.time()}
    with _flow_lock:
        FLOW["jobs"][jid] = job
    return {"id": jid}


def flow_next():
    with _flow_lock:
        FLOW["seen"] = time.time()
        jobs = sorted(FLOW["jobs"].values(), key=lambda j: j["t"])
        for j in jobs:
            if j["status"] == "queued" or (j["status"] == "running" and time.time() - j["tp"] > 120):
                j["status"] = "running"; j["tp"] = time.time()
                return {"job": {k: j[k] for k in ("id", "title", "aspect", "prompts", "done")}}
    return {"job": None}


def flow_progress(d):
    with _flow_lock:
        j = FLOW["jobs"].get(d.get("id"))
        if not j:
            raise RuntimeError("Job tidak ada")
        j["tp"] = time.time()
        if d.get("msg"):
            j["msg"] = str(d["msg"])[:200]
        if d.get("status") in ("error", "running"):
            j["status"] = d["status"]
    return {"ok": True}


def flow_result(d):
    with _flow_lock:
        j = FLOW["jobs"].get(d.get("id"))
        if not j or j["status"] == "cancelled":
            raise RuntimeError("Job tidak ada atau dibatalkan")
        no = int(d["no"])
        os.makedirs(os.path.join(FLOW_DIR, j["id"]), exist_ok=True)
        path = os.path.join(FLOW_DIR, j["id"], "gambar%d.png" % no)
        with open(path, "wb") as f:
            f.write(base64.b64decode(d["data"]))
        j["files"][no] = path
        if no not in j["done"]:
            j["done"].append(no)
        j["tp"] = time.time()
        if all(p["no"] in j["done"] for p in j["prompts"]):
            j["status"] = "done"; j["msg"] = "Semua gambar selesai"
    return {"ok": True}


def flow_cancel(d):
    with _flow_lock:
        j = FLOW["jobs"].get(d.get("id"))
        if j:
            j["status"] = "cancelled"
    return {"ok": True}


def flow_status(jid):
    with _flow_lock:
        j = FLOW["jobs"].get(jid)
        if not j:
            return {"error": "Job tidak ditemukan"}
        return {"status": j["status"], "msg": j["msg"], "done": sorted(j["done"]), "total": len(j["prompts"]),
                "ext_seen": time.time() - FLOW["seen"] < 15}


# ---------- Freesound (SFX gratis, hanya lisensi CC0) ----------
FS_BASE = os.environ.get("FREESOUND_BASE", "https://freesound.org/apiv2")
FS_FIELDS = "id,name,tags,username,license,previews,duration"


def _fs_key(d):
    key = (d.get("key") or os.environ.get("FREESOUND_API_KEY", "")).strip()
    if not key:
        raise RuntimeError("API key Freesound belum diisi (key gratis: https://freesound.org/apiv2/apply/)")
    return key


def _fs_get(path, params, key):
    req = urllib.request.Request(FS_BASE + path + "?" + urllib.parse.urlencode(params), headers={"Authorization": "Token " + key})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise RuntimeError("API key Freesound ditolak")
        if e.code == 429:
            raise RuntimeError("Terlalu banyak request ke Freesound, coba lagi sebentar lagi")
        raise RuntimeError("Freesound error HTTP %d" % e.code)
    except urllib.error.URLError as e:
        raise RuntimeError("Tidak bisa menghubungi Freesound: %s" % e.reason)


def _is_cc0(lic):
    lic = str(lic or "")
    return "publicdomain/zero" in lic or "Creative Commons 0" in lic


def _fs_host_ok(url):
    u = urllib.parse.urlparse(url)
    h = (u.hostname or "").lower()
    return u.scheme in ("http", "https") and (h == "freesound.org" or h.endswith(".freesound.org") or u.netloc == urllib.parse.urlparse(FS_BASE).netloc)


def freesound_search(d):
    q = str(d.get("query", "")).strip()
    if not q:
        raise RuntimeError("Isi kata kunci pencarian")
    try:
        maxdur = max(0.5, min(30.0, float(d.get("maxdur", 10))))
    except (TypeError, ValueError):
        maxdur = 10.0
    j = _fs_get("/search/text/", {"query": q, "page_size": 15, "fields": FS_FIELDS,
                                   "filter": 'license:"Creative Commons 0" duration:[0 TO %s]' % maxdur}, _fs_key(d))
    out = []
    for r in j.get("results", []):
        pv = r.get("previews") or {}
        if not _is_cc0(r.get("license")) or not pv.get("preview-hq-mp3"):
            continue
        out.append({"id": r["id"], "name": r.get("name", ""), "tags": (r.get("tags") or [])[:6], "user": r.get("username", ""),
                    "duration": round(float(r.get("duration", 0)), 2), "preview": pv.get("preview-lq-mp3") or pv["preview-hq-mp3"]})
    return {"results": out}


def freesound_add(d):
    sid = int(d["id"])
    r = _fs_get("/sounds/%d/" % sid, {"fields": FS_FIELDS}, _fs_key(d))
    if not _is_cc0(r.get("license")):
        raise RuntimeError("Suara ini bukan lisensi CC0, tidak ditambahkan")
    url = (r.get("previews") or {}).get("preview-hq-mp3")
    if not url or not _fs_host_ok(url):
        raise RuntimeError("URL preview tidak valid")
    with urllib.request.urlopen(url, timeout=60) as x:
        mp3 = x.read(5_000_001)
    if len(mp3) > 5_000_000:
        raise RuntimeError("File terlalu besar (maks 5 MB)")
    slug = re.sub(r"[^a-z0-9]+", "_", str(r.get("name", "sfx")).lower()).strip("_")[:22] or "sfx"
    ut = d.get("tags") or []
    if isinstance(ut, str):
        ut = [t for t in re.split(r"[,\s]+", ut) if t]
    tags = ",".join(dict.fromkeys([str(t).lower() for t in ut] + [str(t).lower() for t in (r.get("tags") or [])[:5]]))
    lib_add({"id": "fs_%s_%d" % (slug, sid), "kind": "sfx", "ext": "mp3", "data": base64.b64encode(mp3).decode(),
             "tags": tags, "license": "CC0-1.0", "author": r.get("username", ""), "source": "https://freesound.org/s/%d/" % sid})
    return {"ok": True, "id": "fs_%s_%d" % (slug, sid)}


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

    def do_GET(self):
        if self.path.startswith("/api/health"):
            try:
                import edge_tts  # noqa
                edge = True
            except Exception:
                edge = False
            return _json(self, {"ffmpeg": bool(shutil.which("ffmpeg")), "edge": edge,
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
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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
            elif self.path == "/api/research":
                out = research(d)
            elif self.path == "/api/freesound/search":
                out = freesound_search(d)
            elif self.path == "/api/freesound/add":
                out = freesound_add(d)
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
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), H)
    url = f"http://localhost:{PORT}"
    print("Story Engine jalan di", url, "(tutup jendela ini untuk berhenti)")
    threading.Timer(1, lambda: webbrowser.open(url)).start()
    srv.serve_forever()
