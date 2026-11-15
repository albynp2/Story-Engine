/* Story Engine - Settings: status sistem, OpenAI, library backsound/SFX/meme/karakter, ekstensi Flow. */
var KINDS = {
  bgm: { box: 'libBgm', title: 'Backsound', accept: 'audio/*', ext: /\.(mp3|wav|ogg)$/i, lic: true },
  sfx: { box: 'libSfx', title: 'SFX', accept: 'audio/*', ext: /\.(mp3|wav|ogg)$/i, lic: true },
  meme: { box: 'libMeme', title: 'Meme', accept: 'image/png,image/jpeg,image/webp', ext: /\.(png|jpe?g|webp)$/i, lic: true },
  char: { box: 'libChar', title: 'Karakter', accept: 'image/png,image/jpeg,image/webp', ext: /\.(png|jpe?g|webp)$/i, lic: false }
};
function slug(t) { var s = String(t || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36); return s.length < 2 ? (s + '_x').slice(0, 40) : s; }
function b64(file) {
  return new Promise(function (res, rej) {
    var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = function () { rej(new Error('File tidak bisa dibaca')); }; r.readAsDataURL(file);
  });
}
function renderLibs() {
  return libLoad().then(function () {
    Object.keys(KINDS).forEach(function (k) {
      var L = libAssets(k), el = $(KINDS[k].box);
      if (!el) return;
      el.innerHTML = L.length ? L.map(function (a) {
        var media = (k === 'bgm' || k === 'sfx') ? '<audio controls preload="none" src="' + libFile(a) + '"></audio>' : '<img src="' + libFile(a) + '" alt="">';
        return '<div class="libitem">' + media + '<span><b>' + esc(a.id) + '</b>' + (a.tags && a.tags.length ? ' · ' + esc(a.tags.join(', ')) : '') +
          (k === 'char' && a.source ? '<br><small class="subtle">' + esc(a.source) + '</small>' : '') + '<br><small class="subtle">' + esc(a.license || '') + '</small></span>' +
          '<button class="g" onclick="libDel(\'' + esc(a.id) + '\')">Hapus</button></div>';
      }).join('') : '<div class="empty" style="padding:14px">Belum ada ' + KINDS[k].title.toLowerCase() + '.</div>';
    });
  });
}
function libDel(id) {
  if (!confirm('Hapus "' + id + '" dari library?')) return;
  jpost('/api/library/delete', { id: id }).then(function (j) { if (j.error) throw new Error(j.error); seToast('Dihapus'); renderLibs(); }).catch(function (e) { alert(e.message); });
}
function libUpload(kind) {
  var K = KINDS[kind], f = $('f_' + kind).files[0], name = $('n_' + kind).value.trim(), msg = $('m_' + kind);
  msg.textContent = '';
  if (!f) { msg.textContent = 'Pilih file dulu.'; return; }
  if (!K.ext.test(f.name)) { msg.textContent = 'Format file tidak didukung.'; return; }
  if (!name) name = f.name.replace(/\.\w+$/, '');
  if (K.lic && !$('l_' + kind).checked) { msg.textContent = 'Centang konfirmasi hak pakai dulu.'; return; }
  if (kind === 'char' && !$('d_char').value.trim()) { msg.textContent = 'Isi deskripsi tampilan karakter (wajah, rambut, usia, pakaian).'; return; }
  var id = slug(name), ext = f.name.split('.').pop().toLowerCase(), used = (LIBIDX.assets || []).map(function (a) { return a.id; });
  if (used.indexOf(id) >= 0) id = (id + '_' + Date.now().toString(36)).slice(0, 40);
  b64(f).then(function (data) {
    return jpost('/api/library/add', {
      id: id, kind: kind, ext: ext, data: data,
      tags: kind === 'meme' ? $('t_meme').value : (kind === 'bgm' ? $('t_bgm').value : ''),
      license: K.lic ? ($('lic_' + kind).value.trim() || 'dikonfirmasi pengguna') : 'unggahan sendiri',
      author: '', source: kind === 'char' ? $('d_char').value.trim() : ''
    });
  }).then(function (j) {
    if (j.error) throw new Error(j.error);
    $('f_' + kind).value = ''; $('n_' + kind).value = ''; seToast('Data berhasil tersimpan'); renderLibs();
  }).catch(function (e) { msg.textContent = 'Gagal: ' + e.message; });
}
function renderStatus(h) {
  var el = $('stBox'); if (!el) return;
  var s = getSettings(), oa = !!(h && (h.openai_env || s.openaiKey));
  function r(ok, n, why) { return '<div class="libitem"><i class="dot ' + (ok ? 'green' : 'red') + '"></i><span><b>' + n + '</b><br><small class="subtle">' + why + '</small></span></div>'; }
  el.innerHTML =
    r(!!h, 'Server lokal', h ? 'Berjalan.' : 'Tidak terjangkau. Pastikan server.py masih jalan.') +
    r(oa, 'OpenAI', oa ? (s.openaiKey ? 'API key tersimpan di browser ini.' : 'Memakai OPENAI_API_KEY dari server.') : 'API key belum diisi (isi di bawah).') +
    r(h && h.ffmpeg, 'FFmpeg', h && h.ffmpeg ? 'Terpasang (dipakai untuk konversi MP4).' : 'Tidak ditemukan. Video tetap jadi (.webm), hanya konversi MP4 yang tidak tersedia.') +
    r(h && h.edge, 'Edge TTS', h && h.edge ? 'Terpasang (suara narasi otomatis, butuh internet).' : 'Belum terpasang. Jalankan: pip install edge-tts') +
    r(h && h.flow_ext, 'Ekstensi Google Flow', h && h.flow_ext ? 'Terhubung (ada tab Flow terbuka).' : 'Belum terhubung. Pasang ekstensi dan buka tab Google Flow yang sudah login.');
}
document.addEventListener('se-health', function (e) { renderStatus(e.detail); });
function initSettings() {
  loadSettings(); renderLibs();
  if (window.seHealth !== undefined) renderStatus(window.seHealth);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSettings); else initSettings();
