/* Ubah file ini kalau tampilan Google Flow berubah dan ekstensi macet.
<<<<<<< HEAD
   Semua daftar dicoba berurutan sampai ada yang cocok.
   Catatan: Flow pindah ke https://flow.google (relaunch Feb 2026) dan UI-nya didesain ulang,
   jadi selector di bawah masih tebakan dan mungkin perlu disesuaikan. */
=======
   Semua daftar dicoba berurutan sampai ada yang cocok. */
>>>>>>> 2c3ca03c71db8b4c9842013b69df3211a8f67c2a
window.FLOW_SEL = {
  engine: 'http://localhost:8000',
  /* kotak prompt */
  promptBox: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
  /* tombol generate (dicari lewat selector, lalu lewat teks/aria-label di bawah) */
  generateBtn: ['button[aria-label*="enerate" i]', 'button[aria-label*="reate" i]', 'button[type="submit"]'],
  generateText: /generate|create|buat|arrow_forward|send/i,
  /* tombol project baru */
  newProjectBtn: ['button[aria-label*="new project" i]'],
  newProjectText: /new project|proyek baru|project baru/i,
  /* gambar hasil: ukuran minimal (px) supaya ikon/avatar tidak ikut terhitung */
  minImageSize: 300,
  /* batas waktu tunggu per gambar (detik) */
  imageTimeout: 180
};
