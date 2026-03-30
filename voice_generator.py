"""
Voice-over generator using Microsoft Edge TTS (edge-tts).
Free, no API key required. High quality neural voices.
"""

import asyncio
import uuid
import threading
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "output"

# Available voices grouped by language
VOICES = {
    "Français": [
        ("fr-FR-DeniseNeural", "Denise — Femme, naturelle"),
        ("fr-FR-HenriNeural", "Henri — Homme, posé"),
        ("fr-FR-EloiseNeural", "Éloïse — Femme, enfantine"),
    ],
    "English (US)": [
        ("en-US-AriaNeural", "Aria — Female, expressive"),
        ("en-US-JennyNeural", "Jenny — Female, friendly"),
        ("en-US-GuyNeural", "Guy — Male, professional"),
        ("en-US-EricNeural", "Eric — Male, calm"),
        ("en-US-MichelleNeural", "Michelle — Female, warm"),
    ],
    "English (UK)": [
        ("en-GB-SoniaNeural", "Sonia — Female, British"),
        ("en-GB-RyanNeural", "Ryan — Male, British"),
    ],
    "Español": [
        ("es-ES-ElviraNeural", "Elvira — Mujer"),
        ("es-ES-AlvaroNeural", "Álvaro — Hombre"),
        ("es-MX-DaliaNeural", "Dalia — Mujer, mexicano"),
    ],
    "Deutsch": [
        ("de-DE-KatjaNeural", "Katja — Frau"),
        ("de-DE-ConradNeural", "Conrad — Mann"),
    ],
    "Italiano": [
        ("it-IT-ElsaNeural", "Elsa — Donna"),
        ("it-IT-DiegoNeural", "Diego — Uomo"),
    ],
    "Português": [
        ("pt-BR-FranciscaNeural", "Francisca — Mulher (BR)"),
        ("pt-PT-FernandaNeural", "Fernanda — Mulher (PT)"),
    ],
    "日本語": [
        ("ja-JP-NanamiNeural", "Nanami — 女性"),
        ("ja-JP-KeitaNeural", "Keita — 男性"),
    ],
    "中文": [
        ("zh-CN-XiaoxiaoNeural", "晓晓 — 女，温暖"),
        ("zh-CN-YunxiNeural", "云希 — 男"),
    ],
    "العربية": [
        ("ar-SA-ZariyahNeural", "Zariyah — أنثى"),
        ("ar-EG-ShakirNeural", "Shakir — ذكر"),
    ],
}

vo_jobs = {}


async def _generate_async(text, voice, rate, pitch, output_path):
    """Async edge-tts generation."""
    rate_str = f"{rate:+d}%"
    pitch_str = f"{pitch:+d}Hz"
    communicate = __import__("edge_tts").Communicate(text, voice, rate=rate_str, pitch=pitch_str)
    await communicate.save(str(output_path))


def _run_vo_job(job_id):
    job = vo_jobs[job_id]
    output_path = OUTPUT_DIR / f"{job_id}_voiceover.mp3"

    try:
        job["status"] = "generating"
        job["progress"] = 20
        job["status_message"] = "Connexion au service TTS..."

        asyncio.run(_generate_async(
            job["text"],
            job["voice"],
            job["rate"],
            job["pitch"],
            output_path,
        ))

        job["output_file"] = str(output_path)
        job["progress"] = 100
        job["status"] = "done"
        job["status_message"] = "Terminé !"
        job["output_size_kb"] = round(output_path.stat().st_size / 1024, 1)

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
        job["progress"] = 0


def start_vo_job(text, voice="fr-FR-DeniseNeural", rate=0, pitch=0):
    """Start a voice-over generation job."""
    job_id = str(uuid.uuid4())[:8]
    vo_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "text": text,
        "voice": voice,
        "rate": rate,
        "pitch": pitch,
        "output_file": None,
        "output_size_kb": 0,
        "error": None,
        "status_message": "Démarrage...",
    }
    thread = threading.Thread(target=_run_vo_job, args=(job_id,), daemon=True)
    thread.start()
    return job_id


def get_vo_job(job_id):
    return vo_jobs.get(job_id)
