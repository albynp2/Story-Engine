/* Story Engine - pipeline otomatis, backsound (ducking), SFX, meme, kamera cepat, pemeriksaan fakta.
   Dimuat SETELAH story-engine.js */

var BKR = 0, BKB = null, SFXB = {}, MEMEIMG = null, BKS = null, LIBIDX = null;

/* ---------- library (server) ---------- */
function libLoad() {
  return fetch('/library/index.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
    .then(function (j) { LIBIDX = j; return j; }).catch(function () { LIBIDX = { assets: [] }; return LIBIDX; });
}
function libAssets(kind) { return ((LIBIDX && LIBIDX.assets) || []).filter(function (a) { return a.kind === kind; }); }
function libFile(a) { return '/library/' + a.file; }
function fillSelect(id, kind, noneText) {
  var el = $(id); if (!el) return;
  var old = el.value;
  el.innerHTML = '<option value="none">' + (noneText || 'Tidak pakai') + '</option>' +
    libAssets(kind).map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.id) + (a.tags && a.tags.length ? ' (' + esc(a.tags.slice(0, 3).join(', ')) + ')' : '') + '</option>'; }).join('');
  if (old) el.value = old;
  if (!el.value) el.value = 'none';
}
function decodeAsset(ctx, a) {
  return fetch(libFile(a)).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return ctx.decodeAudioData(b); });
}

/* ---------- kamera & meme (dipakai render) ---------- */
function curStick() { var p = CONTENT[$('mode').value]; return !!(p && p.stick); }
function camFx(k, p, now) {
  var s = (D && D.scenes[k]) || {}, c = String(s.camera || '').toLowerCase(), z = 1 + 0.08 * (k % 2 ? 1 - p : p);
  if (!c || !curStick()) return { z: z, dx: 0, dy: 0 };
  var e = 1 - Math.pow(1 - Math.min(1, p * 1.6), 3), dx = 0, dy = 0;
  if (c === 'zoom_in') z = 1.02 + 0.22 * e;
  else if (c === 'zoom_out') z = 1.24 - 0.22 * e;
  else if (c === 'shake') { z = 1.1; var t = now * 38; dx = Math.sin(t) * 0.012; dy = Math.cos(t * 1.3) * 0.01; }
  else if (c === 'pan_left') { z = 1.18; dx = 0.05 - 0.1 * p; }
  else if (c === 'pan_right') { z = 1.18; dx = -0.05 + 0.1 * p; }
  else if (c === 'whip') { z = 1.12 + 0.1 * (1 - e); dx = (1 - e) * 0.08; }
  return { z: z, dx: dx, dy: dy };
}
function memeDraw(c, W, H, k, t) {
  if (!MEMEIMG || !D || t > 1.5) return;
  var r = String((D.scenes[k] || {}).reaction || '').toLowerCase(), im = MEMEIMG[r];
  if (!im || !im.naturalWidth) return;
  var e = Math.min(1, t / 0.2), sc = 0.2 + 0.8 * (1 - Math.pow(1 - e, 3)), m = Math.min(W, H) * 0.36 * sc;
  var w = m, h = m * im.naturalHeight / im.naturalWidth;
  c.save(); c.translate(W * 0.97 - w / 2, H * 0.14 + h / 2); c.rotate(-0.1); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore();
}

