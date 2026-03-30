"""Remove image background using rembg."""
import threading
import uuid
from pathlib import Path

UPLOADS_DIR = Path(__file__).parent / "uploads"
OUTPUT_DIR = Path(__file__).parent / "output"
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

bg_jobs = {}


def start_bg_job(input_path):
    job_id = str(uuid.uuid4())[:8]
    bg_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "status_message": "Démarrage...",
        "output_file": None,
        "error": None,
    }
    thread = threading.Thread(target=_run_bg_job, args=(job_id, input_path), daemon=True)
    thread.start()
    return job_id


def get_bg_job(job_id):
    return bg_jobs.get(job_id)


def _run_bg_job(job_id, input_path):
    job = bg_jobs[job_id]
    job["status"] = "processing"
    job["progress"] = 15
    job["status_message"] = "Chargement du modèle IA..."

    input_path = Path(input_path)
    output_path = OUTPUT_DIR / f"nobg_{input_path.stem}.png"

    try:
        from rembg import remove
        from PIL import Image

        job["progress"] = 30
        job["status_message"] = "Détection du sujet..."

        with open(str(input_path), "rb") as f:
            input_data = f.read()

        job["progress"] = 60
        job["status_message"] = "Suppression du fond en cours..."

        output_data = remove(input_data)

        job["progress"] = 90
        job["status_message"] = "Sauvegarde..."

        with open(str(output_path), "wb") as f:
            f.write(output_data)

        size_kb = round(output_path.stat().st_size / 1024, 1)
        job["progress"] = 100
        job["status"] = "done"
        job["status_message"] = "Fond supprimé !"
        job["output_file"] = str(output_path)
        job["size_kb"] = size_kb
        job["filename"] = output_path.name

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
        job["progress"] = 0
