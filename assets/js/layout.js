/* Story Engine - sidebar, topbar, dan status sistem yang sama di semua halaman. */
(function () {
  var I = {
    dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    manual: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
    explainer: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z"/></svg>',
    drama: '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
<<<<<<< HEAD
    fact: '<svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/></svg>',
=======
>>>>>>> 2c3ca03c71db8b4c9842013b69df3211a8f67c2a
    stickman: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><path d="M12 8v8M6 11l6 2 6-2M12 16l-4 6M12 16l4 6"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };
  var NAV = [
    ['dashboard', 'Dashboard', 'dashboard.html'],
    ['manual', 'Manual Footage', 'manual-footage.html'],
    ['explainer', 'Explainer', 'explainer.html'],
    ['drama', 'Drama AI', 'drama-ai.html'],
    ['stickman', 'Stickman', 'stickman.html'],
<<<<<<< HEAD
    ['fact', 'Fact Explainer', 'fact-explainer.html'],
=======
>>>>>>> 2c3ca03c71db8b4c9842013b69df3211a8f67c2a
    ['settings', 'Settings', 'settings.html']
  ];
  var cur = 'dashboard', label = 'Dashboard';
  function setCur() {
    cur = document.body.dataset.mode || document.body.dataset.page || 'dashboard';
    label = (NAV.filter(function (n) { return n[0] === cur; })[0] || NAV[0])[1];
  }

  function sidebar() {
    return '<div class="brand"><div class="brand-mark">SE</div><div><b>STORY</b><strong>ENGINE</strong><small>TOPIK → NASKAH → VIDEO</small></div></div>' +
      '<nav>' + NAV.map(function (n) { return '<a class="nav-item' + (n[0] === cur ? ' active' : '') + '" href="' + n[2] + '">' + I[n[0]] + '<span>' + n[1] + '</span></a>'; }).join('') + '</nav>' +
      '<div class="side-bottom"><div class="sys-mini" id="sysMini"><div class="sys-head"><span>Sistem</span></div><div class="subtle">Memeriksa...</div></div><span class="version">v1.0 · LOCAL</span></div>';
  }
  function topbar() {
    return '<div class="crumb"><span>STORY ENGINE</span><i>/</i><b>' + label + '</b></div><div class="api-pill"><i class="dot" id="topDot"></i><span id="topTxt">memeriksa...</span></div>';
  }
  function row(ok, name, okTxt, badTxt) {
    return '<div><i class="dot ' + (ok ? 'green' : 'red') + '"></i> ' + name + ' <b class="' + (ok ? '' : 'bad') + '">' + (ok ? okTxt : badTxt) + '</b></div>';
  }
  window.seHealth = null;
  function render(h) {
    window.seHealth = h;
    var s = (function () { try { return JSON.parse(localStorage.getItem('se_settings') || '{}'); } catch (e) { return {}; } })();
    var oa = !!(h && (h.openai_env || s.openaiKey));
    var box = document.getElementById('sysMini');
    if (box) box.innerHTML = '<div class="sys-head"><span>Sistem</span></div>' +
      row(!!h, 'Server', 'online', 'offline') +
      row(oa, 'OpenAI', 'siap', 'belum') +
      row(h && h.ffmpeg, 'FFmpeg', 'siap', 'tidak ada') +
      row(h && h.edge, 'Edge TTS', 'siap', 'belum') +
      row(h && h.flow_ext, 'Ekstensi Flow', 'terhubung', 'belum');
    var d = document.getElementById('topDot'), t = document.getElementById('topTxt');
    if (d) d.className = 'dot ' + (h ? 'green' : 'red');
    if (t) t.textContent = h ? ('server online · ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })) : 'server offline';
    document.dispatchEvent(new CustomEvent('se-health', { detail: h }));
  }
  function poll() {
    fetch('/api/health', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(render).catch(function () { render(null); });
  }
  function init() {
    setCur();
    var sb = document.getElementById('sidebar'), tb = document.getElementById('topbar');
    if (sb) sb.innerHTML = sidebar();
    if (tb) tb.innerHTML = topbar();
    poll(); setInterval(poll, 15000);
  }
<<<<<<< HEAD
=======

  /* Tangkap error JS supaya kegagalan tidak diam-diam (muncul banner merah). */
  function errBanner(msg) {
    if (!document.body) return;
    var b = document.getElementById('seErr');
    if (!b) {
      b = document.createElement('div'); b.id = 'seErr';
      b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:70px;z-index:99;max-width:min(720px,92vw);background:#3a1219;border:1px solid #f04452;color:#ffd5da;padding:10px 14px;border-radius:12px;font-size:13px;box-shadow:0 8px 30px #0009';
      b.innerHTML = '<b>Terjadi error.</b> Kirim teks ini ke developer: <div id="seErrMsg" style="margin-top:6px;font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap"></div><button class="g" style="margin-top:8px" onclick="this.parentNode.remove()">Tutup</button>';
      document.body.appendChild(b);
    }
    document.getElementById('seErrMsg').textContent = msg;
  }
  window.addEventListener('error', function (e) {
    if (e.message && /ResizeObserver/.test(e.message)) return;
    errBanner((e.message || 'error') + (e.filename ? '\n' + e.filename.split('/').pop() + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) { errBanner('Promise ditolak: ' + (e.reason && e.reason.message || e.reason)); });
>>>>>>> 2c3ca03c71db8b4c9842013b69df3211a8f67c2a
  window.seToast = function (msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  };
  window.sePoll = poll;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
