import os
from pathlib import Path

from flask import Flask, render_template, request, jsonify, send_file

from video_processor import start_job, get_job, get_video_info, UPLOADS_DIR, OUTPUT_DIR
from tiktok_downloader import start_tiktok_job, get_tiktok_job, DOWNLOADS_DIR
from image_processor import start_image_job, get_image_job
from captions_processor import (
    start_captions_job, get_captions_job,
    start_captions_batch, get_captions_batch,
    TEMPLATES as CAPTION_TEMPLATES,
)
from shopify_scraper import (
    fetch_collections, start_scrape_job, get_scrape_job,
    start_analyse_job, get_analyse_job,
)
from inventory_tracker import (
    add_tracked_store, get_tracked_stores, remove_tracked_store,
    start_scan_job, get_scan_job, get_store_sales_data,
    start_background_scanner,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024 * 1024  # 4 GB max upload

# Ensure dirs exist
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
DOWNLOADS_DIR.mkdir(exist_ok=True)

# Set output dir for scraper
import shopify_scraper
shopify_scraper.OUTPUT_DIR = OUTPUT_DIR


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".mp4"):
        return jsonify({"error": "Only MP4 files are accepted"}), 400

    # Save uploaded file
    import uuid
    file_id = str(uuid.uuid4())[:8]
    safe_name = f"{file_id}_{file.filename}"
    filepath = UPLOADS_DIR / safe_name
    file.save(str(filepath))

    # Get processing options
    mode = request.form.get("mode", "ffmpeg")  # "ffmpeg" or "ai"
    scale = int(request.form.get("scale", 2))  # 1, 2, or 4
    fps_boost = int(request.form.get("fps_boost", 1))  # 1, 2, or 4

    # Start processing job
    job_id = start_job(filepath, mode=mode, scale=scale, fps_boost=fps_boost)

    return jsonify({"job_id": job_id})


@app.route("/status/<job_id>")
def status(job_id):
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    response = {
        "status": job["status"],
        "progress": job["progress"],
        "error": job["error"],
        "mode": job.get("mode", "ffmpeg"),
        "status_message": job.get("status_message", ""),
    }

    if job["input_info"]:
        response["input_info"] = job["input_info"]

    if job["output_info"]:
        response["output_info"] = job["output_info"]
        response["compression_ratio"] = job["compression_ratio"]

    return jsonify(response)


@app.route("/download/<job_id>")
def download(job_id):
    job = get_job(job_id)
    if not job or job["status"] != "done":
        return jsonify({"error": "File not ready"}), 404

    output_path = Path(job["output_file"])
    return send_file(
        str(output_path),
        as_attachment=True,
        download_name=f"enhanced_{output_path.name}",
        mimetype="video/mp4"
    )


@app.route("/tiktok", methods=["POST"])
def tiktok():
    data = request.get_json()
    if not data or "urls" not in data:
        return jsonify({"error": "No URLs provided"}), 400

    urls = data["urls"]
    if isinstance(urls, str):
        # Split by newlines, commas, or spaces
        import re
        urls = [u.strip() for u in re.split(r'[\n,]+', urls) if u.strip()]

    enhance_mode = data.get("mode", "ai")
    enhance_scale = int(data.get("scale", 2))
    fps_boost = int(data.get("fps_boost", 1))

    job_id, error = start_tiktok_job(urls, enhance_mode=enhance_mode, enhance_scale=enhance_scale, fps_boost=fps_boost)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"job_id": job_id})


@app.route("/tiktok/status/<job_id>")
def tiktok_status(job_id):
    job = get_tiktok_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    return jsonify({
        "status": job["status"],
        "progress": job["progress"],
        "total": job["total"],
        "current_index": job.get("current_index", 0),
        "status_message": job.get("status_message", ""),
        "results": job.get("results", []),
        "error": job.get("error"),
    })


@app.route("/tiktok/download/<job_id>/<int:index>")
def tiktok_download(job_id, index):
    job = get_tiktok_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    results = job.get("results", [])
    if index < 0 or index >= len(results):
        return jsonify({"error": "Invalid index"}), 404

    result = results[index]
    if result["status"] != "done" or not result.get("output_file"):
        return jsonify({"error": "File not ready"}), 404

    output_path = Path(result["output_file"])
    title = result.get("title", "tiktok")
    # Sanitize title for filename
    safe_title = "".join(c for c in title if c.isalnum() or c in " _-")[:50].strip()
    if not safe_title:
        safe_title = "tiktok_video"

    return send_file(
        str(output_path),
        as_attachment=True,
        download_name=f"enhanced_{safe_title}.mp4",
        mimetype="video/mp4"
    )