/* ---------- backsound + SFX ---------- */
function bkSelection() {
  var id = $('bkSel') ? $('bkSel').value : 'none';
  var vol = (parseInt($('bkVol') ? $('bkVol').value : 18) || 18) / 100;
  return { id: id, vol: Math.max(0.02, Math.min(0.6, vol)) };
}
function bkPrep() {
  BKB = null; SFXB = {}; MEMEIMG = null;
  return libLoad().then(function () {
    var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(), jobs = [];
    var sel = bkSelection();
    if (sel.id !== 'none') {
      var a = libAssets('bgm').filter(function (x) { return x.id === sel.id; })[0];
      if (a) jobs.push(decodeAsset(ctx, a).then(function (b) { BKB = b; }).catch(function () { }));
    }
    var ids = {};
    if ($('sfxSel') && $('sfxSel').value !== 'none') ids[$('sfxSel').value] = 1;
    if (D && curStick()) D.scenes.forEach(function (s) { var x = String(s.sfx || '').toLowerCase(); if (x && x !== 'none') ids[x] = 1; });
    Object.keys(ids).forEach(function (id) {
      var a = libAssets('sfx').filter(function (x) { return x.id === id; })[0];
      if (a) jobs.push(decodeAsset(ctx, a).then(function (b) { SFXB[id] = b; }).catch(function () { }));
    });
    if (D && curStick()) {
      var tags = {};
      libAssets('meme').forEach(function (a) {
        (a.tags || []).forEach(function (t) {
          if (tags[t]) return; tags[t] = 1;
          jobs.push(new Promise(function (res) {
            var im = new Image(); im.onload = function () { (MEMEIMG = MEMEIMG || {})[t] = im; res(); }; im.onerror = res; im.src = libFile(a);
          }));
        });
      });
    }
    return Promise.all(jobs).then(function () { try { ctx.close(); } catch (e) { } });
  });
}
function bkInit(ac, st, sc, T, target) {
  BKS = null;
  var hasSfx = Object.keys(SFXB).length > 0;
  if (!BKB && !hasSfx) return ac;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!ac) ac = new AC();
  if (!target) { target = ac.createMediaStreamDestination(); target.stream.getAudioTracks().forEach(function (k) { st.addTrack(k); }); }
  BKS = { ac: ac, dst: target, sc: sc, T: T, vol: bkSelection().vol };
  return ac;
}
function bkStart(t0) {
  var B = BKS; if (!B) return;
  var ac = B.ac; try { ac.resume(); } catch (e) { }
  var t = (t0 && t0 > ac.currentTime - 1) ? t0 : ac.currentTime + 0.05, T = B.T, v = B.vol;
  if (BKB) {
    var src = ac.createBufferSource(), g = ac.createGain(), hi = Math.min(1, v * 2.4);
    src.buffer = BKB; src.loop = true;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(hi, t + 0.8);          /* intro: backsound penuh */
    var nst = t + Math.min(2.5, T * 0.15);
    g.gain.setValueAtTime(hi, nst);
    g.gain.linearRampToValueAtTime(v, nst + 0.6);          /* ducking: turun saat narasi */
    var oe = t + T - 2.2;
    if (oe > nst + 1) {
      g.gain.setValueAtTime(v, oe);
      g.gain.linearRampToValueAtTime(hi, oe + 1.2);        /* outro: naik lagi */
      g.gain.setValueAtTime(hi, t + T - 1.0);
    } else g.gain.setValueAtTime(v, t + T - 1.0);
    g.gain.linearRampToValueAtTime(0.0001, t + T);
    src.connect(g); g.connect(B.dst); src.start(t); src.stop(t + T + 0.5);
  }
  var def = $('sfxSel') ? $('sfxSel').value : 'none';
  B.sc.forEach(function (s, i) {
    var id = curStick() ? String((D.scenes[i] || {}).sfx || '').toLowerCase() : '';
    if (!id || id === 'none' || !SFXB[id]) id = (i > 0 && def !== 'none') ? def : '';
    if (!id || !SFXB[id]) return;
    var so = ac.createBufferSource(), sg = ac.createGain(); so.buffer = SFXB[id]; sg.gain.value = 0.6;
    so.connect(sg); sg.connect(B.dst); so.start(t + s.s);
  });
}

