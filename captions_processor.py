"""
Auto-captioning module: transcribe audio with Whisper, generate styled ASS subtitles,
and burn them into the video. Supports word-by-word highlighting like CapCut.
Languages: French, English, German.
"""

import os
import subprocess
import tempfile
import threading
import uuid
from pathlib import Path

UPLOADS_DIR = Path(__file__).parent / "uploads"
OUTPUT_DIR = Path(__file__).parent / "output"
FONTS_DIR = Path(__file__).parent / "fonts"

captions_jobs = {}

# ============================================================
# Caption templates
# ============================================================

TEMPLATES = {
    "classic": {
        "name": "Classic",
        "font": "Poppins SemiBold",
        "font_file": "Poppins-SemiBold.ttf",
        "font_size": 42,
        "primary_color": "&H00FFFFFF",  # White (ASS BGR format)
        "highlight_color": "&H00FFFFFF",  # Same (no highlight diff)
        "outline_color": "&H00000000",  # Black
        "outline_width": 2,
        "shadow": 0,
        "bold": -1,
        "margin_v": 60,
    },
    "bold_pop": {
        "name": "Bold Pop",
        "font": "Poppins Bold",
        "font_file": "Poppins-Bold.ttf",
        "font_size": 52,
        "primary_color": "&H0000FFFF",  # Yellow
        "highlight_color": "&H0000FFFF",
        "outline_color": "&H00000000",  # Black
        "outline_width": 3,
        "shadow": 1,
        "bold": -1,
        "margin_v": 60,
    },
    "minimal": {
        "name": "Minimal",
        "font": "Poppins Regular",
        "font_file": "Poppins-Regular.ttf",
        "font_size": 36,
        "primary_color": "&HBBFFFFFF",  # White semi-transparent
        "highlight_color": "&HBBFFFFFF",
        "outline_color": "&H00000000",
        "outline_width": 0,
        "shadow": 0,
        "bold": 0,
        "margin_v": 50,
    },
    "neon": {
        "name": "Neon",
        "font": "Poppins Bold",
        "font_file": "Poppins-Bold.ttf",
        "font_size": 46,
        "primary_color": "&H00FFFF00",  # Cyan
        "highlight_color": "&H0000FF00",  # Green
        "outline_color": "&H00000000",
        "outline_width": 2,
        "shadow": 3,
        "bold": -1,
        "margin_v": 60,
    },
    "helvetica_highlight": {
        "name": "Helvetica Highlight",
        "font": "Helvetica Neue Medium",
        "font_file": "__system__",  # Use system TTC
        "font_system_path": "/System/Library/Fonts/HelveticaNeue.ttc",
        "font_index": 10,  # Medium (65)
        "font_size": 52,
        "primary_color": "&H00FFFFFF",  # White (non-active words)
        "highlight_color": "&H0000FFFF",  # Yellow (active word)
        "outline_color": "&H00000000",  # Black
        "outline_width": 4,
        "shadow": 0,
        "bold": -1,
        "margin_v": 60,
        "letter_spacing": -1,
        "word_highlight": True,  # Enable per-word highlighting
        "pop_animation": True,  # Enable pop effect on active word
    },
}


# ============================================================
# Audio extraction
# ============================================================

def extract_audio(video_path, output_path):
    """Extract audio from video as WAV 16kHz mono (optimal for Whisper)."""
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Audio extraction failed: {result.stderr}")


# ============================================================
# Transcription with faster-whisper
# ============================================================

def transcribe_audio(audio_path, language=None):
    """
    Transcribe audio using faster-whisper with word-level timestamps.
    Returns list of segments, each containing words with timing.
    """
    from faster_whisper import WhisperModel

    model = WhisperModel("base", device="cpu", compute_type="auto")

    segments_gen, info = model.transcribe(
        str(audio_path),
        language=language if language != "auto" else None,
        word_timestamps=True,
        vad_filter=True,
    )

    segments = []
    for segment in segments_gen:
        words = []
        if segment.words:
            for w in segment.words:
                words.append({
                    "word": w.word.strip(),
                    "start": w.start,
                    "end": w.end,
                })

        segments.append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text.strip(),
            "words": words,
        })

    detected_language = info.language
    return segments, detected_language


# ============================================================
# ASS subtitle generation
# ============================================================

def _hex_to_ass(hex_color):
    """Convert #RRGGBB hex to ASS &H00BBGGRR format."""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return "&H00FFFFFF"
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H00{b:02X}{g:02X}{r:02X}"


