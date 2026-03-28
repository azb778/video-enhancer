import re
import threading
import uuid
from pathlib import Path

import yt_dlp

DOWNLOADS_DIR = Path(__file__).parent / "downloads"
DOWNLOADS_DIR.mkdir(exist_ok=True)

# Store TikTok job statuses
tiktok_jobs = {}


def _sanitize_url(url):
    """Clean up a TikTok URL."""
    url = url.strip()
    if not url:
        return None
    # Accept tiktok.com and vm.tiktok.com (short links)
    if "tiktok.com" not in url and "tiktok" not in url:
        return None
    if not url.startswith("http"):
        url = "https://" + url
    return url


def download_tiktok(url, job_id, video_index=0, total_videos=1):
    """Download a single TikTok video without watermark at best quality."""
    job = tiktok_jobs[job_id]

    file_id = str(uuid.uuid4())[:8]
    output_template = str(DOWNLOADS_DIR / f"{file_id}_%(id)s.%(ext)s")

    ydl_opts = {
        "format": "best",
        "outtmpl": output_template,
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "extractor_args": {"tiktok": {"api_hostname": ["api22-normal-c-useast2a.tiktokv.com"]}},
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filepath = ydl.prepare_filename(info)

            # yt-dlp might change extension
            filepath = Path(filepath)
            if not filepath.exists():
                # Try .mp4 explicitly
                filepath = filepath.with_suffix(".mp4")

            if not filepath.exists():
                # Search for the downloaded file
                for f in DOWNLOADS_DIR.glob(f"{file_id}_*"):
                    filepath = f
                    break

            if not filepath.exists():
                raise FileNotFoundError(f"Downloaded file not found for {url}")

            title = info.get("title", "tiktok_video")
            duration = info.get("duration", 0)
            width = info.get("width", 0)
            height = info.get("height", 0)

            return {
                "filepath": str(filepath),
                "title": title,
                "duration": duration,
                "width": width,
                "height": height,
                "url": url,
            }

    except Exception as e:
        raise RuntimeError(f"Download failed for {url}: {str(e)}")


def process_tiktok_batch(job_id):
    """Process a batch of TikTok URLs: download + enhance."""
    from video_processor import start_job as start_enhance_job, get_job as get_enhance_job
    import time

    job = tiktok_jobs[job_id]
    urls = job["urls"]
    total = len(urls)
    job["status"] = "downloading"
    job["total"] = total

    results = []

    for i, url in enumerate(urls):
        job["current_index"] = i
        job["current_url"] = url
        job["status_message"] = f"Telechargement {i + 1}/{total}..."
        job["progress"] = int((i / total) * 40)  # 0-40% for downloads

        try:
            dl_result = download_tiktok(url, job_id, i, total)
            results.append({
                "url": url,
                "title": dl_result["title"],
                "filepath": dl_result["filepath"],
                "width": dl_result["width"],
                "height": dl_result["height"],
                "duration": dl_result["duration"],
                "status": "downloaded",
                "enhance_job_id": None,
                "output_file": None,
                "error": None,
            })
        except Exception as e:
            results.append({
                "url": url,
                "title": "",
                "filepath": None,
                "status": "error",
                "enhance_job_id": None,
                "output_file": None,
                "error": str(e),
            })

    job["results"] = results
    job["status"] = "enhancing"

    # Now enhance each successfully downloaded video
    enhance_mode = job.get("enhance_mode", "ai")
    enhance_scale = job.get("enhance_scale", 2)
    fps_boost = job.get("fps_boost", 1)
    success_results = [r for r in results if r["status"] == "downloaded"]
    total_enhance = len(success_results)

    for i, result in enumerate(success_results):
        job["status_message"] = f"Amelioration IA {i + 1}/{total_enhance} : {result['title'][:40]}..."
        job["progress"] = 40 + int((i / max(total_enhance, 1)) * 55)  # 40-95% for enhancement

        try:
            filepath = Path(result["filepath"])
            enhance_job_id = start_enhance_job(filepath, mode=enhance_mode, scale=enhance_scale, fps_boost=fps_boost)
            result["enhance_job_id"] = enhance_job_id

            # Wait for enhancement to complete
            while True:
                enhance_job = get_enhance_job(enhance_job_id)
                if not enhance_job:
                    break
                if enhance_job["status"] == "done":
                    result["output_file"] = enhance_job["output_file"]
                    result["output_info"] = enhance_job.get("output_info")
                    result["status"] = "done"
                    break
                elif enhance_job["status"] == "error":
                    result["status"] = "error"
                    result["error"] = enhance_job.get("error", "Enhancement failed")
                    break

                # Update sub-progress
                sub_pct = enhance_job.get("progress", 0)
                sub_msg = enhance_job.get("status_message", "")
                overall = 40 + int(((i + sub_pct / 100) / max(total_enhance, 1)) * 55)
                job["progress"] = min(95, overall)
                if sub_msg:
                    job["status_message"] = f"[{i + 1}/{total_enhance}] {sub_msg}"

                time.sleep(1)

        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)

    job["results"] = results
    job["progress"] = 100
    job["status"] = "done"
    job["status_message"] = "Termine !"


def start_tiktok_job(urls, enhance_mode="ai", enhance_scale=2, fps_boost=1):
    """Start a batch TikTok download + enhance job."""
    # Parse and validate URLs
    clean_urls = []
    for url in urls:
        cleaned = _sanitize_url(url)
        if cleaned:
            clean_urls.append(cleaned)

    if not clean_urls:
        return None, "Aucune URL TikTok valide trouvee"

    job_id = str(uuid.uuid4())[:8]
    tiktok_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "urls": clean_urls,
        "total": len(clean_urls),
        "current_index": 0,
        "current_url": "",
        "results": [],
        "enhance_mode": enhance_mode,
        "enhance_scale": enhance_scale,
        "fps_boost": fps_boost,
        "status_message": "Demarrage...",
        "error": None,
    }

    thread = threading.Thread(target=process_tiktok_batch, args=(job_id,), daemon=True)
    thread.start()
    return job_id, None


def get_tiktok_job(job_id):
    """Get TikTok job status."""
    return tiktok_jobs.get(job_id)
