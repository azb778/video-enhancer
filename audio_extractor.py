"""Extract audio from video files using FFmpeg."""
import subprocess
import threading
import uuid
from pathlib import Path

UPLOADS_DIR = Path(__file__).parent / "uploads"
OUTPUT_DIR = Path(__file__).parent / "output"
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

audio_jobs = {}


def start_audio_job(input_path, fmt="mp3"):
    job_id = str(uuid.uuid4())[:8]
    audio_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "status_message": "Démarrage...",
        "output_file": None,
        "error": None,
        "format": fmt,
    }
    thread = threading.Thread(target=_run_audio_job, args=(job_id, input_path, fmt), daemon=True)
    thread.start()
    return job_id


def get_audio_job(job_id):
    return audio_jobs.get(job_id)


def _run_audio_job(job_id, input_path, fmt):
    job = audio_jobs[job_id]
    job["status"] = "processing"
    job["progress"] = 10
    job["status_message"] = "Extraction de l'audio..."

    input_path = Path(input_path)
    stem = input_path.stem
    output_path = OUTPUT_DIR / f"audio_{stem}.{fmt}"

    try:
        if fmt == "mp3":
            cmd = ["ffmpeg", "-y", "-i", str(input_path), "-vn", "-acodec", "libmp3lame", "-q:a", "2", str(output_path)]
        else:  # wav
            cmd = ["ffmpeg", "-y", "-i", str(input_path), "-vn", "-acodec", "pcm_s16le", str(output_path)]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr[-500:] if result.stderr else "FFmpeg error")

        job["progress"] = 100
        job["status"] = "done"
        job["status_message"] = "Audio extrait !"
        job["output_file"] = str(output_path)
        job["size_mb"] = round(output_path.stat().st_size / 1024 / 1024, 2)
        job["filename"] = output_path.name

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
        job["progress"] = 0