def _hex_to_rgb(hex_color):
    """Convert #RRGGBB hex to (R, G, B) tuple."""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return (255, 255, 255)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _seconds_to_ass(seconds):
    """Convert seconds to ASS time format: H:MM:SS.CC"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _group_words(words, max_words=4):
    """Group words into chunks of max_words for display (like CapCut)."""
    groups = []
    current_group = []

    for word in words:
        current_group.append(word)
        if len(current_group) >= max_words:
            groups.append(current_group)
            current_group = []

    if current_group:
        groups.append(current_group)

    return groups


def generate_ass(segments, template_name="classic"):
    """
    Generate an ASS subtitle file with styled captions.
    Groups words (3-5 per line) and shows them with timing.
    """
    tpl = TEMPLATES.get(template_name, TEMPLATES["classic"])

    header = f"""[Script Info]
Title: Auto-Generated Captions
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{tpl['font']},{tpl['font_size']},{tpl['primary_color']},&H000000FF,{tpl['outline_color']},&H80000000,{tpl['bold']},0,0,0,100,100,0,0,1,{tpl['outline_width']},{tpl['shadow']},2,40,40,{tpl['margin_v']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events = []

    for segment in segments:
        words = segment.get("words", [])
        if not words:
            # Fallback: show full segment text
            start = _seconds_to_ass(segment["start"])
            end = _seconds_to_ass(segment["end"])
            text = segment["text"]
            events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")
            continue

        # Group words into chunks for display
        groups = _group_words(words, max_words=4)

        for group in groups:
            group_start = _seconds_to_ass(group[0]["start"])
            group_end = _seconds_to_ass(group[-1]["end"])
            group_text = " ".join(w["word"] for w in group)

            events.append(f"Dialogue: 0,{group_start},{group_end},Default,,0,0,0,,{group_text}")

    return header + "\n".join(events) + "\n"


# ============================================================
# Burn subtitles into video (Pillow-based, no libass needed)
# ============================================================

def _get_active_caption(word_groups, current_time):
    """Find which word group should be displayed at the given time."""
    for group in word_groups:
        if group["start"] <= current_time <= group["end"]:
            return group["text"]
    return None


def _build_word_groups(segments, max_words=4):
    """Build flat list of word groups with timing from all segments.
    Each group also keeps individual word timings for highlight templates."""
    groups = []
    for segment in segments:
        words = segment.get("words", [])
        if not words:
            groups.append({
                "text": segment["text"],
                "start": segment["start"],
                "end": segment["end"],
                "words": [],
            })
            continue

        chunk = []
        for w in words:
            chunk.append(w)
            if len(chunk) >= max_words:
                groups.append({
                    "text": " ".join(x["word"] for x in chunk),
                    "start": chunk[0]["start"],
                    "end": chunk[-1]["end"],
                    "words": list(chunk),
                })
                chunk = []
        if chunk:
            groups.append({
                "text": " ".join(x["word"] for x in chunk),
                "start": chunk[0]["start"],
                "end": chunk[-1]["end"],
                "words": list(chunk),
            })
    return groups


def _get_active_group(word_groups, current_time):
    """Find which word group should be displayed at the given time (returns full group)."""
    for group in word_groups:
        if group["start"] <= current_time <= group["end"]:
            return group
    return None


def _draw_text_with_spacing(draw, pos, text, font, fill, stroke_width=0, stroke_fill=None, letter_spacing=0):
    """Draw text with custom letter spacing."""
    if letter_spacing == 0:
        draw.text(pos, text, font=font, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill)
        return
    x, y = pos
    for char in text:
        draw.text((x, y), char, font=font, fill=fill, stroke_width=stroke_width, stroke_fill=stroke_fill)
        bbox = draw.textbbox((0, 0), char, font=font)
        x += (bbox[2] - bbox[0]) + letter_spacing


def _text_width_with_spacing(draw, text, font, letter_spacing=0):
    """Calculate text width accounting for letter spacing."""
    if letter_spacing == 0:
        bbox = draw.textbbox((0, 0), text, font=font)
        return bbox[2] - bbox[0]
    total = 0
    for i, char in enumerate(text):
        bbox = draw.textbbox((0, 0), char, font=font)
        total += (bbox[2] - bbox[0])
        if i < len(text) - 1:
            total += letter_spacing
    return total


def burn_captions_pillow(video_path, segments, template_name, output_path, progress_callback=None, style_override=None):
    """
    Burn captions into video using Pillow for text rendering.
    Supports word-by-word highlighting with pop animation for compatible templates.
    style_override: dict with optional keys: text_color (#hex), outline_color (#hex),
                    font_size (int), text_y_ratio (float 0-1)
    """
    import cv2
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont

    tpl = dict(TEMPLATES.get(template_name, TEMPLATES["classic"]))  # mutable copy
    style_override = style_override or {}

    # Apply style overrides
    if "text_color" in style_override:
        tpl["primary_color"] = _hex_to_ass(style_override["text_color"])
        tpl["highlight_color"] = _hex_to_ass(style_override["text_color"])
    if "outline_color" in style_override:
        tpl["outline_color"] = _hex_to_ass(style_override["outline_color"])
    if "font_size" in style_override:
        tpl["font_size"] = int(style_override["font_size"])

    # Animation overrides
    animation = style_override.get("animation", "none")
    if animation in ("word_highlight", "word_highlight_pop"):
        tpl["word_highlight"] = True
        if "highlight_color" in style_override:
            tpl["highlight_color"] = _hex_to_ass(style_override["highlight_color"])
    if animation in ("pop", "word_highlight_pop"):
        tpl["pop_animation"] = True

    word_highlight = tpl.get("word_highlight", False)
    pop_animation = tpl.get("pop_animation", False)
    letter_spacing = tpl.get("letter_spacing", 0)

    # Load font
    if tpl.get("font_file") == "__system__":
        font_path = tpl["font_system_path"]
        font_index = tpl.get("font_index", 0)
    else:
        font_path = str(FONTS_DIR / tpl["font_file"])
        if not Path(font_path).exists():
            font_path = str(FONTS_DIR / "Poppins-SemiBold.ttf")
        font_index = 0

    # Build word groups with configurable grouping
    max_words = int(style_override.get("max_words", 2))
    word_groups = _build_word_groups(segments, max_words=max_words)

    # Open video
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Scale font size relative to video height (base: 1080p)
    scale_factor = height / 1080.0
    font_size = int(tpl["font_size"] * scale_factor * 0.66)
    outline_w = max(1, int(tpl["outline_width"] * scale_factor * 0.7))
    scaled_spacing = int(letter_spacing * scale_factor)
    text_y_ratio = float(style_override.get("text_y_ratio", 0.60))

    # Pop animation: font scaled up by 12%
    pop_font_size = int(font_size * 1.12) if pop_animation else font_size
    pop_duration = 0.08  # seconds for the pop to settle back

    try:
        pil_font = ImageFont.truetype(font_path, font_size, index=font_index)
        pil_font_pop = ImageFont.truetype(font_path, pop_font_size, index=font_index) if pop_animation else pil_font
    except Exception:
        pil_font = ImageFont.load_default()
        pil_font_pop = pil_font

    # Parse ASS-style colors to RGB
    def ass_color_to_rgb(ass_color):
        hex_str = ass_color.replace("&H", "").replace("&", "")
        if len(hex_str) == 8:
            a, b, g, r = int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16), int(hex_str[6:8], 16)
            return (r, g, b, 255 - a)
        elif len(hex_str) == 6:
            b, g, r = int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16)
            return (r, g, b, 255)
        return (255, 255, 255, 255)

    text_color = ass_color_to_rgb(tpl["primary_color"])
    highlight_color = ass_color_to_rgb(tpl["highlight_color"])
    outline_color = ass_color_to_rgb(tpl["outline_color"])

    # FFmpeg writer
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo", "-vcodec", "rawvideo",
        "-s", f"{width}x{height}", "-pix_fmt", "bgr24",
        "-r", str(fps), "-i", "-",
        "-i", str(video_path),
        "-map", "0:v:0", "-map", "1:a:0?",
        "-c:v", "libx265", "-crf", "18", "-preset", "slow",
        "-x265-params", "log-level=error", "-tag:v", "hvc1",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-shortest",
        str(output_path),
    ]
    ffmpeg_proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        current_time = frame_idx / fps
        active_group = _get_active_group(word_groups, current_time)

        if active_group:
            pil_img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            draw = ImageDraw.Draw(pil_img)
            max_text_w = int(width * 0.90)

            if word_highlight and active_group.get("words"):
                # ---- Word-by-word highlight rendering ----
                words = active_group["words"]
                space_w = _text_width_with_spacing(draw, " ", pil_font, scaled_spacing)

                # Find which word is currently active
                active_word_idx = -1
                for wi, w in enumerate(words):
                    if w["start"] <= current_time <= w["end"]:
                        active_word_idx = wi
                        break
                # If between words in the group, highlight the last spoken
                if active_word_idx == -1:
                    for wi, w in enumerate(words):
                        if current_time >= w["start"]:
                            active_word_idx = wi

                # Measure each word and total width
                word_widths = []
                for wi, w in enumerate(words):
                    is_active = (wi == active_word_idx)
                    use_font = pil_font
                    if is_active and pop_animation:
                        elapsed = current_time - w["start"]
                        if elapsed < pop_duration:
                            # Interpolate between pop size and normal
                            t = elapsed / pop_duration
                            interp_size = int(pop_font_size + (font_size - pop_font_size) * t)
                            try:
                                use_font = ImageFont.truetype(font_path, interp_size, index=font_index)
                            except Exception:
                                use_font = pil_font_pop
                        # After pop_duration, use normal font
                    ww = _text_width_with_spacing(draw, w["word"].upper(), use_font, scaled_spacing)
                    word_widths.append(ww)

                total_w = sum(word_widths) + space_w * (len(words) - 1)

                # Compute baseline text height using normal font
                bbox_h = draw.textbbox((0, 0), "Ag", font=pil_font)
                text_h = bbox_h[3] - bbox_h[1]

                x_start = (width - total_w) // 2
                y_base = int(height * text_y_ratio) - text_h // 2
                cursor_x = x_start

                for wi, w in enumerate(words):
                    is_active = (wi == active_word_idx)
                    word_text = w["word"].upper()
                    use_font = pil_font
                    y_offset = 0

                    if is_active and pop_animation:
                        elapsed = current_time - w["start"]
                        if elapsed < pop_duration:
                            t = elapsed / pop_duration
                            interp_size = int(pop_font_size + (font_size - pop_font_size) * t)
                            try:
                                use_font = ImageFont.truetype(font_path, interp_size, index=font_index)
                            except Exception:
                                use_font = pil_font_pop
                            # Center the popped word vertically relative to baseline
                            pop_bbox = draw.textbbox((0, 0), "Ag", font=use_font)
                            pop_h = pop_bbox[3] - pop_bbox[1]
                            y_offset = -(pop_h - text_h) // 2

                    color = highlight_color[:3] if is_active else text_color[:3]

                    _draw_text_with_spacing(
                        draw, (cursor_x, y_base + y_offset), word_text, use_font,
                        fill=color, stroke_width=outline_w, stroke_fill=outline_color[:3],
                        letter_spacing=scaled_spacing,
                    )

                    cursor_x += word_widths[wi] + space_w

            else:
                # ---- Standard single-color rendering ----
                caption_text = active_group["text"]
                if style_override.get("uppercase", False):
                    caption_text = caption_text.upper()
                current_font = pil_font
                tw = _text_width_with_spacing(draw, caption_text, current_font, scaled_spacing)

                if tw > max_text_w:
                    shrink_ratio = max_text_w / tw
                    shrunk_size = max(12, int(font_size * shrink_ratio))
                    try:
                        current_font = ImageFont.truetype(font_path, shrunk_size, index=font_index)
                    except Exception:
                        pass
                    tw = _text_width_with_spacing(draw, caption_text, current_font, scaled_spacing)

                bbox = draw.textbbox((0, 0), caption_text, font=current_font)
                text_h = bbox[3] - bbox[1]
                x = (width - tw) // 2
                y = int(height * text_y_ratio) - text_h // 2

                # Background box
                bg_opacity_val = style_override.get("bg_opacity", 0)
                if bg_opacity_val > 0:
                    bg_rgb = _hex_to_rgb(style_override.get("bg_color", "#000000"))
                    bg_alpha = int(bg_opacity_val * 2.55)
                    pad = max(4, int(10 * scale_factor))
                    bg_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                    bg_draw_l = ImageDraw.Draw(bg_layer)
                    bg_draw_l.rectangle(
                        [x - pad, y - pad, x + tw + pad, y + text_h + pad],
                        fill=(*bg_rgb, bg_alpha),
                    )
                    pil_img = Image.alpha_composite(pil_img.convert("RGBA"), bg_layer).convert("RGB")
                    draw = ImageDraw.Draw(pil_img)

                # Fade animation
                fade_alpha = 1.0
                if animation == "fade":
                    seg_dur = max(0.01, active_group["end"] - active_group["start"])
                    fd = min(0.18, seg_dur * 0.25)
                    elapsed = current_time - active_group["start"]
                    remaining = active_group["end"] - current_time
                    if elapsed < fd:
                        fade_alpha = max(0.05, elapsed / fd)
                    elif remaining < fd:
                        fade_alpha = max(0.05, remaining / fd)

                if animation == "fade" and fade_alpha < 0.98:
                    ia = int(255 * fade_alpha)
                    fade_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                    fdraw = ImageDraw.Draw(fade_layer)
                    for dx in [-outline_w, outline_w]:
                        for dy in [-outline_w, outline_w]:
                            fdraw.text((x + dx, y + dy), caption_text, font=current_font,
                                       fill=(*outline_color[:3], ia))
                    fdraw.text((x, y), caption_text, font=current_font,
                               fill=(*text_color[:3], ia))
                    pil_img = Image.alpha_composite(pil_img.convert("RGBA"), fade_layer).convert("RGB")
                    draw = ImageDraw.Draw(pil_img)
                else:
                    _draw_text_with_spacing(
                        draw, (x, y), caption_text, current_font,
                        fill=text_color[:3], stroke_width=outline_w, stroke_fill=outline_color[:3],
                        letter_spacing=scaled_spacing,
                    )

            frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        ffmpeg_proc.stdin.write(frame.tobytes())
        frame_idx += 1
        if frame_idx % 30 == 0 and progress_callback and total_frames > 0:
            pct = min(99, int((frame_idx / total_frames) * 100))
            progress_callback(pct)

    cap.release()
    ffmpeg_proc.stdin.close()
    ffmpeg_proc.wait()

    if ffmpeg_proc.returncode != 0:
        stderr = ffmpeg_proc.stderr.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"FFmpeg encoding error: {stderr}")


