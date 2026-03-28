"""
Image enhancement using Real-ESRGAN.
Supports PNG, JPEG, WebP input. Outputs PNG (lossless).
"""

import threading
import uuid
from pathlib import Path

import cv2
import numpy as np

UPLOADS_DIR = Path(__file__).parent / "uploads"
OUTPUT_DIR = Path(__file__).parent / "output"

# Store image job statuses
image_jobs = {}


def get_image_info(filepath):
    """Get image metadata."""
    filepath = Path(filepath)
    img = cv2.imread(str(filepath), cv2.IMREAD_UNCHANGED)
    if img is None:
        raise RuntimeError(f"Cannot read image: {filepath}")

    h, w = img.shape[:2]
    channels = img.shape[2] if len(img.shape) == 3 else 1
    size_bytes = filepath.stat().st_size
    ext = filepath.suffix.lower().lstrip(".")

    return {
        "width": w,
        "height": h,
        "resolution": f"{w}x{h}",
        "channels": channels,
        "format": ext.upper(),
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / (1024 * 1024), 2),
        "size_kb": round(size_bytes / 1024, 1),
    }


def process_image(job_id):
    """Enhance a single image with Real-ESRGAN."""
    from ai_enhancer import load_model, upscale_image

    job = image_jobs[job_id]
    input_path = Path(job["input_file"])
    target_scale = job.get("scale", 2)

    try:
        job["status"] = "analyzing"
        job["progress"] = 5
        job["status_message"] = "Analyse de l'image..."

        # Get input info
        input_info = get_image_info(input_path)
        job["input_info"] = input_info

        # Read image
        job["status"] = "processing"
        job["progress"] = 10
        job["status_message"] = "Chargement du modele IA..."

        img = cv2.imread(str(input_path), cv2.IMREAD_COLOR)
        if img is None:
            raise RuntimeError("Impossible de lire l'image")

        # Handle alpha channel separately
        has_alpha = False
        alpha_channel = None
        img_full = cv2.imread(str(input_path), cv2.IMREAD_UNCHANGED)
        if img_full is not None and len(img_full.shape) == 3 and img_full.shape[2] == 4:
            has_alpha = True
            alpha_channel = img_full[:, :, 3]

        # Load model
        model, device = load_model("realesr-general-x4v3")

        job["progress"] = 20
        job["status_message"] = "Amelioration IA en cours..."

        # Upscale (always x4 from model, then resize to target)
        output = upscale_image(model, device, img, tile_size=512, tile_pad=10, scale=4)

        job["progress"] = 80
        job["status_message"] = "Redimensionnement..."

        # Resize to target scale if not x4
        if target_scale != 4:
            h, w = img.shape[:2]
            target_h = int(h * target_scale)
            target_w = int(w * target_scale)
            output = cv2.resize(output, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)

        # Handle alpha channel
        if has_alpha and alpha_channel is not None:
            # Upscale alpha channel
            target_h, target_w = output.shape[:2]
            alpha_resized = cv2.resize(alpha_channel, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
            # Merge back
            output = cv2.cvtColor(output, cv2.COLOR_BGR2BGRA)
            output[:, :, 3] = alpha_resized

        job["progress"] = 90
        job["status_message"] = "Sauvegarde..."

        # Determine output format - always PNG for best quality
        output_filename = f"{job_id}_enhanced.png"
        output_path = OUTPUT_DIR / output_filename

        # Save with maximum quality
        if has_alpha:
            cv2.imwrite(str(output_path), output, [cv2.IMWRITE_PNG_COMPRESSION, 3])
        else:
            cv2.imwrite(str(output_path), output, [cv2.IMWRITE_PNG_COMPRESSION, 3])

        # Clean up GPU memory
        del model
        import torch
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
        elif torch.cuda.is_available():
            torch.cuda.empty_cache()

        # Get output info
        output_info = get_image_info(output_path)
        job["output_info"] = output_info
        job["output_file"] = str(output_path)
        job["progress"] = 100
        job["status"] = "done"
        job["status_message"] = "Termine !"

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


def start_image_job(input_filepath, scale=2):
    """Create a new image processing job."""
    job_id = str(uuid.uuid4())[:8]
    image_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "scale": scale,
        "input_file": str(input_filepath),
        "output_file": None,
        "input_info": None,
        "output_info": None,
        "error": None,
        "status_message": "",
    }
    thread = threading.Thread(target=process_image, args=(job_id,), daemon=True)
    thread.start()
    return job_id


def get_image_job(job_id):
    """Get image job status."""
    return image_jobs.get(job_id)
