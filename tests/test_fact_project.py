"""Tes Fase 1 Fact Explainer: ProjectStore, runner pipeline, dan API HTTP.
Jalankan: python tests/test_fact_project.py   (atau: python -m unittest tests.test_fact_project)
Memakai folder sementara, tidak menyentuh data/ asli.
"""
import json
import os
import shutil
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
TMP = tempfile.mkdtemp(prefix="se-proj-")
os.environ["SE_PROJECTS_DIR"] = TMP

import server  # noqa: E402
from engines import pipeline, project_store as store  # noqa: E402
from engines.errors import StageError  # noqa: E402
from engines.schemas import STAGE_KEYS  # noqa: E402

GOOD = {"topic": "Sejarah Kadupandak Cianjur", "language": "id", "duration": 60, "scenes": 9,
        "platform": "tiktok", "style": "Educational Explainer", "audience": "General audience"}


def wait_for(pid, pred, timeout=5):
    t0 = time.time()
    while time.time() - t0 < timeout:
        v = store.status_view(store.load(pid))
        if pred(v):
            return v
        time.sleep(0.05)
    raise AssertionError("timeout menunggu status")


class StoreTests(unittest.TestCase):
    def setUp(self):
        pipeline.HANDLERS.clear()

    def test_create_makes_folder_structure(self):
        p = store.create_project(GOOD)
        d = store.project_dir(p["id"])
        for sub in ["research", "script", "storyboard", "prompts", "references", "videos",
                    "audio/sfx", "subtitles", "output"]:
            self.assertTrue(os.path.isdir(os.path.join(d, sub)), sub)
        self.assertTrue(os.path.isfile(os.path.join(d, "project.json")))
        self.assertEqual(p["stages"]["topic"]["status"], "done")
        self.assertEqual(p["topic"]["aspect"], "9:16")
        self.assertEqual((p["topic"]["width"], p["topic"]["height"]), (1080, 1920))

    def test_invalid_input_rejected(self):
        bad = [
            dict(GOOD, topic="Kadupandak"),                 # < 3 kata
            dict(GOOD, language="fr"),
            dict(GOOD, platform="myspace"),
            dict(GOOD, duration=5),
            dict(GOOD, duration=60, scenes=1),
            dict(GOOD, duration=300, scenes=3),             # 100 detik per scene
            dict(GOOD, resolution="1x1"),
            dict(GOOD, scenes="abc"),
        ]
        for b in bad:
            with self.assertRaises(StageError) as c:
                store.create_project(b)
            self.assertEqual(c.exception.code, "INVALID_INPUT", b)

    def test_path_traversal_blocked(self):
        for pid in ["../etc", "..", "a/b", "", "A-B-C", "x" * 100]:
            with self.assertRaises(StageError):
                store.project_dir(pid)

    def test_list_and_delete(self):
        a = store.create_project(GOOD)
        ids = [s["id"] for s in store.list_projects()]
        self.assertIn(a["id"], ids)
        # project rusak tidak menjatuhkan daftar
        bad = os.path.join(store.projects_root(), "rusak-123456")
        os.makedirs(bad)
        open(os.path.join(bad, "project.json"), "w").write("{bukan json")
        self.assertIn(a["id"], [s["id"] for s in store.list_projects()])
        store.delete(a["id"])
        self.assertNotIn(a["id"], [s["id"] for s in store.list_projects()])
        with self.assertRaises(StageError):
            store.load(a["id"])

    def test_status_view_initial(self):
        p = store.create_project(GOOD)
        v = store.status_view(p)
        self.assertEqual(v["state"], "idle")
        self.assertEqual(v["current_stage"], "research")
        self.assertEqual(v["percent"], round(100 / len(STAGE_KEYS)))
        self.assertEqual([s["status"] for s in v["stages"]][:2], ["done", "pending"])