# ============================================================
# Job orchestrator
# ============================================================

def process_captions(job_id):
    """Full captioning pipeline."""
    job = captions_jobs[job_id]
    input_path = Path(job["input_file"])
    output_path = OUTPUT_DIR / f"{job_id}_captioned.mp4"
    language = job.get("language", "auto")
    template = job.get("template", "classic")

    try:
        # Step 1: Extract audio
        job["status"] = "extracting"
        job["progress"] = 5
        job["status_message"] = "Extraction de l'audio..."

        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = Path(tmpdir) / "audio.wav"
            extract_audio(input_path, audio_path)

            # Step 2: Transcribe
            job["status"] = "transcribing"
            job["progress"] = 15
            job["status_message"] = "Transcription IA en cours (Whisper)..."

            segments, detected_lang = transcribe_audio(audio_path, language)
            job["detected_language"] = detected_lang
            job["segments_count"] = len(segments)
            job["segments"] = segments  # save for editor

            total_words = sum(len(s.get("words", [])) for s in segments)
            job["status_message"] = f"Transcription terminee : {total_words} mots detectes ({detected_lang})"
            job["progress"] = 50

            # Step 3: Generate captions
            job["status"] = "generating"
            job["progress"] = 55
            job["status_message"] = "Generation des sous-titres..."

            # Step 4: Burn into video using Pillow rendering
            job["status"] = "burning"
            job["progress"] = 60
            job["status_message"] = "Incrustation des sous-titres dans la video..."

            def burn_progress(pct):
                job["progress"] = 60 + int(pct * 39 / 100)

            burn_captions_pillow(input_path, segments, template, output_path, burn_progress)

        # Done
        job["output_file"] = str(output_path)
        job["progress"] = 100
        job["status"] = "done"
        job["status_message"] = "Termine !"

        # Get output file size
        out_size = output_path.stat().st_size
        job["output_size_mb"] = round(out_size / (1024 * 1024), 2)

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


