/* Story Engine - Dashboard: statistik pembuatan video + daftar video per menu dan tanggal. */
var MENUS = [['manual', 'Manual Footage'], ['explainer', 'Explainer'], ['drama', 'Drama AI'], ['stickman', 'Stickman'], ['legacy', 'Menu lama']];

function dKey(iso) { var d = new Date(iso); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dMenu(m) { return CONTENT[m] ? m : 'legacy'; }
function dLabel(k) { return (MENUS.filter(function (x) { return x[0] === k; })[0] || [0, k])[1]; }
function getLog() {
  return openDB().then(function (db) {
    return new Promise(function (res, rej) { var r = db.transaction('log').objectStore('log').getAll(); r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; });
  });
}
function dRange() {
  var f = $('dFrom').value, t = $('dTo').value;
  return function (iso) { var k = dKey(iso); return (!f || k >= f) && (!t || k <= t); };
}
function dayName(k) {
  var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function renderDashboard() {
  var box = $('dashList'); if (!box) return;
  box.innerHTML = '<div class="empty">Memuat...</div>';
  Promise.all([getLog(), getVideos()]).then(function (R) {
    var log = R[0], vids = R[1], inR = dRange();
    var now = new Date(), today = dKey(now.toISOString());
    var wk = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), mo = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var cToday = 0, cWeek = 0, cMonth = 0;
    log.forEach(function (l) {
      var k = dKey(l.createdAt), d = new Date(l.createdAt);
      if (k === today) cToday++;
      if (d >= wk) cWeek++;
      if (k.slice(0, 7) === mo) cMonth++;
    });
    $('stToday').textContent = cToday; $('stWeek').textContent = cWeek; $('stMonth').textContent = cMonth; $('stAll').textContent = log.length;

    /* grafik 14 hari */
    var days = [], cnt = {};
    for (var i = 13; i >= 0; i--) { var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); days.push(dKey(d.toISOString())); }
    log.forEach(function (l) { var k = dKey(l.createdAt); cnt[k] = (cnt[k] || 0) + 1; });
    var mx = Math.max.apply(null, days.map(function (k) { return cnt[k] || 0; }).concat([1]));
    $('dChart').innerHTML = days.map(function (k) {
      var v = cnt[k] || 0, p = k.split('-');
      return '<div class="col"><i>' + (v || '') + '</i><div class="bar" style="height:' + Math.round(v / mx * 120) + 'px" title="' + k + ': ' + v + ' video"></div><small>' + p[2] + '/' + p[1] + '</small></div>';
    }).join('');

    /* total per menu (ikut filter tanggal) */
    var per = {}; MENUS.forEach(function (m) { per[m[0]] = 0; });
    var fl = log.filter(function (l) { return inR(l.createdAt); });
    fl.forEach(function (l) { per[dMenu(l.mode)]++; });
    $('dSplit').innerHTML = MENUS.filter(function (m) { return m[0] !== 'legacy' || per.legacy; }).map(function (m) { return '<div><small class="subtle">' + m[1] + '</small><b>' + per[m[0]] + '</b></div>'; }).join('');
    $('dCount').textContent = fl.length + ' video tercatat' + ((($('dFrom').value) || ($('dTo').value)) ? ' pada rentang tanggal ini' : '') + ' · ' + vids.length + ' masih tersimpan';

    /* daftar: menu -> tanggal */
    var vf = vids.filter(function (v) { return inR(v.createdAt); });
    if (!vf.length) { box.innerHTML = '<div class="empty">Belum ada video tersimpan' + (vids.length ? ' pada rentang ini' : '. Generate video dari salah satu menu untuk masuk ke sini') + '.</div>'; return; }
    var html = '';
    MENUS.forEach(function (m) {
      var L = vf.filter(function (v) { return dMenu(v.mode) === m[0]; });
      if (!L.length) return;
      var byDay = {}; L.forEach(function (v) { (byDay[dKey(v.createdAt)] = byDay[dKey(v.createdAt)] || []).push(v); });
      html += '<details class="group" open><summary>' + esc(m[1]) + '<span class="badge">' + L.length + ' video</span></summary><div class="inner">' +
        Object.keys(byDay).sort().reverse().map(function (k) {
          return '<div class="day"><h4>' + esc(dayName(k)) + ' · ' + byDay[k].length + ' video</h4><div class="dash-grid">' + byDay[k].map(videoCard).join('') + '</div></div>';
        }).join('') + '</div></details>';
    });
    box.innerHTML = html;
  }).catch(function (e) { box.innerHTML = '<div class="empty">Dashboard gagal dibuka: ' + esc(e.message) + '</div>'; });
}
function videoCard(v) {
  return '<article class="video-card"><video controls playsinline preload="none" src="' + URL.createObjectURL(v.blob) + '"></video>' +
    '<div class="video-meta"><div><div class="video-title">' + esc(v.title) + '</div><div class="video-sub">' + esc(v.formatLabel) + ' • ' + new Date(v.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + '</div></div><span class="badge">' + v.scenes + ' scene</span></div>' +
    '<div class="video-copy"><label class="f">Caption<textarea readonly id="dc' + v.id + '">' + esc(v.caption) + '</textarea></label><button class="g" onclick="copyTextValue(\'dc' + v.id + '\')">Copy caption</button>' +
    '<label class="f" style="margin-top:8px">Hashtag<textarea readonly id="dh' + v.id + '" style="min-height:55px">' + esc(v.hashtags) + '</textarea></label><button class="g" onclick="copyTextValue(\'dh' + v.id + '\')">Copy hashtag</button></div>' +
    '<div class="row" style="margin-top:8px"><button class="g" onclick="downloadStored(\'' + v.id + '\')">Download</button><button class="g" onclick="removeStored(\'' + v.id + '\')">Hapus</button></div></article>';
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderDashboard); else renderDashboard();