@app.route("/image/upload", methods=["POST"])
def image_upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No filename"}), 400

    ext = file.filename.lower().rsplit(".", 1)[-1] if "." in file.filename else ""
    if ext not in ("png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif"):
        return jsonify({"error": "Format non supporte. Utilisez PNG, JPEG ou WebP."}), 400

    import uuid
    file_id = str(uuid.uuid4())[:8]
    safe_name = f"{file_id}_{file.filename}"
    filepath = UPLOADS_DIR / safe_name
    file.save(str(filepath))

    scale = int(request.form.get("scale", 2))
    job_id = start_image_job(filepath, scale=scale)

    return jsonify({"job_id": job_id})


@app.route("/image/status/<job_id>")
def image_status(job_id):
    job = get_image_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    response = {
        "status": job["status"],
        "progress": job["progress"],
        "status_message": job.get("status_message", ""),
        "error": job.get("error"),
    }

    if job.get("input_info"):
        response["input_info"] = job["input_info"]
    if job.get("output_info"):
        response["output_info"] = job["output_info"]

    return jsonify(response)


@app.route("/image/download/<job_id>")
def image_download(job_id):
    job = get_image_job(job_id)
    if not job or job["status"] != "done":
        return jsonify({"error": "File not ready"}), 404

    output_path = Path(job["output_file"])
    return send_file(
        str(output_path),
        as_attachment=True,
        download_name=f"enhanced_{output_path.name}",
        mimetype="image/png"
    )


@app.route("/captions/upload", methods=["POST"])
def captions_upload():
    files = request.files.getlist("files")
    if not files or all(not f.filename for f in files):
        # Fallback: single file field
        if "file" in request.files:
            files = [request.files["file"]]
        else:
            return jsonify({"error": "No files provided"}), 400

    import uuid as _uuid
    language = request.form.get("language", "auto")
    template = request.form.get("template", "classic")

    saved_paths = []
    for file in files:
        if not file.filename or not file.filename.lower().endswith(".mp4"):
            continue
        file_id = str(_uuid.uuid4())[:8]
        safe_name = f"{file_id}_{file.filename}"
        filepath = UPLOADS_DIR / safe_name
        file.save(str(filepath))
        saved_paths.append(filepath)

    if not saved_paths:
        return jsonify({"error": "Aucun fichier MP4 valide"}), 400

    if len(saved_paths) == 1:
        job_id = start_captions_job(saved_paths[0], language=language, template=template)
        return jsonify({"job_id": job_id, "mode": "single"})
    else:
        batch_id = start_captions_batch(saved_paths, language=language, template=template)
        return jsonify({"job_id": batch_id, "mode": "batch"})


@app.route("/captions/status/<job_id>")
def captions_status(job_id):
    job = get_captions_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    return jsonify({
        "status": job["status"],
        "progress": job["progress"],
        "status_message": job.get("status_message", ""),
        "detected_language": job.get("detected_language"),
        "segments_count": job.get("segments_count", 0),
        "output_size_mb": job.get("output_size_mb", 0),
        "error": job.get("error"),
    })


@app.route("/captions/download/<job_id>")
def captions_download(job_id):
    job = get_captions_job(job_id)
    if not job or job["status"] != "done":
        return jsonify({"error": "File not ready"}), 404

    output_path = Path(job["output_file"])
    return send_file(
        str(output_path),
        as_attachment=True,
        download_name=f"captioned_{output_path.name}",
        mimetype="video/mp4"
    )


@app.route("/captions/batch/status/<batch_id>")
def captions_batch_status(batch_id):
    batch = get_captions_batch(batch_id)
    if not batch:
        return jsonify({"error": "Batch not found"}), 404

    return jsonify({
        "status": batch["status"],
        "progress": batch["progress"],
        "total": batch["total"],
        "current_index": batch.get("current_index", 0),
        "status_message": batch.get("status_message", ""),
        "results": batch.get("results", []),
        "error": batch.get("error"),
    })


