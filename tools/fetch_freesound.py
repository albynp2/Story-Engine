"""Download efek suara CC0 dari Freesound ke library lokal (preview MP3 kualitas tinggi).
BELUM DIUJI oleh pembuat (tanpa akses internet saat dibuat) - cek hasilnya sebelum dipakai.

  set FREESOUND_API_KEY=xxxx            (key gratis: https://freesound.org/apiv2/apply/)
  python tools/fetch_freesound.py "rain" --max 3 --tags hujan,rain
Hanya lisensi 'Creative Commons 0' yang diambil, supaya aman untuk konten monetisasi tanpa atribusi.
"""
import argparse, json, os, re, sys, urllib.parse, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, "library"); IDX = os.path.join(LIB, "index.json")

ap = argparse.ArgumentParser()
ap.add_argument("query"); ap.add_argument("--max", type=int, default=3)
ap.add_argument("--tags", default=""); ap.add_argument("--maxdur", type=float, default=10)
a = ap.parse_args()
key = os.environ.get("FREESOUND_API_KEY")
if not key: sys.exit("Isi environment variable FREESOUND_API_KEY dulu.")
params = {"query": a.query, "token": key, "page_size": a.max,
          "filter": 'license:"Creative Commons 0" duration:[0 TO %s]' % a.maxdur,
          "fields": "id,name,tags,username,license,previews,duration"}
url = "https://freesound.org/apiv2/search/text/?" + urllib.parse.urlencode(params)
data = json.load(urllib.request.urlopen(url, timeout=30))
idx = json.load(open(IDX, encoding="utf-8"))
have = {x["id"] for x in idx["assets"]}
os.makedirs(os.path.join(LIB, "sfx"), exist_ok=True)
for r in data.get("results", []):
    sid = "fs_%s_%s" % (re.sub(r"[^a-z0-9]+", "_", r["name"].lower())[:24].strip("_"), r["id"])
    if sid in have: continue
    mp3 = urllib.request.urlopen(r["previews"]["preview-hq-mp3"], timeout=60).read()
    open(os.path.join(LIB, "sfx", sid + ".mp3"), "wb").write(mp3)
    idx["assets"].append({"id": sid, "kind": "sfx", "file": "sfx/%s.mp3" % sid,
        "tags": [t for t in (a.tags.split(",") + r.get("tags", [])[:5]) if t], "duration": round(r["duration"], 2),
        "license": "CC0-1.0", "author": r["username"], "source": "https://freesound.org/s/%s/" % r["id"]})
    print("+", sid)
json.dump(idx, open(IDX, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
