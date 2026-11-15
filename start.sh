#!/bin/bash
cd "$(dirname "$0")"
if [ ! -f venv/bin/activate ]; then
  echo "Membuat virtual environment baru..."
  rm -rf venv
  python3 -m venv venv || { echo "Gagal membuat venv. Pastikan python3 terpasang."; exit 1; }
fi
source venv/bin/activate
pip install -q -r requirements.txt
python server.py