class RunnerTests(unittest.TestCase):
    def setUp(self):
        pipeline.HANDLERS.clear()
        self.p = store.create_project(GOOD)
        self.pid = self.p["id"]

    def test_not_implemented_does_not_change_state(self):
        with self.assertRaises(StageError) as c:
            pipeline.run_stage(self.pid, "research")
        self.assertEqual(c.exception.code, "NOT_IMPLEMENTED")
        self.assertEqual(store.load(self.pid)["stages"]["research"]["status"], "pending")

    def test_prerequisite_enforced(self):
        pipeline.register("script", lambda ctx: None)
        with self.assertRaises(StageError) as c:
            pipeline.run_stage(self.pid, "script")  # research..validate_facts belum done
        self.assertEqual(c.exception.code, "PREREQUISITE_MISSING")

    def test_success_with_progress(self):
        def h(ctx):
            ctx.update(percent=40, message="separuh jalan", scene=2, total_scenes=5)
            time.sleep(0.2)
        pipeline.register("research", h)
        pipeline.run_stage(self.pid, "research")
        v = wait_for(self.pid, lambda v: v["stages"][1]["percent"] == 40)
        self.assertEqual(v["state"], "running")
        self.assertEqual(v["current_stage"], "research")
        self.assertEqual(v["stages"][1]["current_scene"], 2)
        v = wait_for(self.pid, lambda v: v["stages"][1]["status"] == "done")
        self.assertEqual(v["stages"][1]["percent"], 100)

    def test_stage_error_is_recorded_and_blocks_next(self):
        def boom(ctx):
            raise StageError("SOURCE_UNAVAILABLE", "SRC-002 timeout")
        pipeline.register("research", boom)
        pipeline.register("extract_facts", lambda ctx: None)
        pipeline.run_stage(self.pid, "research")
        v = wait_for(self.pid, lambda v: v["state"] == "failed")
        self.assertEqual(v["error"]["label"], "SOURCE UNAVAILABLE")
        self.assertEqual(v["error"]["detail"], "SRC-002 timeout")
        with self.assertRaises(StageError) as c:  # tidak boleh lanjut diam-diam
            pipeline.run_stage(self.pid, "extract_facts")
        self.assertEqual(c.exception.code, "PREREQUISITE_MISSING")

    def test_unexpected_exception_recorded_not_swallowed(self):
        pipeline.register("research", lambda ctx: 1 / 0)
        pipeline.run_stage(self.pid, "research", background=False)
        st = store.load(self.pid)["stages"]["research"]
        self.assertEqual(st["status"], "failed")
        self.assertEqual(st["error_code"], "INTERNAL_ERROR")
        self.assertIn("ZeroDivisionError", st["error_detail"])

    def test_rerun_resets_later_stages(self):
        pipeline.register("research", lambda ctx: None)
        pipeline.register("extract_facts", lambda ctx: None)
        pipeline.run_stage(self.pid, "research", background=False)
        pipeline.run_stage(self.pid, "extract_facts", background=False)
        self.assertEqual(store.load(self.pid)["stages"]["extract_facts"]["status"], "done")
        pipeline.run_stage(self.pid, "research", background=False)  # ulang: hasil tahap berikut jadi basi
        self.assertEqual(store.load(self.pid)["stages"]["extract_facts"]["status"], "pending")

    def test_only_one_running(self):
        gate = threading.Event()
        pipeline.register("research", lambda ctx: gate.wait(3))
        pipeline.register("extract_facts", lambda ctx: None)
        pipeline.run_stage(self.pid, "research")
        wait_for(self.pid, lambda v: v["state"] == "running")
        with self.assertRaises(StageError) as c:
            pipeline.run_stage(self.pid, "research")
        self.assertEqual(c.exception.code, "ALREADY_RUNNING")
        gate.set()
        wait_for(self.pid, lambda v: v["stages"][1]["status"] == "done")

    def test_needs_review(self):
        pipeline.register("research", lambda ctx: {"status": "needs_review", "message": "cek sumber"})
        pipeline.run_stage(self.pid, "research", background=False)
        v = store.status_view(store.load(self.pid))
        self.assertEqual(v["state"], "needs_review")


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), server.H)
        cls.B = "http://127.0.0.1:%d" % cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def req(self, method, path, obj=None, hdr=None):
        h = {"Content-Type": "application/json"}
        h.update(hdr or {})
        r = urllib.request.Request(self.B + path, method=method, headers=h,
                                   data=json.dumps(obj).encode() if obj is not None else None)
        try:
            with urllib.request.urlopen(r) as x:
                return x.status, json.loads(x.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_full_flow(self):
        pipeline.HANDLERS.clear()
        st, j = self.req("GET", "/api/stages")
        self.assertEqual(st, 200)
        self.assertEqual([s["key"] for s in j["stages"]], STAGE_KEYS)
        self.assertTrue(j["stages"][0]["implemented"])
        self.assertFalse(j["stages"][1]["implemented"])
        st, j = self.req("POST", "/api/project/create", GOOD)
        self.assertEqual(st, 200)
        pid = j["project"]["id"]
        st, j = self.req("GET", "/api/project/" + pid + "/status")
        self.assertEqual((st, j["state"]), (200, "idle"))
        st, j = self.req("POST", "/api/project/%s/run/research" % pid, {})
        self.assertEqual((st, j["code"]), (501, "NOT_IMPLEMENTED"))
        st, j = self.req("GET", "/api/projects")
        self.assertIn(pid, [p["id"] for p in j["projects"]])
        st, j = self.req("DELETE", "/api/project/" + pid)
        self.assertEqual((st, j["ok"]), (200, True))
        st, j = self.req("GET", "/api/project/" + pid)
        self.assertEqual(st, 404)

    def test_validation_and_bad_json(self):
        st, j = self.req("POST", "/api/project/create", dict(GOOD, topic="halo"))
        self.assertEqual((st, j["code"]), (400, "INVALID_INPUT"))
        r = urllib.request.Request(self.B + "/api/project/create", data=b"{rusak", method="POST",
                                   headers={"Content-Type": "application/json"})
        with self.assertRaises(urllib.error.HTTPError) as c:
            urllib.request.urlopen(r)
        self.assertEqual(c.exception.code, 400)

    def test_foreign_origin_rejected_on_write(self):
        st, j = self.req("POST", "/api/project/create", GOOD, {"Origin": "https://evil.example"})
        self.assertEqual(st, 403)
        st, j = self.req("POST", "/api/project/create", GOOD, {"Origin": "http://localhost:8000"})
        self.assertEqual(st, 200)

    def test_traversal_via_http(self):
        st, j = self.req("GET", "/api/project/..%2F..%2Fetc")
        self.assertIn(st, (404, 400))


def tearDownModule():
    shutil.rmtree(TMP, ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
