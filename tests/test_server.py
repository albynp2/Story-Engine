"""Tes offline server + antrian Flow (mensimulasikan ekstensi). Jalankan: python tests/test_server.py"""
import base64, json, os, sys, threading, time, urllib.request, urllib.error
from http.server import ThreadingHTTPServer
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import server

srv = ThreadingHTTPServer(("127.0.0.1", 0), server.H)
B = "http://127.0.0.1:%d" % srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
ok = True


def get(path, hdr=None):
    with urllib.request.urlopen(urllib.request.Request(B + path, headers=hdr or {})) as x:
        return x.status, x.read(), x.headers


def post(path, obj, hdr=None):
    h = {"Content-Type": "application/json"}; h.update(hdr or {})
    with urllib.request.urlopen(urllib.request.Request(B + path, data=json.dumps(obj).encode(), headers=h, method="POST")) as x:
        return json.loads(x.read()), x.headers


def check(name, cond, extra=""):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + name, extra)


PNG = base64.b64encode(bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")).decode()
WAV = base64.b64encode(b"RIFF$\x00\x00\x00WAVEfmt ").decode()

h = json.loads(get("/api/health")[1])
check("health", "ffmpeg" in h and h["flow_ext"] is False, h)
for n in ["dashboard", "manual-footage", "explainer", "drama-ai", "stickman", "settings"]:
    check("page " + n, get("/pages/%s.html" % n)[0] == 200)

jid = post("/api/flow/jobs", {"title": "t", "aspect": "9:16", "prompts": [{"no": 1, "prompt": "a", "refs": []}, {"no": 2, "prompt": "b"}]})[0]["id"]
check("job queued", json.loads(get("/api/flow/job?id=" + jid)[1])["status"] == "queued")
nx = json.loads(get("/api/flow/next")[1])["job"]
check("extension gets job", nx and nx["id"] == jid and len(nx["prompts"]) == 2)
check("flow_ext after poll", json.loads(get("/api/health")[1])["flow_ext"] is True)
post("/api/flow/result", {"id": jid, "no": 1, "data": PNG})
s = json.loads(get("/api/flow/job?id=" + jid)[1])
check("partial progress", s["status"] == "running" and s["done"] == [1], s)
post("/api/flow/result", {"id": jid, "no": 2, "data": PNG})
s = json.loads(get("/api/flow/job?id=" + jid)[1])
check("job done", s["status"] == "done" and s["done"] == [1, 2], s)
st, b, hd = get("/api/flow/file?id=%s&no=2" % jid)
check("file served", st == 200 and b[:4] == b"\x89PNG" and hd["Content-Type"] == "image/png")
check("no more jobs", json.loads(get("/api/flow/next")[1])["job"] is None)

_, hh = post("/api/flow/progress", {"id": jid, "msg": "x"}, {"Origin": "chrome-extension://abc"})
check("CORS extension allowed", hh.get("Access-Control-Allow-Origin") == "chrome-extension://abc")
_, hh = post("/api/flow/progress", {"id": jid, "msg": "x"}, {"Origin": "https://evil.example"})
check("CORS other site blocked", hh.get("Access-Control-Allow-Origin") is None)

j2 = post("/api/flow/jobs", {"title": "c", "prompts": [{"no": 1, "prompt": "a"}]})[0]["id"]
post("/api/flow/cancel", {"id": j2})
check("cancel", json.loads(get("/api/flow/job?id=" + j2)[1])["status"] == "cancelled")
check("result after cancel refused", "error" in post("/api/flow/result", {"id": j2, "no": 1, "data": PNG})[0])

check("add bgm", post("/api/library/add", {"id": "tes_bgm", "kind": "bgm", "ext": "wav", "data": WAV, "license": "own", "tags": "santai"})[0].get("ok"))
check("add char", post("/api/library/add", {"id": "tes_char", "kind": "char", "ext": "png", "data": PNG, "license": "unggahan sendiri", "source": "wanita 28 tahun"})[0].get("ok"))
idx = json.loads(get("/library/index.json")[1])
check("library lists new kinds", {"bgm", "char"} <= {a["kind"] for a in idx["assets"] if a["id"].startswith("tes_")})
check("sfx still there", any(a["kind"] == "sfx" for a in idx["assets"]))
check("bad extension refused", "error" in post("/api/library/add", {"id": "abc_x", "kind": "bgm", "ext": "exe", "data": WAV, "license": "x"})[0])
check("no license refused", "error" in post("/api/library/add", {"id": "abc_y", "kind": "bgm", "ext": "wav", "data": WAV, "license": ""})[0])
post("/api/library/delete", {"id": "tes_bgm"}); post("/api/library/delete", {"id": "tes_char"})
idx = json.loads(get("/library/index.json")[1])
check("cleanup", not any(a["id"].startswith("tes_") for a in idx["assets"]))
<<<<<<< HEAD
=======

# ---------- Freesound (server palsu, tanpa internet) ----------
from http.server import BaseHTTPRequestHandler
import urllib.parse as up
MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\xff\xfb\x90\x00" * 50
SOUNDS = {
    101: {"id": 101, "name": "Whoosh Fast", "tags": ["whoosh", "air"], "username": "tester", "license": "http://creativecommons.org/publicdomain/zero/1.0/", "duration": 1.5},
    102: {"id": 102, "name": "Not CC0", "tags": ["x"], "username": "tester", "license": "http://creativecommons.org/licenses/by/4.0/", "duration": 1.0},
    103: {"id": 103, "name": "Evil Host", "tags": ["x"], "username": "tester", "license": "http://creativecommons.org/publicdomain/zero/1.0/", "duration": 1.0},
}


class FS(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _j(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        u = up.urlparse(self.path)
        if self.headers.get("Authorization") != "Token goodkey" and not u.path.startswith("/p/"):
            return self._j({"detail": "Invalid token."}, 401)
        if u.path == "/search/text/":
            q = up.parse_qs(u.query)
            assert "Creative Commons 0" in q["filter"][0]
            res = []
            for i, snd in SOUNDS.items():
                snd = dict(snd); snd["previews"] = {"preview-hq-mp3": FSB + "/p/%d.mp3" % i, "preview-lq-mp3": FSB + "/p/%d-lq.mp3" % i}
                res.append(snd)
            return self._j({"results": res})
        if u.path.startswith("/sounds/"):
            i = int(u.path.strip("/").split("/")[1]); snd = dict(SOUNDS[i])
            snd["previews"] = {"preview-hq-mp3": ("https://evil.example/x.mp3" if i == 103 else FSB + "/p/%d.mp3" % i)}
            return self._j(snd)
        if u.path.startswith("/p/"):
            self.send_response(200); self.send_header("Content-Type", "audio/mpeg"); self.send_header("Content-Length", str(len(MP3))); self.end_headers(); self.wfile.write(MP3); return
        self.send_error(404)


fs_srv = ThreadingHTTPServer(("127.0.0.1", 0), FS)
FSB = "http://127.0.0.1:%d" % fs_srv.server_address[1]
threading.Thread(target=fs_srv.serve_forever, daemon=True).start()
server.FS_BASE = FSB
os.environ.pop("FREESOUND_API_KEY", None)

check("freesound: tanpa key ditolak", "belum diisi" in post("/api/freesound/search", {"query": "whoosh"})[0].get("error", ""))
check("freesound: key salah", "ditolak" in post("/api/freesound/search", {"key": "bad", "query": "whoosh"})[0].get("error", ""))
check("freesound: kata kunci kosong", "kata kunci" in post("/api/freesound/search", {"key": "goodkey", "query": " "})[0].get("error", ""))
r = post("/api/freesound/search", {"key": "goodkey", "query": "whoosh", "maxdur": 8})[0]
ids = [x["id"] for x in r.get("results", [])]
check("freesound: hanya CC0 yang tampil", 101 in ids and 102 not in ids, ids)
check("freesound: ada URL preview", r["results"][0]["preview"].endswith("-lq.mp3"))
a = post("/api/freesound/add", {"key": "goodkey", "id": 101, "tags": "whoosh"})[0]
check("freesound: tambah CC0", a.get("ok") and a["id"] == "fs_whoosh_fast_101", a)
idx = json.loads(get("/library/index.json")[1])
e = [x for x in idx["assets"] if x["id"] == "fs_whoosh_fast_101"]
check("freesound: masuk library sebagai sfx CC0", e and e[0]["kind"] == "sfx" and e[0]["license"] == "CC0-1.0" and e[0]["source"].endswith("/s/101/") and e[0]["tags"] == ["whoosh", "air"], e)
check("freesound: file mp3 terunduh", get("/library/" + e[0]["file"])[1][:3] == b"ID3")
check("freesound: duplikat ditolak", "sudah dipakai" in post("/api/freesound/add", {"key": "goodkey", "id": 101})[0].get("error", ""))
check("freesound: non-CC0 ditolak", "bukan lisensi CC0" in post("/api/freesound/add", {"key": "goodkey", "id": 102})[0].get("error", ""))
check("freesound: host preview asing ditolak", "tidak valid" in post("/api/freesound/add", {"key": "goodkey", "id": 103})[0].get("error", ""))
post("/api/library/delete", {"id": "fs_whoosh_fast_101"})
check("freesound: cleanup", not any(x["id"].startswith("fs_") for x in json.loads(get("/library/index.json")[1])["assets"]))

# ---------- Riset web OpenAI (server palsu) ----------
CALLS = []


class OA(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _j(self, o, code=200):
        b = json.dumps(o).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.headers.get("Authorization") != "Bearer sk-good":
            return self._j({"error": {"message": "Incorrect API key provided"}}, 401)
        CALLS.append((self.path, body))
        if self.path == "/responses":
            tool = body["tools"][0]["type"]
            if tool == "web_search" and OA.reject_new:
                return self._j({"error": {"message": "Invalid value: 'web_search'"}}, 400)
            if "kosong" in body["input"]:
                return self._j({"output": [{"type": "web_search_call"}, {"type": "message", "content": []}]})
            return self._j({"output": [{"type": "web_search_call"}, {"type": "message", "content": [{"type": "output_text", "text": "Kadupandak berada di Cianjur selatan. Kontrak perkebunan 75 tahun sekitar 1898.", "annotations": [
                {"type": "url_citation", "url": "https://example.org/a", "title": "Garuda"}, {"type": "url_citation", "url": "https://example.org/a", "title": "Garuda"}, {"type": "url_citation", "url": "https://example.org/b", "title": "KPU"}]}]}]})
        if self.path == "/chat/completions":
            return self._j({"choices": [{"message": {"content": "{\"ok\":1}"}}]})
        self.send_error(404)


OA.reject_new = False
oa_srv = ThreadingHTTPServer(("127.0.0.1", 0), OA)
threading.Thread(target=oa_srv.serve_forever, daemon=True).start()
server.OPENAI_BASE = "http://127.0.0.1:%d" % oa_srv.server_address[1]
os.environ.pop("OPENAI_API_KEY", None)

check("riset: tanpa key", "belum diisi" in post("/api/research", {"topic": "sejarah kota kadupandak"})[0].get("error", ""))
check("riset: topik terlalu pendek", "topik yang jelas" in post("/api/research", {"key": "sk-good", "topic": "AC"})[0].get("error", ""))
check("riset: key salah", "Incorrect API key" in post("/api/research", {"key": "sk-bad", "topic": "sejarah kota kadupandak"})[0].get("error", ""))
r = post("/api/research", {"key": "sk-good", "topic": "sejarah kota kadupandak", "model": "gpt-4o-mini"})[0]
check("riset: teks + sumber unik", "1898" in r.get("text", "") and len(r.get("sources", [])) == 2 and "https://example.org/b" in r["text"], r.get("sources"))
path, body = CALLS[-1]
check("riset: pakai Responses API + web_search", path == "/responses" and body["tools"] == [{"type": "web_search"}] and "sejarah kota kadupandak" in body["input"] and "Jangan menebak" in body["input"])
OA.reject_new = True
r = post("/api/research", {"key": "sk-good", "topic": "sejarah kota kadupandak"})[0]
check("riset: fallback ke web_search_preview", r.get("text") and CALLS[-1][1]["tools"] == [{"type": "web_search_preview"}], r.get("error"))
OA.reject_new = False
check("riset: respons kosong ditolak", "tidak mengembalikan teks" in post("/api/research", {"key": "sk-good", "topic": "topik kosong sekali"})[0].get("error", ""))
check("openai chat masih jalan", post("/openai", {"key": "sk-good", "prompt": "x"})[0].get("text") == "{\"ok\":1}")
>>>>>>> 2c3ca03c71db8b4c9842013b69df3211a8f67c2a
import shutil
shutil.rmtree(os.path.join(server.ROOT, "data"), ignore_errors=True)
print("SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