def start_captions_job(input_filepath, language="auto", template="classic"):
    """Create a new captioning job."""
    job_id = str(uuid.uuid4())[:8]
    captions_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "language": language,
        "template": template,
        "input_file": str(input_filepath),
        "output_file": None,
        "detected_language": None,
        "segments_count": 0,
        "output_size_mb": 0,
        "error": None,
        "status_message": "Demarrage...",
    }
    thread = threading.Thread(target=process_captions, args=(job_id,), daemon=True)
    thread.start()
    return job_id


def get_captions_job(job_id):
    """Get captioning job status."""
    return captions_jobs.get(job_id)


# ============================================================
# Batch captioning
# ============================================================

captions_batch_jobs = {}


def process_captions_batch(batch_id):
    """Process multiple videos sequentially."""
    batch = captions_batch_jobs[batch_id]
    files = batch["files"]
    language = batch["language"]
    template = batch["template"]
    total = len(files)
    results = []

    for i, filepath in enumerate(files):
        batch["current_index"] = i
        batch["status_message"] = f"Video {i + 1}/{total} en cours..."
        batch["progress"] = int((i / total) * 100)

        filename = Path(filepath).name
        output_path = OUTPUT_DIR / f"{batch_id}_{i}_captioned.mp4"

        result = {
            "filename": filename,
            "status": "processing",
            "output_file": None,
            "error": None,
            "output_size_mb": 0,
            "detected_language": None,
        }
        results.append(result)
        batch["results"] = results

        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                # Extract audio
                batch["status_message"] = f"[{i + 1}/{total}] Extraction audio : {filename}"
                audio_path = Path(tmpdir) / "audio.wav"
                extract_audio(filepath, audio_path)

                # Transcribe
                batch["status_message"] = f"[{i + 1}/{total}] Transcription IA : {filename}"
                batch["progress"] = int(((i + 0.3) / total) * 100)
                segments, detected_lang = transcribe_audio(audio_path, language)
                result["detected_language"] = detected_lang

                # Burn captions
                batch["status_message"] = f"[{i + 1}/{total}] Incrustation : {filename}"

                def burn_progress(pct):
                    batch["progress"] = int(((i + 0.5 + pct / 200) / total) * 100)

                burn_captions_pillow(filepath, segments, template, output_path, burn_progress)

            result["status"] = "done"
            result["output_file"] = str(output_path)
            result["output_size_mb"] = round(output_path.stat().st_size / (1024 * 1024), 2)

        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)

    batch["results"] = results
    batch["progress"] = 100
    batch["status"] = "done"
    batch["status_message"] = "Termine !"


