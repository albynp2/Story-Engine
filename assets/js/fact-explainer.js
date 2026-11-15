/* Story Engine - halaman Fact Explainer (Fase 1: form topik, daftar project, panel progress).
   Mandiri: hanya butuh layout.js. Tidak memakai/mengubah story-engine.js, modes.js, atau auto.js. */
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var CUR = null, POLL = null, STAGES = [], LAST = null;
  var ICON = { done: '[✓]', running: '[→]', pending: '[ ]', failed: '[✗]', needs_review: '[!]' };
  var STATE_TXT = { idle: 'SIAP', running: 'BERJALAN', failed: 'GAGAL', needs_review: 'PERLU REVIEW', done: 'SELESAI' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]; }); }
  function mmss(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function api(method, path, body) {
    return fetch(path, { method: method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .catch(function (e) { return { ok: false, j: { error: 'Server tidak bisa dihubungi (' + e.message + ')' } }; });
  }
  function toast(m) { if (window.seToast) window.seToast(m); }

  /* ---------- form ---------- */
  function fillSelect(id, map, def) {
    var el = $(id);
    el.innerHTML = Object.keys(map).map(function (k) { return '<option value="' + esc(k) + '">' + esc(map[k]) + '</option>'; }).join('');
    if (def) el.value = def;
  }
  function perScene() {
    var d = parseInt($('fxDur').value, 10), n = parseInt($('fxScenes').value, 10), el = $('fxPer');
    if (!d || !n) { el.textContent = 'Rata-rata detik per scene'; return; }
    var p = d / n, bad = p < 2.5 || p > 20;
    el.textContent = 'Rata-rata ' + p.toFixed(1) + ' detik per scene' + (bad ? ' (di luar 2,5 sampai 20)' : '');
    el.style.color = bad ? '#ff7683' : '';
  }
  async function createProject() {
    var err = $('fxErr'); err.textContent = '';
    var body = {
      topic: $('fxTopic').value, language: $('fxLang').value, duration: $('fxDur').value, scenes: $('fxScenes').value,
      platform: $('fxPlat').value, resolution: $('fxRes').value, style: $('fxStyle').value, audience: $('fxAud').value
    };
    $('fxCreate').disabled = true;
    var r = await api('POST', '/api/project/create', body);
    $('fxCreate').disabled = false;
    if (!r.ok) { err.textContent = (r.j.label ? r.j.label + ': ' : '') + (r.j.detail || r.j.error || 'Gagal membuat project'); return; }
    toast('Project dibuat');
    $('fxTopic').value = '';
    await loadList();
    openProject(r.j.project.id);
  }

  /* ---------- daftar project ---------- */
  async function loadList() {
    var r = await api('GET', '/api/projects'), box = $('fxList');
    if (!r.ok) { box.innerHTML = '<div class="empty err">' + esc(r.j.error || 'Gagal memuat daftar project') + '</div>'; return; }
    var L = r.j.projects || [];
    if (!L.length) { box.innerHTML = '<div class="empty">Belum ada project. Buat yang pertama di atas.</div>'; return; }
    box.innerHTML = L.map(function (p) {
      return '<div class="fx-proj' + (p.id === CUR ? ' sel' : '') + '" data-id="' + esc(p.id) + '">' +
        '<div><div class="t">' + esc(p.topic) + '</div><div class="s">' + esc(p.duration) + ' dtk · ' + esc(p.scenes) + ' scene · ' + esc(p.platform) + ' · ' + new Date(p.created_at * 1000).toLocaleString('id-ID') + '</div></div>' +
        '<span class="badge">' + (STATE_TXT[p.state] || p.state) + ' ' + p.percent + '%</span>' +
        '<div class="fx-bar' + (p.state === 'done' ? ' ok' : '') + '"><i style="width:' + p.percent + '%"></i></div></div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.fx-proj'), function (el) {
      el.onclick = function () { openProject(el.getAttribute('data-id')); };
    });
  }

  /* ---------- detail + progress ---------- */
  async function openProject(id) {
    CUR = id; stopPoll();
    var r = await api('GET', '/api/project/' + encodeURIComponent(id));
    if (!r.ok) { $('fxErr').textContent = r.j.error || 'Project tidak ditemukan'; CUR = null; loadList(); return; }
    var t = r.j.project.topic;
    $('fxDetail').style.display = 'block';
    $('fxTitle').textContent = t.topic;
    $('fxMeta').innerHTML = [['Bahasa', t.language === 'en' ? 'English' : 'Bahasa Indonesia'], ['Durasi', t.duration + ' detik'], ['Scene', t.scenes],
      ['Platform', t.platform], ['Format', t.aspect + ' · ' + t.resolution], ['Style', t.style], ['Audience', t.audience]]
      .map(function (x) { return '<span>' + x[0] + ': <b>' + esc(x[1]) + '</b></span>'; }).join('');
    $('fxPath').textContent = 'Folder project: data/projects/' + id + '/';
    renderStatus(r.j.status);
    loadList();
    $('fxDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderStatus(v) {
    LAST = v;
    $('fxState').textContent = STATE_TXT[v.state] || v.state;
    $('fxBarAll').style.width = v.percent + '%';
    $('fxBarAll').parentNode.className = 'fx-bar big' + (v.state === 'done' ? ' ok' : '');
    var cur = v.stages.filter(function (s) { return s.key === v.current_stage; })[0];
    var line = '<b>' + v.percent + '%</b>';
    if (cur) line += ' · tahap: <b>' + esc(cur.label) + '</b>';
    if (cur && cur.status === 'running' && cur.total_scenes) line += ' · scene <b>' + (cur.current_scene || 0) + '/' + cur.total_scenes + '</b>';
    line += ' · waktu kerja <b>' + mmss(v.elapsed) + '</b>';
    if (v.final_status) line += ' · FINAL STATUS = <b>' + esc(v.final_status) + '</b>';
    $('fxOverallTxt').innerHTML = line;
    var eb = $('fxStageErr');
    if (v.error) {
      eb.style.display = 'block';
      eb.innerHTML = '<b>' + esc(v.error.label || v.error.code) + '</b> pada tahap ' + esc(v.error.stage_label) + (v.error.detail ? '<br>' + esc(v.error.detail) : '') + '<br><span class="subtle">Pipeline berhenti di sini. Perbaiki penyebabnya lalu jalankan tahap ini lagi.</span>';
    } else eb.style.display = 'none';

    var impl = {}; STAGES.forEach(function (s) { impl[s.key] = s.implemented; });
    var prevDone = true;
    $('fxStages').innerHTML = v.stages.map(function (s, i) {
      var canRun = prevDone && impl[s.key] && s.key !== 'topic' && v.state !== 'running';
      var act;
      if (s.key === 'topic') act = '';
      else if (!impl[s.key]) act = '<small>belum tersedia</small>';
      else if (s.status === 'running') act = '<small>berjalan</small>';
      else if (canRun) act = '<button data-run="' + s.key + '">' + (s.status === 'done' || s.status === 'failed' ? 'Jalankan ulang' : 'Jalankan') + '</button>';
      else act = '<small>menunggu tahap sebelumnya</small>';
      var sub = s.status === 'failed' ? '<div class="fx-sub err">' + esc(s.error_label) + (s.error_detail ? ': ' + esc(s.error_detail) : '') + '</div>'
        : (s.message ? '<div class="fx-sub">' + esc(s.message) + (s.status === 'running' && s.total_scenes ? ' (scene ' + (s.current_scene || 0) + '/' + s.total_scenes + ')' : '') + '</div>' : '');
      var bar = s.status === 'running' ? '<div class="fx-bar"><i style="width:' + s.percent + '%"></i></div>' : '';
      var el = '<div class="fx-st ' + s.status + '"><div class="fx-ic">' + (ICON[s.status] || '[ ]') + '</div><div><div class="fx-nm">' + (i + 1) + '. ' + esc(s.label) + (s.status === 'running' ? ' · ' + s.percent + '%' : '') + (s.elapsed ? ' <span class="subtle">(' + mmss(s.elapsed) + ')</span>' : '') + '</div>' + sub + bar + '</div><div class="fx-act">' + act + '</div></div>';
      if (s.status !== 'done') prevDone = false;
      return el;
    }).join('');
    Array.prototype.forEach.call($('fxStages').querySelectorAll('button[data-run]'), function (b) {
      b.onclick = function () { runStage(b.getAttribute('data-run')); };
    });
    if (v.state === 'running') startPoll(); else stopPoll();
  }
  function startPoll() {
    if (POLL) return;
    POLL = setInterval(async function () {
      if (!CUR) return stopPoll();
      var r = await api('GET', '/api/project/' + encodeURIComponent(CUR) + '/status');
      if (r.ok) { var was = LAST && LAST.state; renderStatus(r.j); if (was === 'running' && r.j.state !== 'running') loadList(); }
    }, 1200);
  }
  function stopPoll() { if (POLL) { clearInterval(POLL); POLL = null; } }
  async function runStage(key) {
    $('fxErr').textContent = '';
    var r = await api('POST', '/api/project/' + encodeURIComponent(CUR) + '/run/' + key, {});
    if (!r.ok) { $('fxErr').textContent = (r.j.label ? r.j.label + ': ' : '') + (r.j.detail || r.j.error); return; }
    var s = await api('GET', '/api/project/' + encodeURIComponent(CUR) + '/status');
    if (s.ok) renderStatus(s.j);
    loadList();
  }
  async function delProject() {
    if (!CUR || !confirm('Hapus project ini beserta seluruh filenya di disk?')) return;
    var r = await api('DELETE', '/api/project/' + encodeURIComponent(CUR));
    if (!r.ok) { $('fxErr').textContent = r.j.error || 'Gagal menghapus'; return; }
    CUR = null; stopPoll(); $('fxDetail').style.display = 'none'; toast('Project dihapus'); loadList();
  }

  async function init() {
    var r = await api('GET', '/api/stages');
    if (r.ok) {
      STAGES = r.j.stages;
      var o = r.j.options;
      fillSelect('fxLang', o.languages, 'id');
      fillSelect('fxPlat', o.platforms, 'tiktok');
      var res = {}; o.resolutions.forEach(function (x) { res[x] = x.replace('x', ' × '); });
      fillSelect('fxRes', res, '1080x1920');
    } else $('fxErr').textContent = r.j.error || 'Fact Explainer tidak aktif di server ini';
    $('fxCreate').onclick = createProject;
    $('fxDel').onclick = delProject;
    $('fxDur').oninput = $('fxScenes').oninput = perScene;
    $('fxTopic').onkeydown = function (e) { if (e.key === 'Enter') createProject(); };
    perScene();
    loadList();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