@app.route("/captions/batch/download/<batch_id>/<int:index>")
def captions_batch_download(batch_id, index):
    batch = get_captions_batch(batch_id)
    if not batch:
        return jsonify({"error": "Batch not found"}), 404

    results = batch.get("results", [])
    if index < 0 or index >= len(results):
        return jsonify({"error": "Invalid index"}), 404

    result = results[index]
    if result["status"] != "done" or not result.get("output_file"):
        return jsonify({"error": "File not ready"}), 404

    output_path = Path(result["output_file"])
    filename = result.get("filename", "video")
    safe_name = Path(filename).stem
    return send_file(
        str(output_path),
        as_attachment=True,
        download_name=f"captioned_{safe_name}.mp4",
        mimetype="video/mp4"
    )


@app.route("/scraper/collections", methods=["POST"])
def scraper_collections():
    data = request.get_json()
    if not data or not data.get("url"):
        return jsonify({"error": "URL requise"}), 400

    try:
        collections = fetch_collections(data["url"])
        return jsonify({"collections": collections})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/scraper/start", methods=["POST"])
def scraper_start():
    data = request.get_json()
    if not data or not data.get("url"):
        return jsonify({"error": "URL requise"}), 400

    store_url = data["url"]
    collections = data.get("collections", [])  # list of handles

    job_id = start_scrape_job(store_url, collections=collections)
    return jsonify({"job_id": job_id})


@app.route("/scraper/status/<job_id>")
def scraper_status(job_id):
    job = get_scrape_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    return jsonify({
        "status": job["status"],
        "progress": job["progress"],
        "status_message": job.get("status_message", ""),
        "products_count": job.get("products_count", 0),
        "rows_count": job.get("rows_count", 0),
        "error": job.get("error"),
    })


@app.route("/scraper/download/<job_id>")
def scraper_download(job_id):
    job = get_scrape_job(job_id)
    if not job or job["status"] != "done":
        return jsonify({"error": "File not ready"}), 404

    output_path = Path(job["output_file"])
    # Use store domain for filename
    from urllib.parse import urlparse
    domain = urlparse(job["store_url"]).netloc.replace("www.", "")
    safe_domain = "".join(c for c in domain if c.isalnum() or c in ".-_")

    return send_file(
        str(output_path),
        as_attachment=True,
        download_name=f"products_{safe_domain}.csv",
        mimetype="text/csv"
    )


@app.route("/analyse/start", methods=["POST"])
def analyse_start():
    data = request.get_json()
    if not data or not data.get("url"):
        return jsonify({"error": "URL requise"}), 400

    job_id = start_analyse_job(data["url"])
    return jsonify({"job_id": job_id})


@app.route("/analyse/status/<job_id>")
def analyse_status(job_id):
    job = get_analyse_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    response = {
        "status": job["status"],
        "progress": job["progress"],
        "status_message": job.get("status_message", ""),
        "error": job.get("error"),
    }

    if job["status"] == "done":
        response["store_name"] = job["store_name"]
        response["total_products"] = job["total_products"]
        response["total_revenue_est"] = job["total_revenue_est"]
        response["products"] = job["products"]

    return jsonify(response)


@app.route("/tracker/stores", methods=["GET"])
def tracker_list_stores():
    stores = get_tracked_stores()
    return jsonify({"stores": stores})


@app.route("/tracker/add", methods=["POST"])
def tracker_add_store():
    data = request.get_json()
    if not data or not data.get("url"):
        return jsonify({"error": "URL requise"}), 400

    store_id = add_tracked_store(data["url"])
    return jsonify({"store_id": store_id})


@app.route("/tracker/remove/<store_id>", methods=["POST"])
def tracker_remove_store(store_id):
    remove_tracked_store(store_id)
    return jsonify({"ok": True})


@app.route("/tracker/scan/<store_id>", methods=["POST"])
def tracker_scan(store_id):
    job_id = start_scan_job(store_id)
    return jsonify({"job_id": job_id})


@app.route("/tracker/scan/status/<job_id>")
def tracker_scan_status(job_id):
    job = get_scan_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({
        "status": job["status"],
        "progress": job["progress"],
        "status_message": job.get("status_message", ""),
        "error": job.get("error"),
    })


@app.route("/tracker/data/<store_id>")
def tracker_data(store_id):
    days = request.args.get("days", 30, type=int)
    data = get_store_sales_data(store_id, days=days)
    if not data:
        return jsonify({"error": "Store not found"}), 404
    return jsonify(data)


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5050))
    start_background_scanner()
    app.run(debug=False, host="0.0.0.0", port=port)
