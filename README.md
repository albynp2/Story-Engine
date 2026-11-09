# Story Engine — AI Content Studio

Local AI content engine dengan satu workflow untuk 6 content pillar:

1. EXPLAINER
2. NEWS
3. DRAMA AI
4. HORROR AI
5. PSYCHOLOGY
6. HISTORY STICKMAN
7. MOTION GRAPHIC (Motion Studio: topik -> naskah OpenAI -> motion graphic otomatis + voice over + subtitle + avatar)

## Jalankan dengan Docker

Dari folder yang berisi `docker-compose.yml`:

```bash
docker compose up --build
```

Buka `http://localhost:8000`.

Stop:

```bash
docker compose down
```

## Workflow

Setiap menu memakai engine inti yang sama:

Judul/topik → Content DNA → prompt ChatGPT → JSON cerita → prompt Google Flow → upload gambar → voice over → subtitle → render video.

Menu kiri menentukan Content DNA agar gaya naskah, visual, karakter, camera language, dan pacing tidak tercampur antar jenis konten.

### NEWS
Tempelkan bahan/ringkasan berita pada kolom konteks berita. Engine menginstruksikan model untuk memisahkan fakta dan ketidakpastian serta tidak mengarang detail. Visual AI diposisikan sebagai rekonstruksi/ilustrasi, bukan footage asli.

### OpenAI API
Bisa tetap memakai mode manual seperti versi sebelumnya. Untuk mode otomatis, isi API key pada menu langkah 2 atau gunakan environment variable `OPENAI_API_KEY`.

Contoh `.env`:

```env
OPENAI_API_KEY=sk-...
```

Jangan commit `.env` ke Git.

## Output
Engine saat ini merender video `.webm` melalui browser.

## Motion Studio (menu MOTION GRAPHIC)

Alur: **topik + durasi -> OpenAI menulis naskah (JSON scene) -> voice over per scene -> motion graphic otomatis -> render video berisi suara.**

- OpenAI hanya boleh memilih aset yang ada di `library/index.json`, jadi hasil JSON pasti bisa digambar.
- Layout otomatis per scene: flow, cycle, compare, list, stat, center. Plus efek latar (hujan, salju, gelembung, kilau) dan SFX dari library.
- Subtitle dibuat dari naskah dan diselaraskan dengan durasi suara. Bisa diunduh sebagai `.srt`.
- Avatar: mulut mengikuti volume suara (lip-sync sederhana), ekspresi mengikuti field `emotion` tiap scene, plus kedip otomatis.
- Suara: **Edge TTS** (online, gratis) atau **Offline** (`pyttsx3`, suara bawaan Windows; bahasa Indonesia tergantung language pack yang terpasang).
- Format output: Instagram/TikTok/Facebook/YouTube Shorts 1080x1920, Square 1080x1080, YouTube 1920x1080.
- Render berjalan real-time lewat browser (1 menit video = 1 menit), hasil `.webm` + suara. Tombol **Download MP4** memakai `ffmpeg` lokal (harus ada di PATH). Biarkan tab tetap terbuka saat render.
- Tanpa API key: pakai mode manual (salin prompt, tempel ke ChatGPT, tempel JSON hasilnya).

### Library aset
`library/icons`, `library/sfx`, `library/index.json` (id, tag, lisensi, penulis, sumber). Isi awal: 40 ikon SVG dan 8 SFX buatan sendiri (CC0).
Tambah lewat bagian *Library Aset* di halaman Motion Graphic, atau `python tools/fetch_freesound.py "rain" --max 3` (hanya lisensi CC0, butuh `FREESOUND_API_KEY`; script ini belum pernah diuji).
Aturan aman: simpan hanya aset CC0 atau yang jelas boleh komersial. Jangan pakai CC-BY-NC bila video dimonetisasi. Aset CC-BY wajib dikreditkan.
