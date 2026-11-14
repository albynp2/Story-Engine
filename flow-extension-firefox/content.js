/* Berjalan di tab Google Flow. Mengambil job dari Story Engine, mengetik prompt, menunggu gambar,
   lalu mengirim gambar balik ke engine. Selector ada di selectors.js. */
(function () {
  if (window.__seFlow) return; window.__seFlow = true;
  var S = window.FLOW_SEL, busy = false, stopFlag = false;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function bg(msg) { return new Promise(function (res) { chrome.runtime.sendMessage(msg, function (r) { res(r || { error: 'tidak ada respons' }); }); }); }
  function api(path, method, body) { return bg({ type: 'api', base: S.engine, path: path, method: method || 'GET', body: body }); }

  /* --- banner status --- */
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;background:#111b26;color:#e7edf5;font:12px system-ui;padding:8px 12px;border:1px solid #f04452;border-radius:10px;max-width:340px;box-shadow:0 4px 18px #0008';
  bar.textContent = 'Story Engine: terhubung';
  document.documentElement.appendChild(bar);
  function say(t) { bar.textContent = 'Story Engine: ' + t; }

  /* --- util DOM --- */
  function vis(el) { var r = el.getBoundingClientRect(); return r.width > 20 && r.height > 14 && getComputedStyle(el).visibility !== 'hidden'; }
  function findAll(list) { var o = []; list.forEach(function (q) { try { document.querySelectorAll(q).forEach(function (e) { if (o.indexOf(e) < 0 && vis(e)) o.push(e); }); } catch (e) { } }); return o; }
  function promptBox() {
    var c = findAll(S.promptBox).filter(function (e) { return !e.closest('[aria-hidden="true"]') && e !== bar; });
    c.sort(function (a, b) { var A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return B.width * B.height - A.width * A.height; });
    return c[0] || null;
  }
  function btnText(b) { return ((b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '') + ' ' + (b.title || '')).trim(); }
  function findByText(re, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll('button,[role="button"]')).filter(function (b) { return vis(b) && re.test(btnText(b)) && !b.disabled; });
  }
  function setPrompt(box, text) {
    box.focus();
    if (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT') {
      var set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value').set; set.call(box, text);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      var sel = window.getSelection(), rg = document.createRange(); rg.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(rg);
      if (!document.execCommand('insertText', false, text)) { box.textContent = text; box.dispatchEvent(new InputEvent('input', { bubbles: true })); }
    }
  }
  function clickGenerate(box) {
    var c = findAll(S.generateBtn).filter(function (b) { return !b.disabled; });
    if (!c.length) {
      var root = box; for (var i = 0; i < 5 && root.parentElement; i++) root = root.parentElement;
      c = findByText(S.generateText, root);
    }
    if (c.length) { c[c.length - 1].click(); return true; }
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    return false;
  }
  function imgs() {
    return Array.prototype.slice.call(document.images).filter(function (i) { return i.complete && i.naturalWidth >= S.minImageSize && i.naturalHeight >= S.minImageSize && vis(i); });
  }
  async function newProject() {
    var c = findAll(S.newProjectBtn).concat(findByText(S.newProjectText));
    if (c.length) { c[0].click(); say('membuat project baru...'); await sleep(2500); }
  }
  async function waitPromptBox(sec) {
    for (var i = 0; i < sec * 2; i++) { var b = promptBox(); if (b) return b; await sleep(500); }
    throw new Error('Kotak prompt Flow tidak ditemukan. Cek selectors.js.');
  }
  async function toB64FromUrl(url) {
    if (/^(blob|data):/.test(url) || url.indexOf(location.origin) === 0) {
      try { var r = await fetch(url); var buf = await r.arrayBuffer(), b = new Uint8Array(buf), s = '', n = 0x8000; for (var i = 0; i < b.length; i += n) s += String.fromCharCode.apply(null, b.subarray(i, i + n)); return btoa(s); } catch (e) { }
    }
    var x = await bg({ type: 'image', url: url });
    if (x.error) throw new Error('Gagal mengambil gambar: ' + x.error);
    return x.data;
  }
  async function attachRefs(refs) {
    if (!refs || !refs.length) return '';
    var inp = document.querySelector('input[type="file"]');
    if (!inp) return 'referensi tidak bisa dilampirkan (input file tidak ditemukan)';
    var dt = new DataTransfer();
    for (var k = 0; k < refs.length; k++) {
      var x = await bg({ type: 'image', url: refs[k] }); if (x.error) continue;
      var bin = atob(x.data), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      dt.items.add(new File([u], 'ref' + (k + 1) + '.png', { type: x.type || 'image/png' }));
    }
    inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(1500); return '';
  }

  async function genOne(job, p) {
    var box = await waitPromptBox(20), note = await attachRefs(p.refs);
    if (note) await api('/api/flow/progress', 'POST', { id: job.id, msg: 'Adegan ' + p.no + ': ' + note });
    var before = new Set(imgs().map(function (i) { return i.currentSrc || i.src; }));
    box = await waitPromptBox(10); setPrompt(box, p.prompt); await sleep(500);
    clickGenerate(box);
    var t0 = Date.now(), found = null;
    while (Date.now() - t0 < S.imageTimeout * 1000) {
      if (stopFlag) throw new Error('dibatalkan');
      var fresh = imgs().filter(function (i) { return !before.has(i.currentSrc || i.src); });
      if (fresh.length) { await sleep(2500); fresh = imgs().filter(function (i) { return !before.has(i.currentSrc || i.src); }); found = fresh[0]; break; }
      await sleep(1500);
    }
    if (!found) throw new Error('Adegan ' + p.no + ': gambar tidak muncul dalam ' + S.imageTimeout + ' detik (kena limit, ditolak kebijakan, atau selector salah)');
    var data = await toB64FromUrl(found.currentSrc || found.src);
    var r = await api('/api/flow/result', 'POST', { id: job.id, no: p.no, data: data });
    if (r.error) throw new Error(r.error);
  }
  async function runJob(job) {
    stopFlag = false; say('mengerjakan "' + job.title + '"');
    if (!job.done.length) await newProject();
    var todo = job.prompts.filter(function (p) { return job.done.indexOf(p.no) < 0; });
    for (var i = 0; i < todo.length; i++) {
      var st = await api('/api/flow/job?id=' + job.id);
      if (st.status === 'cancelled') { say('dibatalkan'); return; }
      say('adegan ' + todo[i].no + ' (' + (i + 1) + '/' + todo.length + ')');
      await api('/api/flow/progress', 'POST', { id: job.id, msg: 'Membuat adegan ' + todo[i].no + ' (' + (i + 1) + '/' + todo.length + ')' });
      await genOne(job, todo[i]);
      await sleep(1500);
    }
    say('selesai');
  }
  async function poll() {
    if (busy) return;
    var r = await api('/api/flow/next');
    if (!r || r.error || !r.job) return;
    busy = true;
    try { await runJob(r.job); }
    catch (e) { say('error: ' + e.message); await api('/api/flow/progress', 'POST', { id: r.job.id, status: 'error', msg: e.message }); }
    busy = false;
  }
  setInterval(poll, 3000); poll();
})();
