FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV SE_HOST=0.0.0.0
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "server.py"]