/* ---------- pemeriksaan fakta ---------- */
function numsOf(t) { return (String(t || '').match(/\d[\d.,]*/g) || []).map(function (x) { return x.replace(/[.,]/g, ''); }).filter(function (x) { return x.length; }); }
function showFacts() {
  var p = CONTENT[$('mode').value]; if (!p || !p.fact || !D) return;
  var box = $('factBox');
  if (!box) { box = document.createElement('div'); box.id = 'factBox'; box.className = 'factbox'; var er = $('er'); er.parentNode.appendChild(box); }
  var src = $('newsSource') ? $('newsSource').value : '', srcN = numsOf(src).join(' ');
  var warn = [];
  if (!src.trim()) {
    var all = {}; D.scenes.forEach(function (s) { (String(s.narration).match(/\d[\d.,]*/g) || []).forEach(function (n) { all[n] = 1; }); });
    var ln = Object.keys(all).slice(0, 14);
    warn.push('Tidak ada bahan sumber yang ditempel. Semua nama dan tanggal harus dicek manual.' + (ln.length ? ' Angka yang harus dicek: ' + ln.join(', ') + '.' : ''));
  }
  D.scenes.forEach(function (s, i) {
    numsOf(s.narration).forEach(function (n) {
      if (src.trim() && (' ' + srcN + ' ').indexOf(' ' + n + ' ') < 0) warn.push('Adegan ' + (s.no || i + 1) + ': angka ' + n + ' tidak ada di bahan sumber.');
    });
  });
  if (src.trim()) {
    var sl = src.toLowerCase(), names = {};
    D.scenes.forEach(function (s, i) {
      String(s.narration).split(/(?<=[.!?])\s+/).forEach(function (sen) {
        sen.split(/\s+/).slice(1).forEach(function (w) {
          w = w.replace(/[^A-Za-z\u00C0-\u024F-]/g, '');
          if (w.length >= 4 && /^[A-Z]/.test(w) && sl.indexOf(w.toLowerCase()) < 0) (names[w] = names[w] || []).push(s.no || i + 1);
        });
      });
    });
    Object.keys(names).slice(0, 10).forEach(function (w) { warn.push('Nama/istilah "' + w + '" tidak ada di bahan sumber (adegan ' + names[w].join(', ') + ').'); });
  }
  var srcs = (D.sources || []).map(function (x) { return typeof x === 'string' ? esc(x) : esc((x.name || '') + (x.year ? ' (' + x.year + ')' : '')); });
  box.innerHTML = '<b>Pemeriksaan fakta</b>' +
    '<div class="s" style="margin:6px 0">AI tidak bisa menjamin 100% benar. Cek sendiri sumber di bawah sebelum video dipublikasikan.</div>' +
    '<div><b>Sumber dari AI:</b> ' + (srcs.length ? srcs.join('; ') : '<span class="err">kosong, verifikasi manual</span>') + '</div>' +
    (D.notes ? '<div style="margin-top:4px"><b>Catatan AI:</b> ' + esc(D.notes) + '</div>' : '') +
    (warn.length ? '<div class="err" style="margin-top:6px">' + warn.slice(0, 14).map(esc).join('<br>') + '</div>' : '<div style="margin-top:6px;color:var(--ok)">Tidak ada angka yang janggal terhadap bahan sumber.</div>') +
    '<details style="margin-top:6px"><summary>Dasar fakta per adegan</summary>' + D.scenes.map(function (s, i) { return '<div class="s">Adegan ' + (s.no || i + 1) + ': ' + esc(s.fact_basis || '-') + '</div>'; }).join('') + '</details>';
}
var _gen = gen;
gen = function () {
  var raw = $('js').value.replace(/^```json|```$/g, '').trim(), d = null;
  try { d = JSON.parse(raw); } catch (e) { }
  if (d && d.error) { $('er').textContent = 'AI menolak topik ini: ' + d.error + ' (menu ini hanya untuk fakta yang nyata).'; return; }
  _gen(); showFacts();
};

/* ---------- karakter drama ---------- */
function chosenChars() {
  var el = $('chSel'); if (!el) return [];
  var ids = Array.prototype.filter.call(el.options, function (o) { return o.selected && o.value !== 'none'; }).map(function (o) { return o.value; });
  return libAssets('char').filter(function (a) { return ids.indexOf(a.id) >= 0; }).map(function (a) { return { name: a.id, look: a.source || '', file: libFile(a) }; });
}
var _mk1 = mk1;
mk1 = function () {
  _mk1();
  var p = CONTENT[$('mode').value], ch = chosenChars();
  if (p && p.characters && ch.length && $('p1').value) {
    $('p1').value = $('p1').value.replace('\nReply ONLY', '\nFIXED CAST (use exactly these characters and copy their look word for word into "characters"): ' +
      ch.map(function (c) { return c.name + ' = ' + (c.look || 'consistent adult character'); }).join(' | ') + '\n\nReply ONLY');
  }
};

