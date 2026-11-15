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
import shutil
shutil.rmtree(os.path.join(server.ROOT, "data"), ignore_errors=True)
print("SEMUA LULUS" if ok else "ADA YANG GAGAL")
sys.exit(0 if ok else 1)
