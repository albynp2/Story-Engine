# Story Engine — AI Content Studio

Local AI content engine dengan satu workflow untuk 6 content pillar:

1. EXPLAINER
2. NEWS
3. DRAMA AI
4. HORROR AI
5. PSYCHOLOGY
6. HISTORY STICKMAN

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
