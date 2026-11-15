"""Kode error pipeline Fact Explainer.

Pipeline TIDAK boleh lanjut diam-diam kalau tahap penting gagal: setiap kegagalan
punya kode + label yang tampil apa adanya di UI.
"""

LABELS = {
    # label persis dari requirement (#20)
    "RESEARCH_FAILED": "RESEARCH FAILED",
    "SOURCE_UNAVAILABLE": "SOURCE UNAVAILABLE",
    "FACT_UNVERIFIED": "FACT UNVERIFIED",
    "FACT_CONFLICT": "FACT CONFLICT",
    "SCRIPT_GENERATION_FAILED": "SCRIPT GENERATION FAILED",
    "SCENE_VIDEO_MISSING": "SCENE VIDEO MISSING",
    # kode umum framework
    "INVALID_INPUT": "INVALID INPUT",
    "NOT_FOUND": "NOT FOUND",
    "NOT_IMPLEMENTED": "STAGE NOT AVAILABLE YET",
    "PREREQUISITE_MISSING": "PREVIOUS STAGE NOT FINISHED",
    "ALREADY_RUNNING": "ALREADY RUNNING",
    "INTERNAL_ERROR": "INTERNAL ERROR",
}


class StageError(Exception):
    """Dilempar engine/handler. code harus salah satu kunci LABELS."""

    def __init__(self, code, detail=""):
        self.code = code if code in LABELS else "INTERNAL_ERROR"
        self.detail = str(detail or "")
        super().__init__(self.label + (": " + self.detail if self.detail else ""))

    @property
    def label(self):
        return LABELS[self.code]


# status HTTP untuk error yang dikembalikan langsung oleh API
HTTP = {"INVALID_INPUT": 400, "NOT_FOUND": 404, "NOT_IMPLEMENTED": 501,
        "PREREQUISITE_MISSING": 409, "ALREADY_RUNNING": 409}
