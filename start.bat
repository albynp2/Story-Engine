@echo off
cd /d %~dp0
set PY=python
%PY% --version >nul 2>nul || set PY=py -3
%PY% --version >nul 2>nul || goto nopython

if not exist venv\Scripts\activate.bat (
  echo Membuat virtual environment baru...
  if exist venv rmdir /s /q venv
  %PY% -m venv venv
)
if not exist venv\Scripts\activate.bat goto novenv

call venv\Scripts\activate.bat
echo Memasang dependensi...
pip install -q -r requirements.txt
python server.py
pause
exit /b 0

:nopython
echo Python belum terpasang atau belum masuk PATH.
echo Install dari https://www.python.org/downloads/ lalu centang "Add python.exe to PATH" saat instalasi.
pause
exit /b 1

:novenv
echo Gagal membuat folder venv. Coba hapus folder venv secara manual lalu jalankan lagi.
pause
exit /b 1
