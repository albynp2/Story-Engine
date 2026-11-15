"""ProjectStore: satu project = satu folder di disk (sumber kebenaran tunggal).

project/
├── project.json
├── research/ (sources.json, fact_pack.json)
├── script/ (script.json)
├── storyboard/  prompts/  references/  videos/
├── audio/ (voiceover.wav, music.wav, sfx/)
├── subtitles/ (subtitles.srt)
└── output/ (final.mp4)

Tidak menyentuh IndexedDB/localStorage/library milik menu lama.
"""
import json
import os
import re
import shutil
import threading
import time
import unicodedata
import uuid

from .errors import StageError
from .schemas import STAGE_KEYS, STAGE_LABEL, validate_topic_input

SCHEMA_VERSION = 1
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBDIRS = ["research", "script", "storyboard", "prompts", "references", "videos",
           os.path.join("audio", "sfx"), "subtitles", "output"]
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,70}$")
_lock = threading.RLock()


def projects_root():
    """Folder induk semua project. Bisa diganti lewat ENV SE_PROJECTS_DIR."""
    p = os.environ.get("SE_PROJECTS_DIR") or os.path.join(ROOT, "data", "projects")
    os.makedirs(p, exist_ok=True)
    return p


def valid_id(pid):
    return isinstance(pid, str) and bool(_ID_RE.match(pid))


def project_dir(pid):
    """Path folder project. Menolak ID aneh supaya tidak bisa keluar dari folder induk (path traversal)."""
    if not valid_id(pid):
        raise StageError("NOT_FOUND", "ID project tidak valid")
    root = os.path.realpath(projects_root())
    p = os.path.realpath(os.path.join(root, pid))
    if os.path.dirname(p) != root:
        raise StageError("NOT_FOUND", "ID project tidak valid")
    return p


def _slug(text):
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
    return (t[:30].strip("-")) or "project"


def _now():
    return time.time()


def _blank_stages():
    return {k: {"status": "pending", "percent": 0, "message": "", "error_code": "", "error_label": "",
                "error_detail": "", "started_at": None, "finished_at": None,
                "current_scene": None, "total_scenes": None} for k in STAGE_KEYS}


def _write_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)  # atomik: tidak ada project.json setengah tertulis


def create_project(payload):
    topic = validate_topic_input(payload)
    pid = "%s-%s" % (_slug(topic["topic"]), uuid.uuid4().hex[:6])
    with _lock:
        d = project_dir(pid)
        os.makedirs(d)
        for s in SUBDIRS:
            os.makedirs(os.path.join(d, s), exist_ok=True)
        now = _now()
        stages = _blank_stages()
        stages["topic"].update(status="done", percent=100, message="Input topik valid",
                               started_at=now, finished_at=now)
        proj = {"schema_version": SCHEMA_VERSION, "id": pid, "kind": "fact_explainer",
                "created_at": now, "updated_at": now, "topic": topic,
                "stages": stages, "final_status": None}
        _write_json(os.path.join(d, "project.json"), proj)
    return proj


def load(pid):
    d = project_dir(pid)
    path = os.path.join(d, "project.json")
    with _lock:
        if not os.path.exists(path):
            raise StageError("NOT_FOUND", "Project tidak ditemukan")
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except ValueError as e:
            raise StageError("INTERNAL_ERROR", "project.json rusak: %s" % e)


def save(proj):
    with _lock:
        proj["updated_at"] = _now()
        _write_json(os.path.join(project_dir(proj["id"]), "project.json"), proj)


def delete(pid):
    with _lock:
        d = project_dir(pid)
        if not os.path.exists(d):
            raise StageError("NOT_FOUND", "Project tidak ditemukan")
        shutil.rmtree(d)


def update_stage(pid, key, **fields):
    """Ubah state satu tahap (atomik terhadap thread lain). Mengisi started_at/finished_at otomatis."""
    if key not in STAGE_KEYS:
        raise StageError("NOT_FOUND", "Tahap tidak dikenal: %s" % key)
    with _lock:
        proj = load(pid)
        st = proj["stages"][key]
        new = fields.get("status")
        if new == "running" and st["status"] != "running":
            st.update(started_at=_now(), finished_at=None, percent=0, error_code="", error_label="",
                      error_detail="", current_scene=None, total_scenes=None)
            # hasil tahap berikutnya sudah basi kalau tahap ini dijalankan ulang
            for later in STAGE_KEYS[STAGE_KEYS.index(key) + 1:]:
                if proj["stages"][later]["status"] != "pending":
                    proj["stages"][later] = _blank_stages()[later]
            proj["final_status"] = None
        if new in ("done", "failed", "needs_review"):
            st["finished_at"] = _now()
        if new == "done":
            st["percent"] = 100
        st.update(fields)
        save(proj)
        return proj


def _stage_elapsed(st, now):
    if not st.get("started_at"):
        return 0.0
    end = st["finished_at"] if st.get("finished_at") else now
    return max(0.0, end - st["started_at"])


def status_view(proj):
    """Ringkasan untuk panel progress UI: tahap aktif, persen total, elapsed, error."""
    now = _now()
    stages = []
    total = 0.0
    current = None
    err = None
    for i, k in enumerate(STAGE_KEYS):
        st = proj["stages"][k]
        pct = 100 if st["status"] == "done" else (st["percent"] if st["status"] == "running" else 0)
        total += pct
        if st["status"] == "running" and not current:
            current = k
        if st["status"] == "failed" and not err:
            err = {"stage": k, "stage_label": STAGE_LABEL[k], "code": st["error_code"],
                   "label": st["error_label"], "detail": st["error_detail"]}
        stages.append({"key": k, "label": STAGE_LABEL[k], "status": st["status"], "percent": int(pct),
                       "message": st["message"], "current_scene": st["current_scene"],
                       "total_scenes": st["total_scenes"],
                       "elapsed": round(_stage_elapsed(st, now), 1), "error_code": st["error_code"],
                       "error_label": st["error_label"], "error_detail": st["error_detail"]})
    if not current:  # tahap berikutnya yang menunggu
        for s in stages:
            if s["status"] in ("pending", "needs_review", "failed"):
                current = s["key"]
                break
    if err:
        state = "failed"
    elif any(s["status"] == "running" for s in stages):
        state = "running"
    elif any(s["status"] == "needs_review" for s in stages):
        state = "needs_review"
    elif all(s["status"] == "done" for s in stages):
        state = "done"
    else:
        state = "idle"
    return {"id": proj["id"], "state": state, "current_stage": current,
            "percent": int(round(total / len(STAGE_KEYS))),
            "elapsed": round(sum(s["elapsed"] for s in stages), 1),
            "error": err, "final_status": proj.get("final_status"), "stages": stages}


def summary(proj):
    v = status_view(proj)
    t = proj["topic"]
    return {"id": proj["id"], "topic": t["topic"], "language": t["language"], "duration": t["duration"],
            "scenes": t["scenes"], "platform": t["platform"], "created_at": proj["created_at"],
            "updated_at": proj["updated_at"], "state": v["state"], "percent": v["percent"],
            "current_stage": v["current_stage"], "final_status": proj.get("final_status")}


def list_projects():
    out = []
    root = projects_root()
    for name in sorted(os.listdir(root)):
        if not valid_id(name) or not os.path.exists(os.path.join(root, name, "project.json")):
            continue
        try:
            out.append(summary(load(name)))
        except StageError:
            continue  # satu project rusak tidak boleh menjatuhkan seluruh daftar
    out.sort(key=lambda s: s["created_at"], reverse=True)
    return out