/* ---------- panel kontrol ---------- */
function audioHTML() {
  return '<div class="grid"><label class="f">Backsound<small>Dari Settings. Volume otomatis turun saat narasi (ducking).</small><select id="bkSel"></select></label>' +
    '<label class="f">Volume saat narasi: <span id="bkVv">18</span>%<small>Intro dan outro otomatis lebih keras</small><input id="bkVol" type="range" min="5" max="50" value="18" style="padding:0" oninput="$(\'bkVv\').textContent=this.value"></label>' +
    '<label class="f">SFX tiap pergantian adegan<small>Dari Settings (SFX)</small><select id="sfxSel"></select></label></div>';
}
function autoHTML(p) {
  var h = '<section id="autoPanel"><h2><span>A</span>Mode otomatis</h2><div class="grid">' +
    '<label class="f">Durasi video<small>Jumlah adegan menyesuaikan</small><select id="dur" onchange="durChange()"><option value="1">1 menit</option><option value="3">3 menit</option><option value="5">5 menit</option></select></label>' +
    '<label class="f">Sumber gambar<small>Ekstensi Flow otomatis atau upload sendiri</small><select id="isrc"><option value="flow">Google Flow (ekstensi otomatis)</option><option value="manual">Upload sendiri (langkah 3)</option></select></label>' +
    '<label class="f">Suara narasi<small>Edge TTS otomatis atau upload dari Google AI Studio</small><select id="vmode"><option value="edge">Edge TTS otomatis (gratis)</option><option value="studio">Upload dari Google AI Studio</option></select></label>' +
    (p.fact ? '<label class="f">Sumber fakta<small>Naskah hanya boleh memakai fakta dari sini</small><select id="fsrc"><option value="web">Riset web otomatis (disarankan)</option><option value="paste">Pakai bahan yang gua tempel</option><option value="ai">Pengetahuan AI saja (berisiko mengarang)</option></select></label>' : '') +
    (p.characters ? '<label class="f">Karakter (opsional)<small>Dari Settings. Boleh pilih lebih dari satu (Ctrl/Cmd).</small><select id="chSel" multiple size="3" onchange="mk1()"></select></label>' : '') +
    '</div>' + audioHTML() +
    '<label style="display:flex;gap:8px;align-items:center;margin:10px 0;font-size:13px"><input type="checkbox" id="chk" style="width:auto"' + (p.fact ? ' checked' : '') + '> Berhenti setelah naskah jadi supaya gua bisa cek fakta dulu' + (p.fact ? ' (disarankan)' : '') + '</label>' +
    '<div class="row"><button id="autoGo" onclick="autoStart()">Generate otomatis</button><button class="g" id="autoNext" onclick="autoResume()" disabled>Lanjutkan</button><button class="g" onclick="autoStop()">Batalkan</button></div>' +
    '<div id="autoLog" class="autolog"></div></section>';
  return h;
}
function durChange() {
  var d = parseInt($('dur').value) || 1, n = d === 1 ? 10 : d === 3 ? 30 : 50;
  $('n').innerHTML = '<option>' + n + '</option>'; $('n').value = n;
  var l = $('nlab'); if (l) l.textContent = '1 adegan = 1 gambar';
  if ($('p1').style.display === 'block') mk1();
}
function refreshLibSelects() {
  return libLoad().then(function () {
    fillSelect('bkSel', 'bgm', 'Tanpa backsound'); fillSelect('sfxSel', 'sfx', 'Tanpa SFX');
    if ($('chSel')) { var o = $('chSel'); o.innerHTML = libAssets('char').map(function (a) { return '<option value="' + esc(a.id) + '">' + esc(a.id) + '</option>'; }).join(''); }
  });
}


/* ---------- riset web (OpenAI web search) ---------- */
function researchCall() {
  var t = $('title').value.trim(), s = getSettings();
  return jpost('/api/research', { key: s.openaiKey || '', model: s.openaiModel || 'gpt-4o-mini', topic: t }).then(function (j) {
    if (j.error) throw new Error(j.error);
    return j;
  });
}
function doResearch() {
  var m = $('rsMsg'), t = $('title').value.trim();
  if (!t) { m.textContent = 'Isi judul/topik dulu.'; return; }
  m.textContent = 'Meriset di web... (biasanya 30-90 detik)'; m.className = 'subtle';
  researchCall().then(function (j) {
    $('newsSource').value = j.text;
    m.textContent = 'Riset selesai: ' + j.sources.length + ' sumber web. Baca dulu, hapus yang salah, baru buat naskah.';
    if ($('p1').style.display === 'block') mk1();
  }).catch(function (e) { m.textContent = 'Gagal: ' + e.message; m.className = 'err'; });
}

