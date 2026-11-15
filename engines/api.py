"""Router REST untuk Fact Explainer. Tidak tahu apa-apa soal HTTP server: handle() menerima
(method, path, body) dan mengembalikan (status_http, dict). server.py hanya meneruskan.

GET    /api/stages
GET    /api/projects
POST   /api/project/create
GET    /api/project/<id>
DELETE /api/project/<id>
GET    /api/project/<id>/status
POST   /api/project/<id>/run/<stage>
"""
import re
import urllib.parse

from . import pipeline, project_store as store
from .errors import HTTP, StageError
from .schemas import (LANGUAGES, PLATFORMS, RESOLUTIONS, STAGES)


def _err(e):
    return HTTP.get(e.code, 500), {"error": str(e), "code": e.code, "label": e.label, "detail": e.detail}


def handle(method, raw_path, body=None):
    path = urllib.parse.urlparse(raw_path).path.rstrip("/")
    try:
        if method == "GET" and path == "/api/stages":
            impl = set(pipeline.implemented())
            return 200, {"stages": [{"key": k, "label": l, "engine": e, "implemented": k in impl or k == "topic"}
                                    for k, l, e in STAGES],
                         "options": {"languages": LANGUAGES, "platforms": PLATFORMS,
                                     "resolutions": list(RESOLUTIONS)}}
        if method == "GET" and path == "/api/projects":
            return 200, {"projects": store.list_projects()}
        if method == "POST" and path == "/api/project/create":
            proj = store.create_project(body or {})
            return 200, {"project": proj, "status": store.status_view(proj)}
        m = re.fullmatch(r"/api/project/([^/]+)(?:/(status|run/([a-z_]+)))?", path)
        if m:
            pid, sub, stage = m.group(1), m.group(2), m.group(3)
            if sub is None and method == "GET":
                proj = store.load(pid)
                return 200, {"project": proj, "status": store.status_view(proj)}
            if sub is None and method == "DELETE":
                store.delete(pid)
                return 200, {"ok": True}
            if sub == "status" and method == "GET":
                return 200, store.status_view(store.load(pid))
            if stage and method == "POST":
                return 200, pipeline.run_stage(pid, stage)
        return 404, {"error": "Endpoint tidak ditemukan", "code": "NOT_FOUND"}
    except StageError as e:
        return _err(e)
