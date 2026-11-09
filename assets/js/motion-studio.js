/* Motion Studio — topik -> naskah (OpenAI) -> voice over -> motion graphic + avatar -> video.
   Berjalan di browser; server.py menyediakan /openai, /tts, /tts-offline, /api/*. */
(function () {
'use strict';
const q = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const frac = x => x - Math.floor(x);
const rnd = (i, k) => frac(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);
const easeBack = p => { const c1 = 1.70158, c3 = c1 + 1; p = clamp(p); return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };

const FMT = {
  ig: { n: 'Instagram Reels', w: 1080, h: 1920 }, tt: { n: 'TikTok', w: 1080, h: 1920 },
  fb: { n: 'Facebook Reels', w: 1080, h: 1920 }, ys: { n: 'YouTube Shorts', w: 1080, h: 1920 },
  sq: { n: 'Square', w: 1080, h: 1080 }, yl: { n: 'YouTube', w: 1920, h: 1080 }
};
const PAL = {
  teal:     { n: 'Teal Sains', bg: ['#06201f', '#0e4f4a'], ac: '#2dd4bf', ac2: '#fde047', tx: '#f2fffd', pan: 'rgba(3,18,18,.74)', shirt: '#2dd4bf' },
  sunset:   { n: 'Sunset', bg: ['#2b1055', '#c2410c'], ac: '#fdba74', ac2: '#f472b6', tx: '#fff7ed', pan: 'rgba(30,8,40,.72)', shirt: '#f472b6' },
  ocean:    { n: 'Ocean', bg: ['#04122e', '#0b4a8f'], ac: '#7dd3fc', ac2: '#fde68a', tx: '#f0f9ff', pan: 'rgba(2,10,30,.74)', shirt: '#38bdf8' },
  midnight: { n: 'Midnight', bg: ['#120f2e', '#3b2a7a'], ac: '#c4b5fd', ac2: '#fbbf24', tx: '#f5f3ff', pan: 'rgba(10,8,30,.74)', shirt: '#a78bfa' },
  forest:   { n: 'Forest', bg: ['#06210f', '#14532d'], ac: '#86efac', ac2: '#fcd34d', tx: '#f0fdf4', pan: 'rgba(3,20,10,.74)', shirt: '#4ade80' },
  paper:    { n: 'Paper (terang)', bg: ['#fff7ed', '#fde68a'], ac: '#c2410c', ac2: '#0f766e', tx: '#1c1917', pan: 'rgba(255,255,255,.86)', shirt: '#0f766e' }
};
const LAYOUTS = ['flow', 'cycle', 'compare', 'list', 'stat', 'center'];
const FX = ['rain', 'snow', 'bubbles', 'sparkle', 'none'];
const EMO = {
  neutral:   { browY: 0, browAsym: 0, tilt: 0, eye: 1, smile: .25, lx: 0, ly: 0, blush: 0 },
  happy:     { browY: .25, browAsym: 0, tilt: 0, eye: 1, smile: .85, lx: 0, ly: 0, blush: 1 },
  excited:   { browY: .6, browAsym: 0, tilt: 0, eye: 1.15, smile: 1, lx: 0, ly: 0, blush: 1 },
  curious:   { browY: .3, browAsym: .7, tilt: 0, eye: 1.05, smile: .15, lx: .35, ly: -.1, blush: 0 },
  surprised: { browY: 1, browAsym: 0, tilt: 0, eye: 1.25, smile: .05, lx: 0, ly: 0, blush: 0 },
  thinking:  { browY: .1, browAsym: .5, tilt: 0, eye: .95, smile: 0, lx: .6, ly: -.5, blush: 0 },
  serious:   { browY: -.3, browAsym: 0, tilt: -.5, eye: .9, smile: -.15, lx: 0, ly: 0, blush: 0 },
  sad:       { browY: .15, browAsym: 0, tilt: .7, eye: .95, smile: -.7, lx: 0, ly: .15, blush: 0 }
};
const VOICES = {
  id: [['id-ID-ArdiNeural', 'Ardi (pria)'], ['id-ID-GadisNeural', 'Gadis (wanita)']],
  en: [['en-US-GuyNeural', 'Guy (male)'], ['en-US-JennyNeural', 'Jenny (female)'], ['en-US-AriaNeural', 'Aria (female)']]
};

const S = { lib: null, data: null, scenes: [], total: 0, T: 0, t0: 0, playing: false, rec: false, recorder: null,
            blob: null, imgs: {}, tint: {}, sfxBuf: {}, built: false };
let ac, master, voiceBus, sfxBus, analyser, srcs = [], lipBuf;
const cv = q('msCanvas'), g = cv.getContext('2d');
let F = FMT.fb, PREVIEW = .5;
const AV = { cur: Object.assign({}, EMO.neutral), mouth: 0, last: 0 };
let CUR = { lt: 0, GA: 1 };

/* ------------------------------ util ------------------------------ */
const err = m => { q('msErr').textContent = m || ''; };
const stat = m => { q('msStatus').textContent = m || ''; };
const byId = id => S.lib && S.lib.assets.find(a => a.id === id);
const fmtT = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
function curPal() { const v = q('msPal').value; return v === 'auto' ? (PAL[(S.data && S.data.palette)] || PAL.teal) : (PAL[v] || PAL.teal); }
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(text, maxW) {
  const ws = String(text || '').split(/\s+/).filter(Boolean), out = []; let l = '';
  ws.forEach(w => { const n = l ? l + ' ' + w : w; if (g.measureText(n).width > maxW && l) { out.push(l); l = w; } else l = n; });
  if (l) out.push(l); return out;
}
function setRes(scale) { cv.width = Math.round(F.w * scale); cv.height = Math.round(F.h * scale); g.setTransform(scale, 0, 0, scale, 0, 0); }
function applyFormat() { F = FMT[q('msFmt').value] || FMT.fb; PREVIEW = Math.min(1, 960 / Math.max(F.w, F.h)); if (!S.rec) setRes(PREVIEW); redraw(); }

/* ------------------------------ library ------------------------------ */
async function loadLib() {
  try {
    const r = await fetch('../library/index.json', { cache: 'no-store' });
    S.lib = await r.json(); S.imgs = {}; S.tint = {}; renderLib();
  } catch (e) { err('Library tidak terbaca. Buka aplikasi lewat server (python server.py), bukan klik file langsung.'); }
}
function renderLib() {
  q('msLib').innerHTML = S.lib.assets.map(a => '<div title="' + (a.tags || []).join(', ') + ' | ' + a.license + '">' +
    (a.kind === 'sfx' ? '<div style="font-size:30px;cursor:pointer" onclick="new Audio(\'../library/' + a.file + '\').play()">🔊</div>' : '<img src="../library/' + a.file + '" alt="">') +
    '<div><b>' + a.id + '</b></div><div style="color:var(--mu)">' + a.license + '</div><span class="x" onclick="MS.libDel(\'' + a.id + '\')">hapus</span></div>').join('');
}
function imgEl(id) {
  const a = byId(id); if (!a || a.kind === 'sfx') return null;
  let im = S.imgs[id];
  if (!im) {
    im = S.imgs[id] = new Image();
    im._p = new Promise(res => { im.onload = () => { im._ok = 1; res(); }; im.onerror = () => { im._err = 1; res(); }; });
    im.src = '../library/' + a.file;
  }
  return im;
}
function tinted(id, color) {
  const key = id + color; if (S.tint[key]) return S.tint[key];
  const im = imgEl(id); if (!im || !im._ok) return null;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.drawImage(im, 0, 0, 256, 256); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, 256, 256);
  return (S.tint[key] = c);
}
function drawIcon(id, cx, cy, size, color) {
  const a = byId(id), im = imgEl(id); if (!a || !im || !im._ok) return;
  const src = a.tint === false ? im : tinted(id, color); if (!src) return;
  const w = src.width || src.naturalWidth || 1, h = src.height || src.naturalHeight || 1, k = size / Math.max(w, h);
  g.drawImage(src, cx - w * k / 2, cy - h * k / 2, w * k, h * k);
}

/* ------------------------------ prompt & JSON ------------------------------ */
function buildPrompt() {
  const topic = q('msTopic').value.trim(), dur = +q('msDur').value, lang = q('msLang').value;
  const words = Math.round(dur * (lang === 'id' ? 2.3 : 2.5)), n = Math.max(4, Math.round(dur / 6.5));
  const icons = S.lib.assets.filter(a => a.kind !== 'sfx').map(a => a.id + ' (' + (a.tags || []).slice(0, 3).join(',') + ')').join('; ');
  const sfx = S.lib.assets.filter(a => a.kind === 'sfx').map(a => a.id).join(', ');
  return 'Kamu adalah penulis naskah video motion graphic edukasi untuk Reels/Shorts.\n' +
    'TOPIK: "' + topic + '"\n' +
    'BAHASA NASKAH: ' + (lang === 'id' ? 'Indonesia' : 'English') + ', gaya santai, jelas, enak didengar, mudah dipahami orang awam.\n' +
    'DURASI TARGET: ' + dur + ' detik => total narasi sekitar ' + words + ' kata (toleransi 10%), dibagi menjadi ' + n + ' scene (tiap scene 8-18 kata).\n' +
    'STRUKTUR: scene 1 = hook yang bikin penasaran (pertanyaan atau fakta mengejutkan); scene tengah = penjelasan bertahap sebab-akibat; scene terakhir = kesimpulan + ajakan singkat.\n' +
    'FAKTA: akurat dan umum diterima; jangan mengarang angka atau klaim.\n' +
    'NARASI: ditulis untuk diucapkan; tanpa emoji, tanpa tanda kurung, tanpa singkatan yang sulit dibaca.\n' +
    'VISUAL: pilih elemen HANYA dari library berikut (pakai id persis): ' + icons + '\n' +
    'Layout per scene: "flow" (2-5 elemen berurutan dengan panah, untuk proses), "cycle" (3-5 elemen melingkar, untuk siklus), "compare" (tepat 2 elemen), "list" (2-4 poin), "stat" (1 elemen + field "value" berisi angka/kata kunci singkat), "center" (1 elemen besar).\n' +
    'fx (efek latar): rain, snow, bubbles, sparkle, none. emotion (ekspresi avatar): neutral, happy, excited, curious, surprised, thinking, serious, sad. sfx: salah satu dari ' + sfx + ' atau "none". palette: salah satu dari ' + Object.keys(PAL).join(', ') + '.\n' +
    'Kembalikan HANYA JSON valid (tanpa markdown) dengan bentuk:\n' +
    '{"title":"judul video singkat","caption":"caption sosial media 1-2 kalimat","hashtags":"#a #b #c #d #e","palette":"teal","scenes":[{"title":"headline layar maks 5 kata","narration":"kalimat yang diucapkan","layout":"flow","elements":[{"asset":"id_dari_library","label":"label maks 3 kata"}],"value":"","fx":"none","emotion":"curious","sfx":"whoosh"}]}';
}
function pickAsset(name, label) {
  name = String(name || '').toLowerCase().trim();
  const a = byId(name); if (a && a.kind !== 'sfx') return a.id;
  const words = (name + ' ' + String(label || '')).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const hit = S.lib.assets.find(x => x.kind !== 'sfx' && (x.tags || []).some(t => words.includes(t)));
  return hit ? hit.id : 'star';
}
function norm(d) {
  if (!d || !Array.isArray(d.scenes) || !d.scenes.length) throw new Error('JSON harus punya array "scenes".');
  const sfxIds = S.lib.assets.filter(a => a.kind === 'sfx').map(a => a.id);
  const scenes = d.scenes.map((s, i) => {
    let els = (Array.isArray(s.elements) ? s.elements : []).slice(0, 5).map(e => ({ asset: pickAsset(e.asset, e.label), label: String(e.label || '') }));
    let lay = LAYOUTS.includes(s.layout) ? s.layout : 'center';
    if (!els.length) els = [{ asset: 'star', label: '' }];
    if (lay === 'compare' && els.length !== 2) lay = els.length > 2 ? 'flow' : 'center';
    if (lay === 'cycle' && els.length < 3) lay = els.length > 1 ? 'flow' : 'center';
    if (lay === 'stat' && !String(s.value || '').trim()) lay = 'center';
    if (lay === 'center' && els.length > 1) lay = 'flow';
    if (!String(s.narration || '').trim()) throw new Error('Scene ' + (i + 1) + ' belum punya narration.');
    return { title: String(s.title || ''), narration: String(s.narration).trim(), layout: lay, elements: els, value: String(s.value || ''),
             fx: FX.includes(s.fx) ? s.fx : 'none', emotion: EMO[s.emotion] ? s.emotion : 'neutral', sfx: sfxIds.includes(s.sfx) ? s.sfx : 'none' };
  });
  return { title: String(d.title || q('msTopic').value || 'Motion Graphic'), caption: String(d.caption || ''), hashtags: String(d.hashtags || ''),
           palette: PAL[d.palette] ? d.palette : 'teal', scenes };
}
function applyJson() {
  err('');
  try {
    const txt = q('msJson').value.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    S.data = norm(JSON.parse(txt)); S.scenes = S.data.scenes.map(s => Object.assign({}, s)); S.built = false;
    q('msScenes').innerHTML = S.scenes.map((s, i) => '<div class="ms-scene"><b>Scene ' + (i + 1) + '</b> · ' + s.layout + ' · ' + s.emotion + ' · ' + s.elements.map(e => e.asset).join(', ') + '<br>' + s.narration + '</div>').join('');
    stat(S.scenes.length + ' scene siap. Klik "Buat Voice Over & Preview".');
    return true;
  } catch (e) { err('JSON tidak valid: ' + e.message); return false; }
}
async function generate() {
  err('');
  const topic = q('msTopic').value.trim(); if (!topic) return err('Isi topik dulu.');
  if (!S.lib) await loadLib(); if (!S.lib) return;
  const s = (typeof getSettings === 'function' ? getSettings() : {}) || {};
  stat('Menulis naskah dengan OpenAI...');
  try {
    const r = await fetch('/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: buildPrompt(), key: s.openaiKey || '', model: s.openaiModel || 'gpt-4o-mini' }) });
    const j = await r.json(); if (j.error) throw new Error(j.error);
    q('msJson').value = JSON.stringify(JSON.parse(j.text), null, 1);
    if (applyJson()) await buildVoice();
  } catch (e) { err(e.message); stat(''); }
}
function showPrompt() {
  if (!q('msTopic').value.trim()) return err('Isi topik dulu.');
  const p = q('msPrompt'); p.value = buildPrompt(); p.style.display = 'block'; p.select();
  try { navigator.clipboard.writeText(p.value); } catch (e) {}
  stat('Prompt disalin. Tempel ke ChatGPT, lalu tempel JSON hasilnya ke kotak di bawah dan klik Terapkan JSON.');
}

/* ------------------------------ audio ------------------------------ */
function ensureAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); voiceBus = ac.createGain(); sfxBus = ac.createGain(); sfxBus.gain.value = .45;
  analyser = ac.createAnalyser(); analyser.fftSize = 1024; lipBuf = new Uint8Array(analyser.fftSize);
  voiceBus.connect(analyser); analyser.connect(master); sfxBus.connect(master); master.connect(ac.destination);
}
async function ttsScene(text) {
  const eng = q('msEng').value, rate = +q('msRate').value, voice = q('msVoice').value;
  const body = eng === 'edge' ? { text, voice, rate: (rate >= 0 ? '+' : '') + rate + '%' } : { text, voice, rate };
  const r = await fetch(eng === 'edge' ? '/tts' : '/tts-offline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json(); if (j.error) throw new Error(j.error);
  const bin = Uint8Array.from(atob(j.audio), c => c.charCodeAt(0));
  return ac.decodeAudioData(bin.buffer.slice(0));
}
async function loadSfx(id) {
  if (S.sfxBuf[id] || !byId(id)) return;
  const r = await fetch('../library/' + byId(id).file); S.sfxBuf[id] = await ac.decodeAudioData(await r.arrayBuffer());
}
function appear(sc, i) { return .45 + i * Math.min(1.1, (sc.audio.duration * .75) / Math.max(sc.elements.length, 1)); }
function makeChunks(text, t0, dur) {
  const words = text.replace(/\s+/g, ' ').trim().split(' '), parts = []; let cur = [];
  words.forEach((w, i) => { cur.push(w); const end = /[.!?]$/.test(w) || (/[,;:]$/.test(w) && cur.length >= 3);
    if (cur.length >= 5 || end || i === words.length - 1) { parts.push(cur.join(' ')); cur = []; } });
  const tot = parts.reduce((s, p) => s + p.length + 4, 0); let t = t0;
  return parts.map(p => { const d = dur * (p.length + 4) / tot, c = { t0: t, t1: t + d, text: p }; t += d; return c; });
}
function layoutTimeline() {
  let t = 0;
  S.scenes.forEach((sc, i) => {
    sc.start = t; sc.vo = .2; const a = sc.audio.duration;
    sc.len = Math.max(2.8, a + sc.vo + (i === S.scenes.length - 1 ? 1.0 : .45)); t += sc.len;
    sc.chunks = makeChunks(sc.narration, sc.start + sc.vo, a);
  });
  S.total = t;
}
async function buildVoice() {
  err('');
  if (!S.scenes.length && !applyJson()) return;
  if (!S.lib) await loadLib();
  pause(); ensureAudio(); await ac.resume();
  try {
    for (let i = 0; i < S.scenes.length; i++) {
      stat('Membuat voice over scene ' + (i + 1) + '/' + S.scenes.length + '...');
      S.scenes[i].audio = await ttsScene(S.scenes[i].narration);
    }
    stat('Memuat aset...');
    const ids = new Set(); S.scenes.forEach(sc => sc.elements.forEach(e => ids.add(e.asset)));
    await Promise.all([...ids].map(id => { const im = imgEl(id); return im ? im._p : null; }));
    await Promise.all(['pop', ...S.scenes.map(s => s.sfx)].filter(x => x && x !== 'none').map(loadSfx));
    layoutTimeline(); S.built = true; S.T = 0; S.blob = null; q('msDl').style.display = 'none';
    q('msPreview').style.display = 'block'; applyFormat();
    q('msScenes').innerHTML = S.scenes.map((s, i) => '<div class="ms-scene"><b>Scene ' + (i + 1) + '</b> · ' + fmtT(s.start) + ' · ' + s.layout + ' · ' + s.emotion + '<br>' + s.narration + '</div>').join('');
    stat('Siap. Total durasi video ' + S.total.toFixed(1) + ' detik (' + S.scenes.length + ' scene).');
    q('msPreview').scrollIntoView({ behavior: 'smooth' });
  } catch (e) { err(e.message); stat(''); }
}

/* ------------------------------ playback ------------------------------ */
function gainNode(v) { const n = ac.createGain(); n.gain.value = v; return n; }
function sched(buf, bus, at, vol) {
  if (!buf) return;
  const s = ac.createBufferSource(); s.buffer = buf; const gn = gainNode(vol); s.connect(gn); gn.connect(bus);
  const when = S.t0 + at, now = ac.currentTime;
  if (when + buf.duration <= now) return;
  if (when >= now) s.start(when); else s.start(now, now - when);
  srcs.push(s);
}
function startAudio(from) {
  stopAudio(); S.t0 = ac.currentTime - from; const sfxOn = q('msSfx').checked;
  S.scenes.forEach(sc => {
    sched(sc.audio, voiceBus, sc.start + sc.vo, 1);
    if (!sfxOn) return;
    if (sc.sfx !== 'none') sched(S.sfxBuf[sc.sfx], sfxBus, sc.start + .05, .9);
    sc.elements.forEach((e, i) => sched(S.sfxBuf.pop, sfxBus, sc.start + appear(sc, i) + .05, .5));
  });
}
function stopAudio() { srcs.forEach(s => { try { s.stop(); } catch (e) {} }); srcs = []; }
function curT() { return S.playing ? ac.currentTime - S.t0 : S.T; }
function play() {
  if (!S.built) return; ensureAudio(); ac.resume();
  if (S.T >= S.total - .05) S.T = 0;
  startAudio(S.T); S.playing = true; q('msPlay').textContent = 'Jeda';
}
function pause() { if (S.playing) { S.T = curT(); stopAudio(); S.playing = false; } q('msPlay').textContent = 'Putar'; }
function toggle() { S.playing ? pause() : play(); }
function finish() {
  stopAudio(); S.playing = false; S.T = S.total - .001; q('msPlay').textContent = 'Putar';
  if (S.rec && S.recorder) { const r = S.recorder; S.recorder = null; setTimeout(() => r.stop(), 450); }
}
function loop() {
  if (S.built) {
    let T = curT();
    if (S.playing && T >= S.total) { finish(); T = S.total - .001; }
    if (S.playing) S.T = T;
    draw(clamp(T, 0, S.total - .001));
    q('msSeek').value = Math.round(T / S.total * 1000); q('msTime').textContent = fmtT(T) + ' / ' + fmtT(S.total);
    if (S.rec) q('msRStatus').textContent = 'Merender... ' + Math.round(clamp(T / S.total) * 100) + '% (jangan pindah tab)';
  }
  requestAnimationFrame(loop);
}
function redraw() { if (S.built) draw(clamp(curT(), 0, S.total - .001)); }

/* ------------------------------ drawing ------------------------------ */
function lay() {
  const W = F.w, H = F.h, ar = H / W, left = q('msAvPos').value === 'left', off = q('msAvPos').value === 'off';
  if (ar > 1.3) return { title: { x: W / 2, y: H * .115, w: W * .84, sz: W * .075 }, vis: { x: W * .07, y: H * .2, w: W * .86, h: H * .33 },
    av: off ? null : { x: W * (left ? .17 : .83), y: H * .605, s: W * .115 }, sub: { x: W / 2, y: H * .755, w: W * .86, sz: W * .05, lines: 3 } };
  if (ar < .9) return { title: { x: W / 2, y: H * .13, w: W * .8, sz: H * .085 }, vis: { x: W * .17, y: H * .22, w: W * .66, h: H * .5 },
    av: off ? null : { x: W * (left ? .09 : .91), y: H * .68, s: H * .1 }, sub: { x: W / 2, y: H * .88, w: W * .7, sz: H * .058, lines: 2 } };
  return { title: { x: W / 2, y: H * .11, w: W * .84, sz: W * .07 }, vis: { x: W * .07, y: H * .19, w: W * .86, h: H * .34 },
    av: off ? null : { x: W * (left ? .16 : .84), y: H * .625, s: W * .085 }, sub: { x: W / 2, y: H * .85, w: W * .84, sz: W * .05, lines: 2 } };
}
function font(px, wgt) { g.font = (wgt || 800) + ' ' + Math.round(px) + 'px "Segoe UI",system-ui,Arial,sans-serif'; }
function drawLabel(text, cx, y, maxW, sz, P) {
  if (!text) return; font(sz, 700); g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = P.tx;
  wrap(text, maxW).slice(0, 2).forEach((l, i) => g.fillText(l, cx, y + i * sz * 1.15));
}
function item(el, cx, cy, size, p, P, ph, labelSz) {
  if (p <= 0) return; const e = easeBack(p), bob = Math.sin(CUR.lt * 2 + ph) * size * .025;
  g.save(); g.globalAlpha = CUR.GA * clamp(p * 1.6); g.translate(cx, cy + bob); g.scale(e, e);
  g.beginPath(); g.arc(0, 0, size * .62, 0, 6.2832); g.fillStyle = hexA(P.ac, .16); g.fill();
  g.lineWidth = Math.max(2, size * .03); g.strokeStyle = hexA(P.ac, .55); g.stroke();
  drawIcon(el.asset, 0, 0, size * .78, P.ac); g.restore();
  g.save(); g.globalAlpha = CUR.GA * clamp((p - .3) * 2);
  drawLabel(el.label, cx, cy + size * .72, size * 1.9, labelSz || Math.max(24, size * .2), P); g.restore();
}
function arrow(cx, cy, size, rot, p, P) {
  if (p <= 0) return; g.save(); g.globalAlpha = CUR.GA * clamp(p * 2); g.translate(cx, cy); g.rotate(rot); g.scale(clamp(p * 1.4), clamp(p * 1.4));
  drawIcon('arrow', 0, 0, size, P.ac2); g.restore();
}
function drawVisual(sc, lt, v, P) {
  const els = sc.elements, n = els.length, port = v.h > v.w * 1.0, prog = i => clamp((lt - appear(sc, i)) / .55);
  const m = Math.min(v.w, v.h), cx = v.x + v.w / 2, cy = v.y + v.h / 2;
  if (sc.layout === 'center') {
    const s = m * .62; item(els[0], cx, cy - s * .08, s, prog(0), P, 0, s * .17);
  } else if (sc.layout === 'flow') {
    const mainLen = port ? v.h : v.w, cross = port ? v.w : v.h, size = Math.min(cross * .62, mainLen / n / 1.4, m * .5);
    els.forEach((e, i) => {
      const pos = (i + .5) * mainLen / n, x = port ? cx : v.x + pos, y = port ? v.y + pos - size * .1 : cy - size * .1;
      item(e, x, y, size, prog(i), P, i, Math.max(22, size * .19));
      if (i < n - 1) { const pa = (i + 1) * mainLen / n; arrow(port ? cx : v.x + pa, port ? v.y + pa - size * .1 : cy - size * .1, size * .36, port ? Math.PI / 2 : 0, prog(i + 1), P); }
    });
  } else if (sc.layout === 'cycle') {
    const R = m * .34, size = m * (n <= 3 ? .27 : .22), ccy = cy - size * .1;
    g.save(); g.globalAlpha = CUR.GA * clamp(lt / .5) * .5; g.setLineDash([16, 20]); g.lineDashOffset = -lt * 35; g.lineWidth = 5; g.strokeStyle = P.ac2;
    g.beginPath(); g.arc(cx, ccy, R, 0, 6.2832); g.stroke(); g.restore();
    els.forEach((e, i) => {
      const a = -Math.PI / 2 + 6.2832 * i / n; item(e, cx + Math.cos(a) * R, ccy + Math.sin(a) * R, size, prog(i), P, i, Math.max(22, size * .19));
      const am = a + 3.1416 / n; arrow(cx + Math.cos(am) * R, ccy + Math.sin(am) * R, size * .26, am + Math.PI / 2, prog((i + 1) % n), P);
    });
  } else if (sc.layout === 'compare') {
    const size = port ? Math.min(v.w * .56, v.h * .3) : Math.min(v.w * .3, v.h * .55);
    els.forEach((e, i) => { const x = port ? cx : v.x + v.w * (i ? .75 : .25), y = port ? v.y + v.h * (i ? .78 : .22) : cy - size * .1; item(e, x, y, size, prog(i), P, i, Math.max(24, size * .2)); });
    const pv = prog(1); if (pv > 0) { g.save(); g.globalAlpha = CUR.GA * clamp(pv * 2); g.translate(cx, cy - size * .05); const k = easeBack(pv); g.scale(k, k);
      g.beginPath(); g.arc(0, 0, size * .2, 0, 6.2832); g.fillStyle = P.ac2; g.fill(); font(size * .2, 900); g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VS', 0, size * .01); g.restore(); }
  } else if (sc.layout === 'list') {
    const rh = Math.min(v.h / n, m * .42), top = cy - rh * n / 2;
    els.forEach((e, i) => {
      const p = prog(i), k = easeBack(p), y = top + i * rh + rh / 2; if (p <= 0) return;
      g.save(); g.globalAlpha = CUR.GA * clamp(p * 1.6); g.translate((1 - clamp(p)) * -70, 0);
      rr(v.x, y - rh * .44, v.w, rh * .88, rh * .22); g.fillStyle = P.pan; g.fill();
      g.beginPath(); g.arc(v.x + rh * .5, y, rh * .33 * k, 0, 6.2832); g.fillStyle = hexA(P.ac, .2); g.fill(); drawIcon(e.asset, v.x + rh * .5, y, rh * .5, P.ac);
      font(rh * .3, 800); g.fillStyle = P.tx; g.textAlign = 'left'; g.textBaseline = 'middle';
      const ls = wrap(e.label, v.w - rh * 1.2).slice(0, 2); ls.forEach((l, j) => g.fillText(l, v.x + rh * 1.0, y + (j - (ls.length - 1) / 2) * rh * .34));
      g.restore();
    });
  } else if (sc.layout === 'stat') {
    const p = prog(0), k = easeBack(p), isz = m * .3; if (p <= 0) return;
    g.save(); g.globalAlpha = CUR.GA * clamp(p * 1.6);
    g.beginPath(); g.arc(cx, v.y + isz * .6, isz * .6, 0, 6.2832); g.fillStyle = hexA(P.ac, .16); g.fill(); drawIcon(els[0].asset, cx, v.y + isz * .6, isz * .8, P.ac);
    g.translate(cx, v.y + isz * 1.55 + m * .17); g.scale(k, k); let fs = m * .3; font(fs, 900); while (g.measureText(sc.value).width > v.w * .95 && fs > 30) { fs *= .92; font(fs, 900); }
    g.fillStyle = P.ac2; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sc.value, 0, 0); g.restore();
    g.save(); g.globalAlpha = CUR.GA * clamp((p - .3) * 2); drawLabel(els[0].label, cx, v.y + isz * 1.55 + m * .17 + m * .22, v.w * .9, m * .085, P); g.restore();
  }
}
function drawFx(kind, T, P, a) {
  if (kind === 'none') return; const W = F.w, H = F.h; g.save(); g.globalAlpha = a;
  if (kind === 'rain') { g.strokeStyle = hexA(P.ac, .4); g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i < 70; i++) { const x = rnd(i, 1) * W, y = (rnd(i, 3) * H + T * (900 + rnd(i, 2) * 700)) % H, l = 30 + rnd(i, 4) * 40; g.moveTo(x, y); g.lineTo(x - l * .15, y + l); } g.stroke(); }
  else if (kind === 'snow') { g.fillStyle = 'rgba(255,255,255,.65)'; for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(rnd(i, 1) * W + Math.sin(T + i) * 20, (rnd(i, 3) * H + T * (60 + rnd(i, 2) * 80)) % H, 3 + rnd(i, 4) * 5, 0, 6.2832); g.fill(); } }
  else if (kind === 'bubbles') { g.strokeStyle = hexA(P.ac, .45); g.lineWidth = 3; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(rnd(i, 1) * W + Math.sin(T * 1.5 + i) * 25, H - (rnd(i, 3) * H + T * (50 + rnd(i, 2) * 70)) % H, 8 + rnd(i, 4) * 22, 0, 6.2832); g.stroke(); } }
  else if (kind === 'sparkle') { for (let i = 0; i < 36; i++) { const x = rnd(i, 1) * W, y = rnd(i, 3) * H, s = 4 + rnd(i, 4) * 9, al = .5 + .5 * Math.sin(T * 3 + i * 3);
    g.fillStyle = hexA(P.ac2, .75 * al); g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x + s * .5, y - s * .5); g.lineTo(x + s * 2, y); g.lineTo(x + s * .5, y + s * .5); g.lineTo(x, y + s * 2); g.lineTo(x - s * .5, y + s * .5); g.lineTo(x - s * 2, y); g.lineTo(x - s * .5, y - s * .5); g.closePath(); g.fill(); } }
  g.restore();
}
function lipLevel() {
  if (!S.playing || !analyser) return 0; analyser.getByteTimeDomainData(lipBuf);
  let s = 0; for (let i = 0; i < lipBuf.length; i++) { const v = (lipBuf[i] - 128) / 128; s += v * v; }
  return clamp(Math.sqrt(s / lipBuf.length) * 6);
}
function drawAvatar(sc, T, a, P, alpha) {
  if (!a) return; const tgt = EMO[sc.emotion] || EMO.neutral, dt = clamp(T - AV.last, 0, .1) || .033; AV.last = T; const k = 1 - Math.exp(-dt * 9);
  Object.keys(tgt).forEach(key => { AV.cur[key] += (tgt[key] - AV.cur[key]) * k; });
  const m = lipLevel(); AV.mouth += (m - AV.mouth) * (m > AV.mouth ? .6 : .25);
  const c = AV.cur, s = a.s, cx = a.x, cy = a.y + Math.sin(T * 2.2) * s * .03;
  const ph = T % 3.6, blink = ph < 3.45 ? 1 : Math.max(.08, Math.abs((ph - 3.525) / .075));
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = P.shirt; g.beginPath(); g.moveTo(cx - s * .85, cy + s * 1.5); g.quadraticCurveTo(cx - s * .8, cy + s * .85, cx, cy + s * .85); g.quadraticCurveTo(cx + s * .8, cy + s * .85, cx + s * .85, cy + s * 1.5); g.closePath(); g.fill();
  g.fillStyle = '#f3c9a0'; g.beginPath(); g.arc(cx - s * 1.0, cy + s * .05, s * .17, 0, 6.2832); g.arc(cx + s * 1.0, cy + s * .05, s * .17, 0, 6.2832); g.fill();
  g.fillStyle = '#ffdcb8'; g.beginPath(); g.arc(cx, cy, s, 0, 6.2832); g.fill();
  g.fillStyle = '#2b1d14'; g.beginPath(); g.arc(cx, cy - s * .08, s * 1.04, Math.PI * 1.04, Math.PI * 1.96); g.quadraticCurveTo(cx + s * .3, cy - s * .55, cx - s * .2, cy - s * .62); g.quadraticCurveTo(cx - s * .75, cy - s * .6, cx - s * .98, cy - s * .3); g.closePath(); g.fill();
  if (c.blush > .05) { g.fillStyle = 'rgba(255,120,130,' + (.38 * c.blush) + ')'; g.beginPath(); g.ellipse(cx - s * .6, cy + s * .3, s * .17, s * .1, 0, 0, 6.2832); g.ellipse(cx + s * .6, cy + s * .3, s * .17, s * .1, 0, 0, 6.2832); g.fill(); }
  [-1, 1].forEach(side => {
    const ex = cx + side * s * .38, ey = cy + s * .02, er = s * .2 * c.eye;
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, s * .2, Math.max(s * .02, er * blink), 0, 0, 6.2832); g.fill();
    if (blink > .3) { g.fillStyle = '#1e1b2e'; g.beginPath(); g.arc(ex + c.lx * s * .07, ey + c.ly * s * .07, s * .095, 0, 6.2832); g.fill(); }
    const by = cy - s * .34 - c.browY * s * .13 - (side === -1 ? c.browAsym * s * .13 : 0);
    g.strokeStyle = '#2b1d14'; g.lineWidth = s * .07; g.lineCap = 'round'; g.beginPath();
    g.moveTo(cx + side * s * .16, by - c.tilt * s * .16); g.lineTo(cx + side * s * .6, by + c.tilt * s * .06); g.stroke();
  });
  const my = cy + s * .52, mw = s * .36 * (1 + c.smile * .15), open = Math.max(AV.mouth, 0) * s * .36;
  if (open > s * .03) { g.fillStyle = '#7a1f2b'; g.beginPath(); g.ellipse(cx, my + open * .4, mw * .8, open * .75 + s * .02, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#e8737f'; g.beginPath(); g.ellipse(cx, my + open * .85, mw * .45, open * .28, 0, 0, 6.2832); g.fill(); }
  else { g.strokeStyle = '#7a1f2b'; g.lineWidth = s * .06; g.beginPath(); g.moveTo(cx - mw, my); g.quadraticCurveTo(cx, my + c.smile * s * .34, cx + mw, my); g.stroke(); }
  g.restore();
}
function drawSubs(T, sc, sb, P) {
  if (!q('msSub').checked) return; let c = null;
  for (const x of sc.chunks) if (T >= x.t0 && T < x.t1 + .12) c = x; if (!c) return;
  const age = T - c.t0, k = .92 + .08 * easeBack(age / .15); font(sb.sz, 800);
  const lines = wrap(c.text, sb.w - sb.sz * 1.2).slice(0, sb.lines), lh = sb.sz * 1.25, w = Math.max(...lines.map(l => g.measureText(l).width)) + sb.sz * 1.1, h = lines.length * lh + sb.sz * .6;
  g.save(); g.translate(sb.x, sb.y); g.scale(k, k); g.globalAlpha = CUR.GA; rr(-w / 2, -h / 2, w, h, sb.sz * .45); g.fillStyle = P.pan; g.fill();
  g.fillStyle = P.tx; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((l, i) => g.fillText(l, 0, (i - (lines.length - 1) / 2) * lh)); g.restore();
}
function draw(T) {
  const W = F.w, H = F.h, P = curPal(), L = lay(), idx = Math.max(0, S.scenes.findIndex((s, i) => T >= s.start && (i === S.scenes.length - 1 || T < S.scenes[i + 1].start)));
  const sc = S.scenes[idx], lt = T - sc.start, fadeOut = clamp((sc.len - lt) / .3), fadeIn = clamp(lt / .25);
  CUR = { lt, GA: Math.min(fadeIn, fadeOut) };
  const gr = g.createLinearGradient(0, 0, W * .3, H); gr.addColorStop(0, P.bg[0]); gr.addColorStop(1, P.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) { const x = W * (.15 + .7 * frac(i * .37 + Math.sin(T * .12 + i) * .1)), y = H * (.1 + .8 * frac(i * .61 + Math.cos(T * .1 + i * 2) * .1)), r = W * (.35 + .1 * i);
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, hexA(P.ac, .13)); rg.addColorStop(1, hexA(P.ac, 0)); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
  drawFx(sc.fx, T, P, CUR.GA);
  const t = L.title; g.save(); g.globalAlpha = CUR.GA; font(t.sz, 900); g.textAlign = 'center'; g.textBaseline = 'middle';
  const tl = wrap(sc.title, t.w).slice(0, 3), ts = easeBack(lt / .5), th = tl.length * t.sz * 1.08; g.translate(t.x, t.y + (1 - clamp(lt / .4)) * 30);
  g.fillStyle = P.tx; tl.forEach((l, i) => g.fillText(l, 0, (i - (tl.length - 1) / 2) * t.sz * 1.08));
  g.fillStyle = P.ac2; rr(-t.w * .1 * clamp(ts), th / 2 + t.sz * .22, t.w * .2 * clamp(ts), t.sz * .09, t.sz * .045); g.fill(); g.restore();
  g.save(); g.globalAlpha = 1; drawVisual(sc, lt, L.vis, P); g.restore();
  drawAvatar(sc, T, L.av, P, CUR.GA); drawSubs(T, sc, L.sub, P);
  if (typeof drawWM === 'function') drawWM(g, W, H);  // watermark: fungsi yang sama dengan menu lain
}

/* ------------------------------ render & export ------------------------------ */
async function render() {
  if (!S.built) return err('Buat voice over & preview dulu.');
  if (!window.MediaRecorder) return err('Browser tidak mendukung MediaRecorder. Pakai Chrome/Edge.');
  ensureAudio(); await ac.resume(); pause(); S.T = 0; S.rec = true; setRes(1);
  const dest = ac.createMediaStreamDestination(); master.connect(dest);
  const mix = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  const parts = [], rec = new MediaRecorder(mix, { mimeType: mime, videoBitsPerSecond: 8e6, audioBitsPerSecond: 192000 });
  rec.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
  rec.onstop = async () => {
    master.disconnect(dest); S.rec = false; setRes(PREVIEW); S.blob = new Blob(parts, { type: 'video/webm' });
    q('msDl').style.display = 'flex'; q('msRStatus').textContent = 'Render selesai (' + S.total.toFixed(1) + ' detik). Tersimpan juga di Dashboard.';
    try { await saveVideoRecord({ id: 'mg' + Date.now(), blob: S.blob, title: S.data.title, mode: 'motion', modeLabel: 'MOTION GRAPHIC',
      formatLabel: F.n + ' ' + F.w + 'x' + F.h, scenes: S.scenes.length, createdAt: new Date().toISOString(), caption: S.data.caption, hashtags: S.data.hashtags }); } catch (e) {}
  };
  rec.start(500); S.recorder = rec; play();
}
function pad(n, l) { return String(n).padStart(l || 2, '0'); }
function srtT(t) { const ms = Math.round(t * 1000); return pad(Math.floor(ms / 3600000)) + ':' + pad(Math.floor(ms / 60000) % 60) + ':' + pad(Math.floor(ms / 1000) % 60) + ',' + pad(ms % 1000, 3); }
function srt() {
  if (!S.built) return; let n = 0, out = '';
  S.scenes.forEach(sc => sc.chunks.forEach(c => { out += (++n) + '\n' + srtT(c.t0) + ' --> ' + srtT(c.t1) + '\n' + c.text + '\n\n'; }));
  dl(new Blob([out], { type: 'text/plain' }), 'subtitle.srt');
}
const slug = () => (S.data ? S.data.title : 'motion').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'motion';
function dlWebm() { if (S.blob) dl(S.blob, slug() + '.webm'); }
async function dlMp4() {
  if (!S.blob) return; q('msRStatus').textContent = 'Mengonversi ke MP4 dengan ffmpeg...';
  try {
    const r = await fetch('/api/to-mp4', { method: 'POST', body: S.blob });
    if ((r.headers.get('content-type') || '').includes('json')) throw new Error((await r.json()).error);
    dl(await r.blob(), slug() + '.mp4'); q('msRStatus').textContent = 'MP4 siap diunduh.';
  } catch (e) { q('msRStatus').textContent = 'Gagal: ' + e.message; }
}

/* ------------------------------ UI wiring ------------------------------ */
async function fillVoices() {
  const eng = q('msEng').value, sel = q('msVoice'), hint = q('msVoiceHint');
  if (eng === 'edge') { sel.innerHTML = VOICES[q('msLang').value].map(v => '<option value="' + v[0] + '">' + v[1] + '</option>').join(''); hint.textContent = 'Butuh internet (suara Microsoft Edge).'; return; }
  sel.innerHTML = '<option value="">(default sistem)</option>'; hint.textContent = 'Memuat suara bawaan komputer...';
  try {
    const r = await (await fetch('/api/offline-voices')).json(); if (r.error) throw new Error(r.error);
    sel.innerHTML = r.voices.map(v => '<option value="' + v.id.replace(/"/g, '&quot;') + '">' + v.name + '</option>').join('');
    const idv = [...sel.options].find(o => /indones|andika|\bid[-_]/i.test(o.text + o.value)); if (idv && q('msLang').value === 'id') sel.value = idv.value;
    hint.textContent = 'Suara terpasang di komputer ini. Pilih yang berbahasa Indonesia bila ada.';
  } catch (e) { hint.textContent = e.message; }
}
async function libAdd() {
  const f = q('msLFile').files[0], m = q('msLMsg'); if (!f) return m.textContent = 'Pilih file dulu.';
  const ext = f.name.split('.').pop().toLowerCase(), sfx = ['wav', 'mp3', 'ogg'].includes(ext), tint = q('msLTint').checked && ext === 'svg';
  const data = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(f); });
  const j = await (await fetch('/api/library/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    id: q('msLId').value, kind: sfx ? 'sfx' : (ext === 'svg' ? 'icon' : 'image'), ext, tags: q('msLTags').value, license: q('msLLic').value,
    author: q('msLAuth').value, source: q('msLAuth').value, tint, data }) })).json();
  m.textContent = j.error ? j.error : 'Tersimpan.'; if (!j.error) loadLib();
}
async function libDel(id) {
  if (!confirm('Hapus aset "' + id + '" dari library?')) return;
  await fetch('/api/library/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); loadLib();
}
function init() {
  q('msPal').innerHTML = '<option value="auto">Auto (pilihan OpenAI)</option>' + Object.keys(PAL).map(k => '<option value="' + k + '">' + PAL[k].n + '</option>').join('');
  q('msEng').onchange = fillVoices; q('msLang').onchange = fillVoices;
  ['msFmt'].forEach(id => q(id).onchange = applyFormat);
  ['msPal', 'msAvPos', 'msSub'].forEach(id => q(id).onchange = redraw);
  q('msSeek').oninput = () => { if (!S.built) return; S.T = q('msSeek').value / 1000 * S.total; if (S.playing) startAudio(S.T); };
  try { wgb(); } catch (e) {}
  fillVoices(); loadLib(); requestAnimationFrame(loop);
}
window.wpv = redraw;  // dipanggil oleh kontrol watermark bawaan (wsp, wl, oninput)
window.MS = { generate, showPrompt, applyJson, buildVoice, toggle, render, srt, dlWebm, dlMp4, libAdd, libDel };
init();
})();