def start_captions_batch(filepaths, language="auto", template="classic"):
    """Start a batch captioning job."""
    batch_id = str(uuid.uuid4())[:8]
    captions_batch_jobs[batch_id] = {
        "status": "processing",
        "progress": 0,
        "files": [str(f) for f in filepaths],
        "total": len(filepaths),
        "current_index": 0,
        "language": language,
        "template": template,
        "results": [],
        "status_message": "Demarrage...",
        "error": None,
    }
    thread = threading.Thread(target=process_captions_batch, args=(batch_id,), daemon=True)
    thread.start()
    return batch_id


def get_captions_batch(batch_id):
    """Get batch captioning job status."""
    return captions_batch_jobs.get(batch_id)


# ============================================================
# Reburn with edited segments
# ============================================================

def _run_reburn(job_id, segments, style_override):
    job = captions_jobs[job_id]
    input_path = Path(job["input_file"])
    output_path = OUTPUT_DIR / f"{job_id}_captioned.mp4"
    template = job.get("template", "classic")

    try:
        job["status"] = "burning"
        job["progress"] = 5
        job["status_message"] = "Incrustation des sous-titres édités..."

        def burn_progress(pct):
            job["progress"] = 5 + int(pct * 94 / 100)

        burn_captions_pillow(input_path, segments, template, output_path, burn_progress, style_override=style_override)

        job["output_file"] = str(output_path)
        job["progress"] = 100
        job["status"] = "done"
        job["status_message"] = "Terminé !"
        job["output_size_mb"] = round(output_path.stat().st_size / (1024 * 1024), 2)

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


def start_reburn_job(original_job_id, edited_segments, style=None):
    """Start a new burn job with user-edited segments and optional style overrides."""
    orig = captions_jobs.get(original_job_id)
    if not orig:
        raise ValueError("Original job not found")

    job_id = str(uuid.uuid4())[:8]
    captions_jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "language": orig.get("language", "auto"),
        "template": orig.get("template", "classic"),
        "input_file": orig["input_file"],
        "output_file": None,
        "detected_language": orig.get("detected_language"),
        "segments_count": len(edited_segments),
        "segments": edited_segments,
        "output_size_mb": 0,
        "error": None,
        "status_message": "Démarrage...",
    }
    style_override = style or {}
    # If template override specified, store it
    if "template" in style_override:
        captions_jobs[job_id]["template"] = style_override["template"]
    thread = threading.Thread(target=_run_reburn, args=(job_id, edited_segments, style_override), daemon=True)
    thread.start()
    return job_id
