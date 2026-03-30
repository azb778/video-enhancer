"""Trim video files using FFmpeg."""
import subprocess
import threading
import uuid
from pathlib import Path

UPLOADS_DIR = Path(__file__).parent / "uploads"
OUTPUT_DIR = Path(__file__).parent / "output"
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

trim_jobs = {}


def get_video_duration(path):
    """Return video duration in seconds."""
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", str(path)
    ]
    import json
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        info = json.loads(result.stdout)
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                return float(stream.get("duration", 0))
    except Exception:
        pass
    return 0


def start_trim_job(input_path, start_sec, end_sec):
    job_id = str(uuid.uuid4())[:8]
    trim_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "status_message": "Démarrage...",
        "output_file": None,
        "error": None,
        "duration": end_sec - start_sec,
    }
    thread = threading.Thread(target=_run_trim_job, args=(job_id, input_path, start_sec, end_sec), daemon=True)
    thread.start()
    return job_id


def get_trim_job(job_id):
    return trim_jobs.get(job_id)


def _run_trim_job(job_id, input_path, start_sec, end_sec):
    job = trim_jobs[job_id]
    job["status"] = "processing"
    job["progress"] = 20
    job["status_message"] = "Découpe en cours..."

    input_path = Path(input_path)
    stem = input_path.stem
    output_path = OUTPUT_DIR / f"trimmed_{stem}.mp4"

    duration = end_sec - start_sec

    try:
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_sec),
            "-i", str(input_path),
            "-t", str(duration),
            "-c:v", "libx264", "-c:a", "aac",
            "-avoid_negative_ts", "make_zero",
            str(output_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr[-500:] if result.stderr else "FFmpeg error")

        job["progress"] = 100
        job["status"] = "done"
        job["status_message"] = "Découpe terminée !"
        job["output_file"] = str(output_path)
        job["size_mb"] = round(output_path.stat().st_size / 1024 / 1024, 1)
        job["filename"] = output_path.name

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
        job["progress"] = 0
