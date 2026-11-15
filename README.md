# Story Engine (lokal)

Topik satu kalimat → naskah (OpenAI) → gambar (Google Flow via ekstensi) → suara (Edge TTS atau upload dari Google AI Studio) → subtitle → video, dengan backsound, SFX, dan statistik di Dashboard.

## Jalankan
- Windows: klik `start.bat`  ·  Mac/Linux: `./start.sh`  ·  Docker: `docker build -t story-engine . && docker run -p 8000:8000 story-engine`
- Buka http://localhost:8000
- Isi OpenAI API key di **Settings** (atau set environment variable `OPENAI_API_KEY`).

## Menu
| Menu | Fungsi |
|---|---|
| **Dashboard** | Kartu total (hari ini / 7 hari / bulan ini / semua), grafik 14 hari, total per menu (bisa filter tanggal), dan semua video dikelompokkan **Menu → Tanggal**. Statistik tetap tercatat walau video dihapus. |
| **Manual Footage** | Alur lama (prompt → JSON → upload gambar & suara sendiri), tapi naskah wajib **faktual**. |
| **Explainer** | Satu kalimat topik, bahasa, durasi 1/3/5 menit, 16 tema (Flat Vector … Stickman). Tombol **Generate otomatis**. |
| **Drama AI** | Sama seperti Explainer tapi **fiksi** dengan karakter AI konsisten (karakter dari Settings). |
| **Stickman** | Stickman cepat + lucu: hook di adegan 1, wajah ekspresif, reaksi meme, kamera cepat (zoom/shake/whip/pan), subtitle besar kuning huruf besar, SFX per adegan. |
| **Fact Explainer** | Video explainer berbasis fakta (menu baru, bertahap). Project disimpan sebagai folder di `data/projects/<id>/` (`project.json`, `research/`, `script/`, `storyboard/`, `prompts/`, `references/`, `videos/`, `audio/`, `subtitles/`, `output/`). Saat ini aktif: form topik, daftar project, dan panel progress per tahap dengan error berkode. Tahap Research sampai QC menyusul; yang belum tersedia ditandai dan tidak dijalankan diam-diam. |
| **Settings** | Status sistem, OpenAI, library backsound / SFX / meme / karakter, panduan ekstensi Flow. |

Menu News, Horror AI, Psychology, Motion Graphic, History Stickman dan library ikon sudah dihapus.

## Alur Generate otomatis
1. **Naskah**: OpenAI menulis JSON adegan. Menu faktual memakai aturan anti-karangan (lihat bawah).
2. **Cek fakta** (berhenti di sini kalau kotak dicentang, default aktif): lihat sumber, catatan AI, dan peringatan angka. Klik **Lanjutkan** kalau aman.
3. **Gambar**: ekstensi Flow mengetik prompt tiap adegan di Google Flow dan mengirim gambarnya balik ke engine. Atau pilih "Upload sendiri".
4. **Suara**: Edge TTS otomatis, atau pilih "Upload dari Google AI Studio" (engine berhenti, lu salin naskah di langkah 4, upload audio, klik Lanjutkan).
5. **Render**: video dirender di browser (real-time) lalu otomatis masuk Dashboard.

Jumlah adegan: 1 menit = 10, 3 menit = 30, 5 menit = 50 (1 adegan = 1 gambar).

## Aturan naskah faktual
Berlaku di Manual Footage, Explainer, Stickman (Drama AI fiksi dikecualikan):
- Prompt melarang mengarang orang, kutipan, angka, tanggal, tempat, atau peristiwa; topik sejarah harus peristiwa nyata yang terdokumentasi.
- Kalau topik tidak nyata / tidak bisa ditulis tanpa mengarang, AI membalas `{"error": ...}` dan engine menampilkan penolakan.
- Ada kolom **Bahan / sumber faktual**: kalau diisi, AI hanya boleh memakai bahan itu. Angka di naskah dicek terhadapnya, yang tidak ada di sumber diberi peringatan.
- AI wajib mengisi `sources` dan `fact_basis` per adegan. Tetap **cek sendiri**: AI bisa salah, termasuk soal nama sumber.
- Judul terlalu pendek (< 3 kata) ditolak.

