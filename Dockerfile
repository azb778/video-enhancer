FROM python:3.11-slim

# Install system deps
RUN apt-get update && apt-get install -y \
    ffmpeg \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Create necessary directories
RUN mkdir -p uploads output downloads data fonts models

ENV PYTHONUNBUFFERED=1
ENV CLOUD_MODE=1

EXPOSE 8080

CMD gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 300 --keep-alive 5
