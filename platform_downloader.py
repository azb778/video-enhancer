"""Multi-platform video downloader using yt-dlp (YouTube, Instagram, Twitter, TikTok, etc.)"""
import threading
import uuid
from pathlib import Path

import yt_dlp

DOWNLOADS_DIR = Path(__file__).parent / "downloads"
DOWNLOADS_DIR.mkdir(exist_ok=True)

platform_jobs = {}

SUPPORTED_DOMAINS = [
    "youtube.com", "youtu.be",
    "instagram.com",
    "twitter.com", "x.com",
    "tiktok.com", "vm.tiktok.com",
    "facebook.com", "fb.watch",
    "reddit.com",
    "twitch.tv",
    "dailymotion.com",
    "vimeo.com",
]


def detect_platform(url):
    url = url.lower()
    if "youtu" in url:
        return "YouTube"
    if "instagram" in url:
        return "Instagram"
    if "twitter" in url or "x.com" in url:
        return "Twitter/X"
    if "tiktok" in url:
        return "TikTok"
    if "facebook" in url or "fb.watch" in url:
        return "Facebook"
    if "reddit" in url:
        return "Reddit"
    if "twitch" in url:
        return "Twitch"
    if "dailymotion" in url:
        return "Dailymotion"
    if "vimeo" in url:
        return "Vimeo"
    return "Web"


def start_platform_job(urls):
    if not urls:
        return None, "Aucune URL fournie"

    job_id = str(uuid.uuid4())[:8]
    platform_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "total": len(urls),
        "current_index": 0,
        "status_message": "Démarrage...",
        "results": [],
        "error": None,
    }

    thread = threading.Thread(target=_run_platform_job, args=(job_id, urls), daemon=True)
    thread.start()
    return job_id, None


def get_platform_job(job_id):
    return platform_jobs.get(job_id)


def _run_platform_job(job_id, urls):
    job = platform_jobs[job_id]
    job["status"] = "downloading"
    results = []

    for i, url in enumerate(urls):
        job["current_index"] = i
        job["status_message"] = f"Téléchargement {i+1}/{len(urls)}..."
        job["progress"] = int((i / len(urls)) * 90)

        result = _download_one(url, job_id, i)
        results.append(result)
        job["results"] = results

    job["progress"] = 100
    job["status"] = "done"
    job["status_message"] = f"{len(results)} vidéo(s) téléchargée(s)"
    job["results"] = results


def _download_one(url, job_id, index):
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    platform = detect_platform(url)
    file_id = str(uuid.uuid4())[:8]
    output_template = str(DOWNLOADS_DIR / f"{file_id}_%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": output_template,
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", f"video_{index+1}")

        # Find downloaded file
        downloaded = list(DOWNLOADS_DIR.glob(f"{file_id}_*.mp4"))
        if not downloaded:
            downloaded = list(DOWNLOADS_DIR.glob(f"{file_id}_*"))
        if not downloaded:
            return {"status": "error", "url": url, "platform": platform, "error": "Fichier introuvable après téléchargement"}

        output_file = str(downloaded[0])
        size_mb = round(Path(output_file).stat().st_size / 1024 / 1024, 1)

        return {
            "status": "done",
            "url": url,
            "platform": platform,
            "title": title,
            "output_file": output_file,
            "size_mb": size_mb,
        }
    except Exception as e:
        return {"status": "error", "url": url, "platform": platform, "error": str(e)}
