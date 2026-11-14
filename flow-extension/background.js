/* Perantara fetch ke engine lokal dan ke URL gambar (content script terkena batasan CORS/mixed-content). */
function toB64(buf) {
  var b = new Uint8Array(buf), s = '', n = 0x8000;
  for (var i = 0; i < b.length; i += n) s += String.fromCharCode.apply(null, b.subarray(i, i + n));
  return btoa(s);
}
chrome.runtime.onMessage.addListener(function (m, sender, send) {
  (async function () {
    try {
      if (m.type === 'api') {
        var r = await fetch(m.base + m.path, { method: m.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: m.body ? JSON.stringify(m.body) : undefined });
        send(await r.json());
      } else if (m.type === 'image') {
        var r2 = await fetch(m.url);
        if (!r2.ok) throw new Error('HTTP ' + r2.status);
        send({ data: toB64(await r2.arrayBuffer()), type: r2.headers.get('Content-Type') || '' });
      }
    } catch (e) { send({ error: String(e && e.message || e) }); }
  })();
  return true;
});