/* ---------- pipeline otomatis ---------- */
var AUTO = { stage: 'script', busy: false, stop: false, job: null };
function alog(m, cls) {
  var b = $('autoLog'); if (!b) return;
  var d = document.createElement('div'); d.className = cls || ''; d.textContent = new Date().toLocaleTimeString('id-ID') + '  ' + m;
  b.appendChild(d); b.scrollTop = b.scrollHeight;
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function jpost(u, o) { return fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) }).then(function (r) { return r.json(); }); }
function setBusy(b) { AUTO.busy = b; $('autoGo').disabled = b; $('autoNext').disabled = b || AUTO.stage === 'script' || AUTO.stage === 'done'; }
function autoStop() { AUTO.stop = true; if (AUTO.job) jpost('/api/flow/cancel', { id: AUTO.job }); alog('Dibatalkan.', 'err'); AUTO.busy = false; $('autoGo').disabled = false; }
function autoStart() {
  if (AUTO.busy) return;
  var t = $('title').value.trim(), w = titleWarning(t, $('mode').value);
  if (w) { $('er').textContent = w; alog(w, 'err'); return; }
  $('er').textContent = ''; $('autoLog').innerHTML = ''; AUTO.stage = CONTENT[$('mode').value].fact ? 'research' : 'script'; AUTO.stop = false; D = null;
  autoRun();
}
function autoResume() { if (AUTO.busy) return; AUTO.stop = false; autoRun(); }

