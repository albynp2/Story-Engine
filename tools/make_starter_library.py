"""Membuat library starter (ikon SVG + efek suara) yang SEMUA dibuat sendiri => lisensi CC0.
Jalankan ulang bila perlu:  python tools/make_starter_library.py   (SFX butuh numpy)
"""
import json, os, wave, struct, math, random
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, "library")
os.makedirs(os.path.join(LIB, "icons"), exist_ok=True)
os.makedirs(os.path.join(LIB, "sfx"), exist_ok=True)

W = '#fff'
def svg(body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" fill="%s" stroke="none">%s</svg>' % (W, body))
S = 'fill="none" stroke="%s" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"' % W
CLOUD = '<circle cx="35" cy="55" r="17"/><circle cx="57" cy="45" r="21"/><circle cx="75" cy="58" r="13"/><rect x="22" y="55" width="64" height="17" rx="8"/>'
def cloud_at(dy, sc=1.0):
    return '<g transform="translate(0,%s) translate(50,50) scale(%s) translate(-50,-50)">%s</g>' % (dy, sc, CLOUD)

ICONS = {
 "sun": ("matahari sun panas cahaya heat light", '<circle cx="50" cy="50" r="17"/><path %s d="M50 10v11M50 79v11M10 50h11M79 50h11M22 22l8 8M70 70l8 8M78 22l-8 8M30 70l-8 8"/>' % S),
 "cloud": ("awan cloud langit sky", cloud_at(0)),
 "rain_cloud": ("hujan awan rain cloud mendung", cloud_at(-14, .9) + '<path %s d="M34 78l-4 11M52 78l-4 11M70 78l-4 11"/>' % S),
 "storm": ("badai petir storm thunder lightning", cloud_at(-14, .9) + '<path d="M54 62l-14 20h10l-5 16 18-24H52z"/>'),
 "drop": ("tetes air drop water hujan embun", '<path d="M50 10C50 10 21 46 21 63a29 29 0 0 0 58 0C79 46 50 10 50 10z"/>'),
 "vapor": ("uap penguapan evaporasi vapor steam naik", '<path %s d="M25 85c-8-12 8-18 0-30s8-18 0-30M50 85c-8-12 8-18 0-30s8-18 0-30M75 85c-8-12 8-18 0-30s8-18 0-30"/><path d="M25 12l-8 12h16zM50 12l-8 12h16zM75 12l-8 12h16z"/>' % S),
 "wave": ("laut ombak sungai air ocean wave sea river", '<path %s d="M8 40c10-12 17-12 21 0s11 12 21 0 17-12 21 0 11 12 21 0M8 62c10-12 17-12 21 0s11 12 21 0 17-12 21 0 11 12 21 0"/>' % S),
 "mountain": ("gunung mountain bukit alam", '<path d="M4 84L36 28l16 26 12-18 32 48z"/>'),
 "tree": ("pohon tree hutan forest alam", '<circle cx="50" cy="38" r="26"/><rect x="45" y="55" width="10" height="34" rx="3"/>'),
 "plant": ("tanaman plant daun leaf tumbuh grow", '<path %s d="M50 90V40"/><path d="M50 62C30 62 20 48 20 32c18 0 30 10 30 30zM50 50c0-18 12-30 32-30 0 18-12 30-32 30z"/>' % S),
 "house": ("rumah house home tempat", '<path d="M50 12L8 50h12v36h60V50h12z"/>'),
 "brain": ("otak brain pikiran mind psikologi", '<ellipse cx="36" cy="50" rx="24" ry="28"/><ellipse cx="64" cy="50" rx="24" ry="28"/>'),
 "thought": ("pikiran thought mikir bubble overthinking ragu", '<circle cx="36" cy="40" r="18"/><circle cx="56" cy="32" r="22"/><circle cx="74" cy="44" r="15"/><rect x="26" y="40" width="56" height="20" rx="10"/><circle cx="30" cy="76" r="7"/><circle cx="18" cy="90" r="4"/>'),
 "lightbulb": ("lampu bulb ide idea cahaya solusi", '<path d="M50 8a28 28 0 0 0-16 51c4 3 6 7 6 12h20c0-5 2-9 6-12A28 28 0 0 0 50 8z"/><rect x="38" y="76" width="24" height="6" rx="3"/><rect x="42" y="86" width="16" height="6" rx="3"/>'),
 "clock": ("jam clock waktu time durasi", '<circle cx="50" cy="50" r="38" %s/><path %s d="M50 26v26l16 10"/>' % (S, S)),
 "heart": ("hati heart cinta love kesehatan", '<path d="M50 88C20 66 8 48 8 32A21 21 0 0 1 50 26a21 21 0 0 1 42 6c0 16-12 34-42 56z"/>'),
 "star": ("bintang star favorit penting", '<path d="M50 8l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 39l30-3z"/>'),
 "check": ("centang check benar sukses ok", '<circle cx="50" cy="50" r="38" %s/><path %s d="M32 52l13 13 24-26"/>' % (S, S)),
 "cross": ("silang salah cross no gagal", '<circle cx="50" cy="50" r="38" %s/><path %s d="M36 36l28 28M64 36L36 64"/>' % (S, S)),
 "question": ("tanya question penasaran kenapa mengapa", '<circle cx="50" cy="50" r="38" %s/><path %s d="M38 40a12 12 0 1 1 18 10c-5 3-6 6-6 11"/><circle cx="50" cy="72" r="4"/>' % (S, S)),
 "warning": ("peringatan warning bahaya awas masalah", '<path %s d="M50 12L8 86h84z"/><path %s d="M50 40v22"/><circle cx="50" cy="73" r="3"/>' % (S, S)),
 "gear": ("roda gigi gear sistem mesin proses setting", '<circle cx="50" cy="50" r="30" fill="none" stroke="%s" stroke-width="16" stroke-dasharray="9.4 9.4"/><circle cx="50" cy="50" r="24" %s/>' % (W, S)),
 "book": ("buku book belajar ilmu edukasi", '<path d="M8 20c14-4 30-4 42 6v62C38 80 22 80 8 84zM92 20c-14-4-30-4-42 6v62c12-8 28-8 42-4z"/>'),
 "magnifier": ("kaca pembesar search cari riset magnifier", '<circle cx="42" cy="42" r="28" %s/><path %s d="M63 63l26 26"/>' % (S, S)),
 "globe": ("bumi globe dunia earth world internet", '<circle cx="50" cy="50" r="40" %s/><ellipse cx="50" cy="50" rx="17" ry="40" %s/><path %s d="M10 50h80M16 30h68M16 70h68"/>' % (S, S, S)),
 "thermometer": ("suhu thermometer panas dingin temperatur", '<rect x="40" y="8" width="20" height="56" rx="10" %s/><circle cx="50" cy="74" r="15"/><path %s d="M50 30v40"/>' % (S, S)),
 "fire": ("api fire panas bakar energi", '<path d="M50 6c4 16 24 26 24 50a24 24 0 0 1-48 0c0-10 5-17 10-22 1 8 5 12 9 12-3-14-1-28 5-40z"/>'),
 "snowflake": ("salju snowflake dingin es ice winter", '<path %s d="M50 10v80M16 30l68 40M84 30L16 70M40 14l10 10 10-10M40 86l10-10 10 10"/>' % S),
 "lightning": ("petir kilat lightning listrik energi cepat", '<path d="M58 6L22 56h24l-6 38 38-54H54z"/>'),
 "moon": ("bulan moon malam tidur night sleep", '<path d="M62 10a40 40 0 1 0 28 62A36 36 0 0 1 62 10z"/>'),
 "wind": ("angin wind udara air hembus", '<path %s d="M10 38h46a12 12 0 1 0-12-12M10 58h62a12 12 0 1 1-12 12M10 78h30"/>' % S),
 "battery": ("baterai battery energi capek lelah power", '<rect x="8" y="28" width="76" height="44" rx="8" %s/><rect x="86" y="42" width="7" height="16" rx="2"/><rect x="17" y="37" width="22" height="26" rx="3"/>' % S),
 "phone": ("hp phone smartphone gadget media sosial", '<rect x="26" y="8" width="48" height="84" rx="10" %s/><path %s d="M44 80h12"/>' % (S, S)),
 "coin": ("koin coin uang money harga ekonomi", '<circle cx="50" cy="50" r="38" %s/><circle cx="50" cy="50" r="24" %s/>' % (S, S)),
 "chart": ("grafik chart data naik statistik", '<rect x="14" y="52" width="16" height="36" rx="3"/><rect x="42" y="32" width="16" height="56" rx="3"/><rect x="70" y="12" width="16" height="76" rx="3"/>'),
 "shield": ("perisai shield aman lindungi security", '<path d="M50 8l36 12v26c0 24-16 38-36 46C30 84 14 70 14 46V20z"/>'),
 "lock": ("kunci lock gembok privasi aman", '<rect x="20" y="44" width="60" height="44" rx="8"/><path %s d="M32 44V32a18 18 0 0 1 36 0v12"/>' % S),
 "person": ("orang person manusia people user", '<circle cx="50" cy="28" r="17"/><path d="M16 92c0-24 14-38 34-38s34 14 34 38z"/>'),
 "target": ("target tujuan goal fokus sasaran", '<circle cx="50" cy="50" r="40" %s/><circle cx="50" cy="50" r="24" %s/><circle cx="50" cy="50" r="7"/>' % (S, S)),
 "arrow": ("panah arrow lanjut arah", '<path %s d="M14 50h66M56 26l26 24-26 24"/>' % S),
}

index = {"version": 1, "assets": []}
for k, (tags, body) in ICONS.items():
    with open(os.path.join(LIB, "icons", k + ".svg"), "w", encoding="utf-8") as f:
        f.write(svg(body))
    index["assets"].append({"id": k, "kind": "icon", "file": "icons/%s.svg" % k, "tags": tags.split(), "tint": True,
                            "license": "CC0-1.0", "author": "Story Engine", "source": "original-starter"})

# ---------------- SFX (sintetis, 44.1kHz mono) ----------------
try:
    import numpy as np
except ImportError:
    np = None
SR = 44100
def write_wav(name, x):
    x = np.clip(x, -1, 1)
    with wave.open(os.path.join(LIB, "sfx", name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
    return round(len(x) / SR, 2)
def t_(d): return np.linspace(0, d, int(SR * d), endpoint=False)
def env(t, a, d): return np.minimum(t / a, 1) * np.exp(-t / d)
def lp(x, k):  # low-pass sederhana
    y = np.zeros_like(x); s = 0
    for i, v in enumerate(x):
        s += k * (v - s); y[i] = s
    return y
if np is not None:
    rng = np.random.default_rng(7)
    SFX = {}
    t = t_(.7); n = rng.standard_normal(len(t)); sweep = np.sin(2 * np.pi * (200 * t + 1500 * t ** 2))
    SFX["whoosh"] = ("whoosh transisi cepat swipe", (lp(n, .08) * 3 + sweep * .3) * np.sin(np.pi * t / .7) ** 1.5 * .6)
    t = t_(.18); SFX["pop"] = ("pop muncul klik bubble", np.sin(2 * np.pi * (900 - 2500 * t) * t) * env(t, .002, .05) * .8)
    t = t_(1.0); SFX["ding"] = ("ding notifikasi sukses bel", (np.sin(2 * np.pi * 1318 * t) + .4 * np.sin(2 * np.pi * 2637 * t)) * env(t, .003, .25) * .5)
    t = t_(.06); SFX["click"] = ("klik click tombol tap", rng.standard_normal(len(t)) * env(t, .001, .008) * .8)
    t = t_(.9); SFX["success"] = ("sukses berhasil success naik", sum(np.sin(2 * np.pi * f * t) * env(np.clip(t - d, 0, None) + (t < d) * 9, .003, .18) * (t >= d) for f, d in [(523, 0), (659, .12), (784, .24), (1047, .36)]) * .35)
    t = t_(3.0); r = lp(rng.standard_normal(len(t)), .5) * 1.2; SFX["rain"] = ("hujan rain air gerimis ambience", r * np.minimum(1, np.minimum(t / .3, (3 - t) / .3)) * .5)
    t = t_(2.2); th = lp(rng.standard_normal(len(t)), .02) * 8; SFX["thunder"] = ("guntur petir thunder badai", th * env(t, .05, .7) * .9)
    t = t_(1.2); SFX["riser"] = ("naik riser ketegangan build transisi", np.sin(2 * np.pi * (150 * t + 400 * t ** 2)) * (t / 1.2) ** 2 * .5 + lp(rng.standard_normal(len(t)), .2) * (t / 1.2) ** 2)
    for k, (tags, x) in SFX.items():
        d = write_wav(k, x)
        index["assets"].append({"id": k, "kind": "sfx", "file": "sfx/%s.wav" % k, "tags": tags.split(), "duration": d,
                                "license": "CC0-1.0", "author": "Story Engine", "source": "original-starter"})
with open(os.path.join(LIB, "index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, indent=1, ensure_ascii=False)
print("OK", len(index["assets"]), "aset")