## Backsound & SFX
Upload sekali di **Settings**, pilih di tiap menu. Volume saat narasi diatur (default 18%). Backsound penuh di intro, turun saat narasi, naik lagi di outro. Ducking ini berdasarkan waktu adegan, bukan deteksi suara langsung. SFX diputar tiap pergantian adegan (di Stickman dipilih AI per adegan). Template meme (tag: shock, facepalm, laugh, think, cry, mindblown, sus) muncul di pojok saat adegan punya reaksi itu. Pakai musik/gambar yang lu punya hak pakainya.
SFX online gratis: `tools/fetch_freesound.py` (butuh API key Freesound gratis, belum diuji).

## Ekstensi Google Flow
- **Chrome**: `chrome://extensions` → Developer mode → Load unpacked → folder `flow-extension`.
- **Firefox**: `about:debugging` → This Firefox → Load Temporary Add-on → `flow-extension-firefox/manifest.json` (izinkan akses situs di about:addons).
- Buka Flow di **https://flow.google** (Flow pindah ke sini sejak relaunch Feb 2026; `labs.google` juga masih didukung), login, biarkan tab terbuka. Setelah memasang/mengubah ekstensi: **Reload** ekstensi di `chrome://extensions` (versi harus 1.0.1) lalu **refresh** tab Flow.
- Tanda ekstensi aktif: kotak kecil "Story Engine: ..." di pojok kiri bawah tab Flow. Kalau tulisannya "tidak bisa menghubungi engine", server tidak jalan di `http://localhost:8000`. Status "Ekstensi Flow" di sidebar jadi hijau kalau sudah terhubung.
- Tiap job membuka project baru di Flow, lalu membuat gambar satu per satu.
- **Kalau macet**: ubah `selectors.js` (kotak prompt, tombol generate, project baru, batas waktu).

## Karakter Drama (konsistensi wajah)
Cara paling aman: buat karakter fiktif (character sheet) di Flow/Gemini, upload di Settings → Karakter beserta deskripsi tampilannya. Deskripsi disalin kata demi kata ke tiap prompt dan gambar dikirim ke Flow sebagai referensi (best effort). Jangan pakai foto orang lain tanpa izin; Flow juga bisa menolak foto orang asli.

## Yang perlu lu tahu (jujur)
- **Sudah dites otomatis** (Chromium headless): semua halaman, status sistem, prompt tiap menu, alur otomatis penuh dengan OpenAI/TTS/Flow yang dipalsukan, render video, backsound + ducking (diukur dari audio hasil), SFX, meme, kamera cepat, Dashboard + statistik, upload library via UI, antrian Flow di server (`python tests/test_server.py`). Fact Explainer: `python tests/test_fact_project.py`.
- **Belum bisa dites dari sini**: OpenAI sungguhan, Edge TTS (butuh internet), **Google Flow sungguhan** (selector tebakan, lu yang test dan sesuaikan `selectors.js`), ekstensi di Firefox, lampiran referensi karakter ke Flow.
- Otomatisasi UI Flow tidak resmi: bisa rusak kalau tampilan berubah, dan bisa melanggar ketentuan layanan Google. Pakai akun cadangan.
- Kuota/kredit Flow terbatas. 50 gambar untuk video 5 menit bisa menghabiskan kuota harian.
- Render real-time: video 5 menit butuh ±5 menit dengan tab tetap terbuka. Hasil `.webm` (konversi MP4 butuh FFmpeg).
- Menu lama yang sudah tersimpan di Dashboard muncul di grup "Menu lama".
- Server sekarang mendengarkan di **127.0.0.1** (hanya laptop ini). Docker sudah diset `SE_HOST=0.0.0.0` di Dockerfile. Kalau perlu akses dari perangkat lain tanpa Docker: set environment variable `SE_HOST=0.0.0.0`. Lokasi project bisa diganti lewat `SE_PROJECTS_DIR`.
