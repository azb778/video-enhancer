"""
Real-ESRGAN video enhancer using the RealESRGAN_x4plus_anime_6B or realesr-general-x4v3 model.
Standalone implementation without basicsr dependency.
"""

import os
import math
import subprocess
import shutil
import tempfile
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from tqdm import tqdm


# ============================================================
# SRVGGNetCompact architecture (from Real-ESRGAN)
# Lightweight model for real-time super resolution
# ============================================================

class SRVGGNetCompact(nn.Module):
    """A compact VGG-style network for super-resolution (Real-ESRGAN v2 architecture)."""

    def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=16, upscale=4, act_type="prelu"):
        super().__init__()
        self.num_in_ch = num_in_ch
        self.num_out_ch = num_out_ch
        self.upscale = upscale

        self.body = nn.ModuleList()
        # First conv
        self.body.append(nn.Conv2d(num_in_ch, num_feat, 3, 1, 1))
        # Activation
        if act_type == "relu":
            act = nn.ReLU(inplace=True)
        elif act_type == "prelu":
            act = nn.PReLU(num_parameters=num_feat)
        elif act_type == "leakyrelu":
            act = nn.LeakyReLU(negative_slope=0.1, inplace=True)
        else:
            act = nn.PReLU(num_parameters=num_feat)
        self.body.append(act)

        # Body convolutions
        for _ in range(num_conv):
            self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
            if act_type == "relu":
                act = nn.ReLU(inplace=True)
            elif act_type == "prelu":
                act = nn.PReLU(num_parameters=num_feat)
            elif act_type == "leakyrelu":
                act = nn.LeakyReLU(negative_slope=0.1, inplace=True)
            else:
                act = nn.PReLU(num_parameters=num_feat)
            self.body.append(act)

        # Last conv
        self.body.append(nn.Conv2d(num_feat, num_out_ch * (upscale ** 2), 3, 1, 1))
        # Pixel shuffle
        self.upsampler = nn.PixelShuffle(upscale)

    def forward(self, x):
        out = x
        for layer in self.body:
            out = layer(out)
        out = self.upsampler(out)
        # Add upsampled input (skip connection)
        base = F.interpolate(x, scale_factor=self.upscale, mode="bilinear", align_corners=False)
        out += base
        return out


# ============================================================
# RRDBNet architecture (from Real-ESRGAN v1 / ESRGAN)
# Higher quality model for general purpose super resolution
# ============================================================