async function autoRun() {
  setBusy(true);
  try {
    var p = CONTENT[$('mode').value];
    if (AUTO.stage === 'research') {
      var fm = $('fsrc') ? $('fsrc').value : 'ai';
      if (fm === 'web') {
        alog('Riset web (OpenAI web search), tunggu 30-90 detik...');
        var rj = await researchCall();
        $('newsSource').value = rj.text;
        if (rj.text.length < 300 || rj.sources.length === 0) throw new Error('Riset tidak menemukan cukup fakta/sumber untuk topik ini. Tempel bahan sendiri dan pilih "Pakai bahan yang gua tempel".');
        alog('Riset selesai: ' + rj.sources.length + ' sumber web.', 'ok');
      } else if (fm === 'paste') {
        if (!$('newsSource').value.trim()) throw new Error('Kotak "Bahan / sumber faktual" masih kosong. Tempel bahan dulu.');
        alog('Memakai bahan yang lu tempel.');
      } else {
        $('newsSource').value = '';
        alog('Mode pengetahuan AI saja: AI diminta menolak kalau tidak yakin, tapi tetap berisiko. Cek fakta manual.', 'err');
      }
      AUTO.stage = 'script';
    }
    if (AUTO.stage === 'script') {
      mk1(); var s = getSettings();
      if (!(s.openaiKey)) alog('API key OpenAI belum diisi di Settings (kalau server punya OPENAI_API_KEY, tetap lanjut).');
      alog('Meminta naskah ke OpenAI...');
      var j = await jpost('/openai', { key: s.openaiKey || '', model: s.openaiModel || 'gpt-4o-mini', prompt: $('p1').value });
      if (j.error) throw new Error(j.error);
      $('js').value = j.text; gen();
      if ($('er').textContent) throw new Error($('er').textContent);
      alog('Naskah jadi: ' + D.scenes.length + ' adegan.', 'ok');
      AUTO.stage = 'check';
    }
    if (AUTO.stage === 'check') {
      AUTO.stage = 'images';
      if ($('chk').checked) { alog('Cek bagian Pemeriksaan Fakta di langkah 2. Kalau sudah aman, klik Lanjutkan.'); var fb = $('factBox') || $('js'); fb.scrollIntoView({ behavior: 'smooth', block: 'center' }); setBusy(false); return; }
    }
    if (AUTO.stage === 'images') {
      var miss = missingScenes();
      if (miss.length && $('isrc').value === 'manual') { alog('Upload gambar di langkah 3 (' + miss.length + ' adegan belum ada), lalu klik Lanjutkan.'); setBusy(false); return; }
      if (miss.length) await runFlow(miss);
      if (AUTO.stop) { setBusy(false); return; }
      miss = missingScenes();
      if (miss.length) { alog('Masih ada ' + miss.length + ' adegan tanpa gambar. Upload manual di langkah 3 atau klik Lanjutkan untuk coba lagi.', 'err'); setBusy(false); return; }
      alog('Semua gambar siap.', 'ok'); AUTO.stage = 'voice';
    }
    if (AUTO.stage === 'voice') {
      if (!(ps() || AU)) {
        if ($('vmode').value === 'studio') {
          alog('Salin naskah (langkah 4) ke Google AI Studio, lalu upload audionya (per adegan atau satu file) dan klik Lanjutkan.');
          $('nar').scrollIntoView({ behavior: 'smooth', block: 'center' }); setBusy(false); return;
        }
        alog('Membuat suara narasi (Edge TTS)...'); $('em').textContent = '';
        et2();
        while (!/^(Selesai|Gagal)/.test($('em').textContent.trim())) { if (AUTO.stop) { setBusy(false); return; } await sleep(700); }
        if (/^Gagal/.test($('em').textContent.trim())) throw new Error($('em').textContent);
      }
      alog('Suara siap.', 'ok'); AUTO.stage = 'render';
    }
    if (AUTO.stage === 'render') {
      alog('Merender video (real-time, biarkan tab ini tetap terbuka)...');
      $('vm').textContent = 'Memulai...'; mkv();
      var mark = 25;
      while (!/(Selesai|gagal|Gagal|belum ada|tidak mendukung)/.test($('vm').textContent)) {
        if (AUTO.stop) { setBusy(false); return; }
        var pm = $('vm').textContent.match(/(\d+)%/);
        if (pm && +pm[1] >= mark) { alog('Render ' + pm[1] + '%'); mark += 25; }
        await sleep(700);
      }
      alog($('vm').textContent, /Selesai/.test($('vm').textContent) ? 'ok' : 'err');
      AUTO.stage = 'done';
    }
  } catch (e) { alog('Gagal: ' + e.message, 'err'); }
  setBusy(false);
}
function missingScenes() {
  var o = []; if (!D) return o;
  D.scenes.forEach(function (s, i) { var m = $('i' + i); if (!m || m.style.display === 'none') o.push(i); });
  return o;
}
async function runFlow(miss) {
  var FMT = FM[$('fmt').value], ch = chosenChars();
  var prompts = miss.map(function (i) {
    var s = D.scenes[i], names = (s.characters || []), refs = ch.filter(function (c) { return names.indexOf(c.name) >= 0; }).map(function (c) { return location.origin + c.file; });
    return { no: s.no || i + 1, idx: i, prompt: $('f' + i).value.replace(/^File name: gambar\d+\.\s*/, ''), refs: refs };
  });
  var r = await jpost('/api/flow/jobs', { title: ($('title').value.trim() || D.title || 'Story Engine').slice(0, 60), aspect: FMT.ar, prompts: prompts });
  if (r.error) throw new Error(r.error);
  AUTO.job = r.id; alog('Job dikirim ke ekstensi Flow (' + prompts.length + ' gambar). Buka tab Google Flow yang sudah login.');
  var got = {}, t0 = Date.now(), warned = false;
  while (!AUTO.stop) {
    await sleep(2500);
    var st = await fetch('/api/flow/job?id=' + r.id).then(function (x) { return x.json(); });
    if (st.error) throw new Error(st.error);
    if (!st.ext_seen && !warned && Date.now() - t0 > 25000) { warned = true; alog('Ekstensi belum terhubung. Pastikan ekstensi terpasang dan tab Flow terbuka.', 'err'); }
    for (var k = 0; k < st.done.length; k++) {
      var no = st.done[k];
      if (got[no]) continue;
      var blob = await fetch('/api/flow/file?id=' + r.id + '&no=' + no).then(function (x) { return x.blob(); });
      var pr = prompts.filter(function (q) { return q.no === no; })[0]; if (!pr) continue;
      put(pr.idx, { n: 'gambar' + no + '.png', b: blob }); got[no] = 1; alog('Gambar adegan ' + no + ' masuk (' + Object.keys(got).length + '/' + prompts.length + ').');
    }
    if (st.msg && st.msg !== AUTO.lastMsg) { AUTO.lastMsg = st.msg; alog('Flow: ' + st.msg); }
    if (st.status === 'done' || st.status === 'error' || st.status === 'cancelled') { if (st.status === 'error') alog('Flow error: ' + (st.msg || ''), 'err'); break; }
    if (Date.now() - t0 > 90 * 60 * 1000) { alog('Timeout menunggu Flow.', 'err'); break; }
  }
  AUTO.job = null;
}

/* ---------- init halaman generator ---------- */
function autoInit() {
  var mode = document.body.dataset.mode, p = CONTENT[mode]; if (!p) return;
  var am = $('autoMount'), au = $('audioMount');
  if (am && p.auto) { am.innerHTML = autoHTML(p); durChange(); }
  else if (au) au.innerHTML = audioHTML();
  if (mode === 'stickman') { window.SUBK = 0.085; window.SUBC = '#ffe14a'; window.SUBU = true; }
  refreshLibSelects();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(autoInit, 0); }); else autoInit();
