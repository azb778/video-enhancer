import subprocess
import json
import os
import re
import threading
import uuid
from pathlib import Path

UPLOADS_DIR = Path(__file__).parent / "uploads"
OUTPUT_DIR = Path(__file__).parent / "output"

# Store job statuses: {job_id: {status, progress, input_file, output_file, info, error}}
jobs = {}


def get_video_info(filepath):
    """Get video metadata using ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        str(filepath)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")
    data = json.loads(result.stdout)

    video_stream = None
    audio_stream = None
    for s in data.get("streams", []):
        if s["codec_type"] == "video" and video_stream is None:
            video_stream = s
        elif s["codec_type"] == "audio" and audio_stream is None:
            audio_stream = s

    fmt = data.get("format", {})
    duration = float(fmt.get("duration", 0))
    size_bytes = int(fmt.get("size", 0))

    info = {
        "duration": duration,
        "duration_str": f"{int(duration // 60)}m {int(duration % 60)}s",
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / (1024 * 1024), 2),
        "codec": video_stream.get("codec_name", "unknown") if video_stream else "unknown",
        "width": int(video_stream.get("width", 0)) if video_stream else 0,
        "height": int(video_stream.get("height", 0)) if video_stream else 0,
        "fps": _parse_fps(video_stream.get("r_frame_rate", "0/1")) if video_stream else 0,
        "bitrate": int(fmt.get("bit_rate", 0)),
        "audio_codec": audio_stream.get("codec_name", "none") if audio_stream else "none",
    }
    info["resolution"] = f"{info['width']}x{info['height']}"
    return info


def _parse_fps(rate_str):
    """Parse fractional frame rate like '30000/1001'."""
    try:
        if "/" in rate_str:
            num, den = rate_str.split("/")
            return round(int(num) / int(den), 2)
        return round(float(rate_str), 2)
    except (ValueError, ZeroDivisionError):
        return 0


def build_ffmpeg_command(input_path, output_path, video_info, fps_boost=1):
    """Build the FFmpeg command with enhancement and compression filters."""
    filters = []

    # 1. Denoising - hqdn3d (high quality 3D denoiser)
    filters.append("hqdn3d=4:3:6:4.5")

    # 2. Sharpening - unsharp mask
    filters.append("unsharp=5:5:0.8:5:5:0.0")

    # 3. Color correction - slight contrast/saturation boost
    filters.append("eq=contrast=1.05:brightness=0.02:saturation=1.1")

    # 4. Upscale to 1080p if resolution is lower
    height = video_info.get("height", 0)
    width = video_info.get("width", 0)
    if height < 1080 and height > 0:
        # Scale to 1080p keeping aspect ratio, ensure even dimensions
        filters.append("scale=-2:1080:flags=lanczos")

    # 5. FPS boost via motion-compensated interpolation
    if fps_boost > 1:
        current_fps = video_info.get("fps", 30)
        target_fps = min(current_fps * fps_boost, 120)  # Cap at 120fps
        filters.append(
            f"minterpolate=fps={target_fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
        )

    vf = ",".join(filters)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-vf", vf,
        "-c:v", "libx265",
        "-crf", "18",
        "-preset", "slow",
        "-x265-params", "log-level=error",
        "-tag:v", "hvc1",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-progress", "pipe:1",
        str(output_path)
    ]
    return cmd


def _parse_progress(line, total_duration):
    """Parse FFmpeg progress output and return percentage."""
    match = re.search(r"out_time_us=(\d+)", line)
    if match and total_duration > 0:
        current_us = int(match.group(1))
        current_s = current_us / 1_000_000
        pct = min(99, int((current_s / total_duration) * 100))
        return pct
    return None


def _run_fps_boost(input_path, output_path, video_info, fps_boost, job):
    """Apply FPS interpolation as a separate pass."""
    current_fps = video_info.get("fps", 30)
    target_fps = min(current_fps * fps_boost, 120)

    job["status_message"] = f"Interpolation FPS : {current_fps} -> {target_fps} fps..."

    vf = f"minterpolate=fps={target_fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"

    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-vf", vf,
        "-c:v", "libx265",
        "-crf", "18",
        "-preset", "slow",
        "-x265-params", "log-level=error",
        "-tag:v", "hvc1",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-progress", "pipe:1",
        str(output_path)
    ]

    duration = video_info.get("duration", 0)
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    for line in process.stdout:
        pct = _parse_progress(line, duration)
        if pct is not None:
            # Map to 90-99% range (last step)
            job["progress"] = 90 + int(pct * 9 / 100)

    process.wait()
    if process.returncode != 0:
        stderr = process.stderr.read()
        raise RuntimeError(f"FFmpeg FPS boost error: {stderr}")


def process_video(job_id):
    """Run the full enhancement + compression pipeline."""
    job = jobs[job_id]
    mode = job.get("mode", "ffmpeg")
    fps_boost = job.get("fps_boost", 1)
    input_path = Path(job["input_file"])
    output_path = OUTPUT_DIR / f"{job_id}_enhanced.mp4"

    try:
        job["status"] = "analyzing"
        job["progress"] = 0

        # Get input video info
        info = get_video_info(input_path)
        job["input_info"] = info

        if mode == "ai":
            _process_ai(job, input_path, output_path, info)
        else:
            _process_ffmpeg(job, input_path, output_path, info)

        # FPS boost as a separate pass (after quality enhancement)
        if fps_boost > 1:
            job["status"] = "fps_boost"
            job["status_message"] = "Interpolation FPS en cours..."
            # Use the enhanced video as input, write to a temp file, then swap
            fps_input = output_path
            fps_output = OUTPUT_DIR / f"{job_id}_fps.mp4"
            enhanced_info = get_video_info(fps_input)
            _run_fps_boost(fps_input, fps_output, enhanced_info, fps_boost, job)
            # Replace the output
            output_path.unlink()
            fps_output.rename(output_path)

        # Get output info
        output_info = get_video_info(output_path)
        job["output_info"] = output_info
        job["output_file"] = str(output_path)
        job["progress"] = 100
        job["status"] = "done"

        # Compute compression ratio
        if info["size_bytes"] > 0:
            ratio = (1 - output_info["size_bytes"] / info["size_bytes"]) * 100
            job["compression_ratio"] = round(ratio, 1)
        else:
            job["compression_ratio"] = 0

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


def _process_ffmpeg(job, input_path, output_path, info):
    """FFmpeg-only processing (fast mode)."""
    job["status"] = "processing"

    cmd = build_ffmpeg_command(input_path, output_path, info)
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    for line in process.stdout:
        pct = _parse_progress(line, info["duration"])
        if pct is not None:
            job["progress"] = pct

    process.wait()

    if process.returncode != 0:
        stderr = process.stderr.read()
        raise RuntimeError(f"FFmpeg error: {stderr}")


def _process_ai(job, input_path, output_path, info):
    """Real-ESRGAN AI processing (high quality mode)."""
    from ai_enhancer import enhance_video

    job["status"] = "ai_processing"

    target_scale = job.get("scale", 2)

    def progress_cb(pct, msg):
        job["progress"] = pct
        job["status_message"] = msg

    enhance_video(
        input_path=input_path,
        output_path=output_path,
        model_name="realesr-general-x4v3",
        target_scale=target_scale,
        progress_callback=progress_cb,
    )


def start_job(input_filepath, mode="ffmpeg", scale=2, fps_boost=1):
    """Create a new processing job and start it in background.

    Args:
        input_filepath: Path to the uploaded video
        mode: "ffmpeg" for fast filters, "ai" for Real-ESRGAN
        scale: Upscale factor for AI mode (1, 2, or 4)
        fps_boost: FPS multiplier (1=off, 2=double, 4=quadruple)
    """
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "mode": mode,
        "scale": scale,
        "fps_boost": fps_boost,
        "input_file": str(input_filepath),
        "output_file": None,
        "input_info": None,
        "output_info": None,
        "error": None,
        "compression_ratio": 0,
        "status_message": "",
    }
    thread = threading.Thread(target=process_video, args=(job_id,), daemon=True)
    thread.start()
    return job_id


def get_job(job_id):
    """Get job status."""
    return jobs.get(job_id)