class ResidualDenseBlock(nn.Module):
    def __init__(self, num_feat=64, num_grow_ch=32):
        super().__init__()
        self.conv1 = nn.Conv2d(num_feat, num_grow_ch, 3, 1, 1)
        self.conv2 = nn.Conv2d(num_feat + num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv3 = nn.Conv2d(num_feat + 2 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv4 = nn.Conv2d(num_feat + 3 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv5 = nn.Conv2d(num_feat + 4 * num_grow_ch, num_feat, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, num_feat, num_grow_ch=32):
        super().__init__()
        self.rdb1 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb2 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb3 = ResidualDenseBlock(num_feat, num_grow_ch)

    def forward(self, x):
        out = self.rdb1(x)
        out = self.rdb2(out)
        out = self.rdb3(out)
        return out * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4):
        super().__init__()
        self.scale = scale
        num_upsample = int(math.log2(scale))

        self.conv_first = nn.Conv2d(num_in_ch, num_feat, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(num_feat, num_grow_ch) for _ in range(num_block)])
        self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)

        # Upsample
        self.conv_up = nn.ModuleList()
        for _ in range(num_upsample):
            self.conv_up.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))

        self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_last = nn.Conv2d(num_feat, num_out_ch, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(x)
        body_feat = self.conv_body(self.body(feat))
        feat = feat + body_feat

        for conv in self.conv_up:
            feat = self.lrelu(conv(F.interpolate(feat, scale_factor=2, mode="nearest")))

        out = self.conv_last(self.lrelu(self.conv_hr(feat)))
        return out


# ============================================================
# Model manager: download, load, and run inference
# ============================================================

MODELS_DIR = Path(__file__).parent / "models"

MODEL_URLS = {
    "realesr-general-x4v3": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth",
    "RealESRGAN_x4plus": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
}


def download_model(model_name):
    """Download a model if not already present."""
    MODELS_DIR.mkdir(exist_ok=True)
    model_path = MODELS_DIR / f"{model_name}.pth"
    if model_path.exists():
        return model_path

    url = MODEL_URLS.get(model_name)
    if not url:
        raise ValueError(f"Unknown model: {model_name}")

    print(f"Downloading {model_name} model...")
    import urllib.request
    urllib.request.urlretrieve(url, str(model_path))
    print(f"Model saved to {model_path}")
    return model_path


def load_model(model_name="realesr-general-x4v3", device=None):
    """Load a Real-ESRGAN model."""
    if device is None:
        if torch.backends.mps.is_available():
            device = torch.device("mps")
        elif torch.cuda.is_available():
            device = torch.device("cuda")
        else:
            device = torch.device("cpu")

    model_path = download_model(model_name)

    if model_name == "realesr-general-x4v3":
        model = SRVGGNetCompact(num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4, act_type="prelu")
    elif model_name == "RealESRGAN_x4plus":
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
    else:
        raise ValueError(f"Unknown model: {model_name}")

    state_dict = torch.load(str(model_path), map_location=device, weights_only=True)
    if "params_ema" in state_dict:
        state_dict = state_dict["params_ema"]
    elif "params" in state_dict:
        state_dict = state_dict["params"]

    model.load_state_dict(state_dict, strict=True)
    model.eval()
    model.to(device)

    return model, device


def upscale_image(model, device, img_bgr, tile_size=512, tile_pad=10, scale=4):
    """
    Upscale a single image (numpy BGR uint8) using the model.
    Uses tiling to handle large images without running out of memory.
    """
    img = img_bgr.astype(np.float32) / 255.0
    img = torch.from_numpy(np.transpose(img[:, :, [2, 1, 0]], (2, 0, 1))).unsqueeze(0)
    img = img.to(device)

    _, _, h, w = img.shape

    if tile_size > 0 and (h > tile_size or w > tile_size):
        output = _tile_process(model, img, tile_size, tile_pad, scale, device)
    else:
        with torch.no_grad():
            output = model(img)

    output = output.squeeze(0).cpu().clamp(0, 1).numpy()
    output = np.transpose(output[[2, 1, 0], :, :], (1, 2, 0))
    output = (output * 255.0).round().astype(np.uint8)
    return output


def _tile_process(model, img, tile_size, tile_pad, scale, device):
    """Process image in tiles to save memory."""
    _, _, h, w = img.shape
    output_h = h * scale
    output_w = w * scale
    output = torch.zeros((1, 3, output_h, output_w), device=device)

    tiles_x = math.ceil(w / tile_size)
    tiles_y = math.ceil(h / tile_size)

    for y in range(tiles_y):
        for x in range(tiles_x):
            # Input tile area
            ofs_x = x * tile_size
            ofs_y = y * tile_size
            input_start_x = max(ofs_x - tile_pad, 0)
            input_end_x = min(ofs_x + tile_size + tile_pad, w)
            input_start_y = max(ofs_y - tile_pad, 0)
            input_end_y = min(ofs_y + tile_size + tile_pad, h)

            input_tile = img[:, :, input_start_y:input_end_y, input_start_x:input_end_x]

            with torch.no_grad():
                output_tile = model(input_tile)

            # Output tile area
            output_start_x = input_start_x * scale
            output_end_x = input_end_x * scale
            output_start_y = input_start_y * scale
            output_end_y = input_end_y * scale

            # Crop padding from output
            output_start_x_tile = (ofs_x - input_start_x) * scale
            output_end_x_tile = output_start_x_tile + tile_size * scale
            output_start_y_tile = (ofs_y - input_start_y) * scale
            output_end_y_tile = output_start_y_tile + tile_size * scale

            # Handle edges
            output_end_x_tile = min(output_end_x_tile, output_tile.shape[3])
            output_end_y_tile = min(output_end_y_tile, output_tile.shape[2])

            real_end_x = min(ofs_x * scale + tile_size * scale, output_w)
            real_end_y = min(ofs_y * scale + tile_size * scale, output_h)

            output[:, :, ofs_y * scale:real_end_y, ofs_x * scale:real_end_x] = \
                output_tile[:, :, output_start_y_tile:output_end_y_tile, output_start_x_tile:output_end_x_tile]

    return output


# ============================================================
# Video processing pipeline
# ============================================================

def enhance_video(input_path, output_path, model_name="realesr-general-x4v3",
                  target_scale=2, progress_callback=None):
    """
    Enhance a video using Real-ESRGAN.

    Pipeline:
    1. Extract frames with FFmpeg
    2. Upscale each frame with Real-ESRGAN (x4 then downscale to target)
    3. Reassemble with FFmpeg + H.265 compression
    4. Copy original audio track

    Args:
        input_path: Path to input video
        output_path: Path for output video
        model_name: Which Real-ESRGAN model to use
        target_scale: Final upscale factor (1 = same resolution but enhanced, 2 = double)
        progress_callback: function(percent, status_message)
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    tmpdir = tempfile.mkdtemp(prefix="video_enhance_")
    frames_dir = Path(tmpdir) / "frames"
    upscaled_dir = Path(tmpdir) / "upscaled"
    frames_dir.mkdir()
    upscaled_dir.mkdir()

    try:
        # Step 1: Get video info
        if progress_callback:
            progress_callback(0, "Analyse de la vidéo...")

        probe_cmd = [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_streams", "-show_format", str(input_path)
        ]
        probe = subprocess.run(probe_cmd, capture_output=True, text=True)
        probe_data = __import__("json").loads(probe.stdout)

        video_stream = next(s for s in probe_data["streams"] if s["codec_type"] == "video")
        orig_w = int(video_stream["width"])
        orig_h = int(video_stream["height"])
        fps_str = video_stream.get("r_frame_rate", "30/1")
        duration = float(probe_data["format"].get("duration", 0))

        # Step 2: Extract frames
        if progress_callback:
            progress_callback(2, "Extraction des frames...")

        extract_cmd = [
            "ffmpeg", "-y", "-i", str(input_path),
            "-qscale:v", "2",
            str(frames_dir / "frame_%06d.png")
        ]
        subprocess.run(extract_cmd, capture_output=True, check=True)

        frame_files = sorted(frames_dir.glob("frame_*.png"))
        total_frames = len(frame_files)

        if total_frames == 0:
            raise RuntimeError("No frames extracted from video")

        # Step 3: Load model
        if progress_callback:
            progress_callback(5, "Chargement du modèle IA...")

        model, device = load_model(model_name)

        # Compute final target size
        # Model does x4, then we resize to target_scale
        final_w = orig_w * target_scale
        final_h = orig_h * target_scale
        # Ensure even dimensions
        final_w = final_w if final_w % 2 == 0 else final_w + 1
        final_h = final_h if final_h % 2 == 0 else final_h + 1

        # Step 4: Upscale each frame
        if progress_callback:
            progress_callback(8, "Amélioration IA des frames...")

        for i, frame_path in enumerate(frame_files):
            img = cv2.imread(str(frame_path))
            if img is None:
                continue

            # Upscale x4 with Real-ESRGAN
            upscaled = upscale_image(model, device, img, tile_size=512)

            # Resize to target if needed (model does x4, we may want x2 or x1)
            if target_scale != 4:
                upscaled = cv2.resize(upscaled, (final_w, final_h), interpolation=cv2.INTER_LANCZOS4)

            out_path = upscaled_dir / frame_path.name
            cv2.imwrite(str(out_path), upscaled)

            if progress_callback:
                # Frames processing is 8% to 85%
                pct = 8 + int((i + 1) / total_frames * 77)
                progress_callback(pct, f"Amélioration IA: frame {i + 1}/{total_frames}")

        # Free GPU memory
        del model
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
        elif torch.cuda.is_available():
            torch.cuda.empty_cache()

        # Step 5: Reassemble video with H.265
        if progress_callback:
            progress_callback(87, "Assemblage et compression H.265...")

        reassemble_cmd = [
            "ffmpeg", "-y",
            "-framerate", fps_str,
            "-i", str(upscaled_dir / "frame_%06d.png"),
            "-i", str(input_path),
            "-map", "0:v",
            "-map", "1:a?",
            "-c:v", "libx265",
            "-crf", "18",
            "-preset", "slow",
            "-x265-params", "log-level=error",
            "-tag:v", "hvc1",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart",
            "-shortest",
            str(output_path)
        ]
        subprocess.run(reassemble_cmd, capture_output=True, check=True)

        if progress_callback:
            progress_callback(100, "Terminé !")

    finally:
        # Cleanup temp files
        shutil.rmtree(tmpdir, ignore_errors=True)
