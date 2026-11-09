"""TTS offline via pyttsx3 (SAPI5 di Windows). Dipanggil server.py sebagai subprocess
supaya aman dari masalah thread/COM.
  python offline_tts.py --list
  python offline_tts.py teks.txt out.wav <rate_persen> [voice_id]
"""
import sys, json

def main():
    import pyttsx3
    eng = pyttsx3.init()
    if sys.argv[1] == "--list":
        print(json.dumps([{"id": v.id, "name": v.name} for v in eng.getProperty("voices")]))
        return
    text = open(sys.argv[1], encoding="utf-8").read()
    out, pct = sys.argv[2], int(sys.argv[3])
    if len(sys.argv) > 4 and sys.argv[4]:
        eng.setProperty("voice", sys.argv[4])
    eng.setProperty("rate", int(eng.getProperty("rate") * (1 + pct / 100)))
    eng.save_to_file(text, out)
    eng.runAndWait()

if __name__ == "__main__":
    main()
