"""Runner tahap pipeline.

Tiap engine mendaftarkan handler untuk tahapnya lewat register(). Runner yang menjaga aturan:
- tahap hanya boleh jalan kalau SEMUA tahap sebelumnya 'done' (tidak lanjut diam-diam),
- satu project hanya satu tahap berjalan,
- kegagalan selalu tercatat dengan kode error (tidak ada exception yang ditelan),
- progress (persen, pesan, scene aktif) ditulis ke project.json supaya UI bisa polling.

Fase 1: belum ada handler terdaftar, jadi semua tahap setelah Topic menjawab NOT_IMPLEMENTED
tanpa mengubah state project.
"""
import threading
import traceback

from . import project_store as store
from .errors import LABELS, StageError
from .schemas import STAGE_KEYS, STAGE_LABEL, STAGE_ENGINE

HANDLERS = {}


def register(stage, fn):
    """fn(ctx) -> None | {"status": "needs_review", "message": "..."}"""
    if stage not in STAGE_KEYS or stage == "topic":
        raise ValueError("tahap tidak valid: %s" % stage)
    HANDLERS[stage] = fn


def implemented():
    return sorted(HANDLERS, key=STAGE_KEYS.index)


class Ctx:
    """Objek yang diterima handler: lokasi project + pelapor progress."""

    def __init__(self, pid, stage):
        self.project_id = pid
        self.stage = stage
        self.dir = store.project_dir(pid)

    def project(self):
        return store.load(self.project_id)

    def update(self, percent=None, message=None, scene=None, total_scenes=None):
        f = {}
        if percent is not None:
            f["percent"] = max(0, min(99, int(percent)))  # 100 hanya diisi runner saat 'done'
        if message is not None:
            f["message"] = str(message)[:300]
        if scene is not None:
            f["current_scene"] = int(scene)
        if total_scenes is not None:
            f["total_scenes"] = int(total_scenes)
        if f:
            store.update_stage(self.project_id, self.stage, **f)


def _check_can_run(proj, stage):
    if stage not in STAGE_KEYS or stage == "topic":
        raise StageError("NOT_FOUND", "Tahap tidak dikenal: %s" % stage)
    if stage not in HANDLERS:
        raise StageError("NOT_IMPLEMENTED",
                         "%s (%s) belum tersedia di versi ini." % (STAGE_LABEL[stage], STAGE_ENGINE[stage]))
    for k in STAGE_KEYS:
        if proj["stages"][k]["status"] == "running":
            raise StageError("ALREADY_RUNNING", "Tahap '%s' masih berjalan." % STAGE_LABEL[k])
    for k in STAGE_KEYS[:STAGE_KEYS.index(stage)]:
        if proj["stages"][k]["status"] != "done":
            raise StageError("PREREQUISITE_MISSING",
                             "Selesaikan dulu tahap '%s' (status: %s)." % (STAGE_LABEL[k], proj["stages"][k]["status"]))


def _execute(pid, stage):
    ctx = Ctx(pid, stage)
    try:
        res = HANDLERS[stage](ctx)
        if isinstance(res, dict) and res.get("status") == "needs_review":
            store.update_stage(pid, stage, status="needs_review", percent=100, message=res.get("message", ""))
        else:
            store.update_stage(pid, stage, status="done", message=(res or {}).get("message", "Selesai")
                               if isinstance(res, dict) else "Selesai")
    except StageError as e:
        store.update_stage(pid, stage, status="failed", error_code=e.code, error_label=e.label,
                           error_detail=e.detail, message=e.label)
    except Exception as e:  # noqa - sengaja ditangkap lalu DICATAT, bukan ditelan
        traceback.print_exc()
        store.update_stage(pid, stage, status="failed", error_code="INTERNAL_ERROR",
                           error_label=LABELS["INTERNAL_ERROR"], error_detail="%s: %s" % (type(e).__name__, e),
                           message=LABELS["INTERNAL_ERROR"])


def run_stage(pid, stage, background=True):
    """Mulai satu tahap. Lempar StageError kalau tidak boleh jalan; selain itu hasilnya ada di project.json."""
    with store._lock:
        proj = store.load(pid)
        _check_can_run(proj, stage)
        store.update_stage(pid, stage, status="running", message="Memulai...")
    if background:
        threading.Thread(target=_execute, args=(pid, stage), daemon=True).start()
    else:
        _execute(pid, stage)
    return {"ok": True, "stage": stage}
