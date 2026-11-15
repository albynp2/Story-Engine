"""Definisi tahap pipeline dan validasi input topik."""
import re

from .errors import StageError

# (key, label di UI, engine pemilik)
STAGES = [
    ("topic", "Topic", "ProjectStore"),
    ("research", "Research", "ResearchEngine"),
    ("extract_facts", "Extract Facts", "FactEngine"),
    ("validate_facts", "Validate Facts", "FactEngine"),
    ("script", "Generate Script", "ScriptEngine"),
    ("validate_script", "Validate Script", "ScriptEngine"),
    ("storyboard", "Generate Storyboard", "StoryboardEngine"),
    ("scenes", "Generate Scenes (Google Flow)", "FlowAssistant"),
    ("voiceover", "Voice Over", "VoiceEngine"),
    ("subtitle", "Subtitle", "SubtitleEngine"),
    ("audio_mix", "Audio Mixing", "AudioEngine"),
    ("render", "Final Render", "RenderEngine"),
    ("qc", "Quality Control", "QCEngine"),
]
STAGE_KEYS = [s[0] for s in STAGES]
STAGE_LABEL = {s[0]: s[1] for s in STAGES}
STAGE_ENGINE = {s[0]: s[2] for s in STAGES}

STATUSES = ("pending", "running", "done", "failed", "needs_review")

# semua platform di bawah memakai 9:16 (requirement #18)
PLATFORMS = {
    "tiktok": "TikTok",
    "instagram_reels": "Instagram Reels",
    "facebook_reels": "Facebook Reels",
    "youtube_shorts": "YouTube Shorts",
}
RESOLUTIONS = {"1080x1920": (1080, 1920), "720x1280": (720, 1280), "540x960": (540, 960)}
LANGUAGES = {"id": "Bahasa Indonesia", "en": "English"}


def _int(v, name, lo, hi):
    try:
        n = int(v)
    except (TypeError, ValueError):
        raise StageError("INVALID_INPUT", "%s harus angka" % name)
    if n < lo or n > hi:
        raise StageError("INVALID_INPUT", "%s harus antara %d dan %d" % (name, lo, hi))
    return n


def _text(v, name, maxlen, default=""):
    s = re.sub(r"\s+", " ", str(v if v is not None else "")).strip()
    if not s:
        s = default
    if len(s) > maxlen:
        raise StageError("INVALID_INPUT", "%s terlalu panjang (maks %d karakter)" % (name, maxlen))
    return s


def validate_topic_input(d):
    """Rapikan + validasi form Topic (#3). Lempar StageError(INVALID_INPUT) kalau salah."""
    if not isinstance(d, dict):
        raise StageError("INVALID_INPUT", "body harus JSON object")
    topic = _text(d.get("topic"), "Topik", 200)
    if len(topic.split()) < 3:
        raise StageError("INVALID_INPUT", "Topik terlalu pendek. Tulis topik yang spesifik (minimal 3 kata).")
    lang = str(d.get("language") or "id").lower()
    if lang not in LANGUAGES:
        raise StageError("INVALID_INPUT", "Bahasa harus salah satu dari: " + ", ".join(LANGUAGES))
    platform = str(d.get("platform") or "tiktok").lower()
    if platform not in PLATFORMS:
        raise StageError("INVALID_INPUT", "Platform harus salah satu dari: " + ", ".join(PLATFORMS))
    res = str(d.get("resolution") or "1080x1920")
    if res not in RESOLUTIONS:
        raise StageError("INVALID_INPUT", "Resolusi harus salah satu dari: " + ", ".join(RESOLUTIONS))
    duration = _int(d.get("duration", 60), "Durasi (detik)", 15, 300)
    scenes = _int(d.get("scenes", 9), "Jumlah scene", 3, 40)
    per = duration / float(scenes)
    if per < 2.5 or per > 20:
        raise StageError("INVALID_INPUT",
                         "Rata-rata %.1f detik per scene tidak masuk akal (harus 2,5 sampai 20 detik). "
                         "Ubah durasi atau jumlah scene." % per)
    w, h = RESOLUTIONS[res]
    return {
        "topic": topic,
        "language": lang,
        "duration": duration,
        "scenes": scenes,
        "platform": platform,
        "style": _text(d.get("style"), "Style", 80, "Educational Explainer"),
        "audience": _text(d.get("audience"), "Audience", 80, "General audience"),
        "aspect": "9:16",
        "resolution": res,
        "width": w,
        "height": h,
    }
