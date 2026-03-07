"""
Site Factory Engine 2.0 — Stage 3: Image Pipeline

Takes a matched job's image replacement map.
Crops, resizes, and optimizes each image to match template dimensions.
Outputs to a staging folder ready for upload.

Usage:
    python processor.py --job 1
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path

from PIL import Image

from config import STAGING_BASE, IMAGE_QUALITY
from models import get_job, get_template_assets, update_job


# ---------------------------------------------------------------------------
# Image processing helpers
# ---------------------------------------------------------------------------

def smart_crop_resize(
    src_path: str,
    target_width: int,
    target_height: int,
    output_path: str,
) -> dict:
    """
    Smart crop and resize an image to exact target dimensions.
    Uses center-crop strategy: resize to fill, then crop center.
    Returns metadata about the processed image.
    """
    img = Image.open(src_path)
    original_size = img.size  # (width, height)

    # Convert RGBA to RGB for JPEG output
    if img.mode in ("RGBA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
        img = bg

    src_w, src_h = img.size
    target_ratio = target_width / target_height
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        # Source is wider — resize by height, crop width
        new_h = target_height
        new_w = int(src_w * (target_height / src_h))
        img = img.resize((new_w, new_h), Image.LANCZOS)
        # Center crop
        left = (new_w - target_width) // 2
        img = img.crop((left, 0, left + target_width, target_height))
    else:
        # Source is taller — resize by width, crop height
        new_w = target_width
        new_h = int(src_h * (target_width / src_w))
        img = img.resize((new_w, new_h), Image.LANCZOS)
        # Center crop
        top = (new_h - target_height) // 2
        img = img.crop((0, top, target_width, top + target_height))

    # Determine format and quality from output path
    ext = Path(output_path).suffix.lower().lstrip(".")
    if ext in ("jpg", "jpeg"):
        img.save(output_path, "JPEG", quality=IMAGE_QUALITY.get("jpeg", 85), optimize=True)
    elif ext == "webp":
        img.save(output_path, "WEBP", quality=IMAGE_QUALITY.get("webp", 80))
    elif ext == "png":
        img.save(output_path, "PNG", compress_level=IMAGE_QUALITY.get("png", 6))
    else:
        img.save(output_path, quality=85)

    file_size = os.path.getsize(output_path)

    return {
        "original_size": list(original_size),
        "output_size": [target_width, target_height],
        "output_format": ext,
        "file_size_kb": round(file_size / 1024, 1),
    }


def resize_preserve_aspect(
    src_path: str,
    max_width: int,
    max_height: int,
    output_path: str,
) -> dict:
    """Resize preserving aspect ratio, fitting within max dimensions."""
    img = Image.open(src_path)
    original_size = img.size

    if img.mode in ("RGBA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
        img = bg

    img.thumbnail((max_width, max_height), Image.LANCZOS)

    ext = Path(output_path).suffix.lower().lstrip(".")
    if ext in ("jpg", "jpeg"):
        img.save(output_path, "JPEG", quality=IMAGE_QUALITY.get("jpeg", 85), optimize=True)
    elif ext == "webp":
        img.save(output_path, "WEBP", quality=IMAGE_QUALITY.get("webp", 80))
    elif ext == "png":
        img.save(output_path, "PNG", compress_level=IMAGE_QUALITY.get("png", 6))
    else:
        img.save(output_path, quality=85)

    file_size = os.path.getsize(output_path)

    return {
        "original_size": list(original_size),
        "output_size": list(img.size),
        "output_format": ext,
        "file_size_kb": round(file_size / 1024, 1),
    }


# ---------------------------------------------------------------------------
# Staging folder builder
# ---------------------------------------------------------------------------

def process_job(job_id: int) -> str:
    """
    Process all images for a job:
    1. Read the replacement map
    2. For each image: crop/resize to template dimensions
    3. Output to staging folder
    4. Generate manifest.json and content-map.json
    Returns the staging folder path.
    """
    job = get_job(job_id)
    if not job:
        print(f"❌ Job #{job_id} not found")
        return ""

    print(f"\n{'='*60}")
    print(f"⚙️  SITE FACTORY PROCESSOR v2.0")
    print(f"   Job: #{job_id} — {job['job_name']}")
    print(f"{'='*60}\n")

    replacement_map = job.get("replacement_map", {})
    if not replacement_map:
        print("❌ No replacement map found. Run matcher first.")
        return ""

    template_slug = job["template_slug"]
    catalog = get_template_assets(template_slug)
    catalog_by_id = {str(a["id"]): a for a in catalog}

    # Create staging folder
    job_slug = job["job_name"].lower().replace(" ", "-").replace("—", "").replace("  ", "-")
    staging_dir = Path(STAGING_BASE) / job_slug
    images_dir = staging_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    print(f"📁 Staging: {staging_dir}")

    # Process images
    image_map = replacement_map.get("images", {})
    manifest = {}
    processed = 0
    skipped = 0

    for asset_id_str, local_path in image_map.items():
        asset = catalog_by_id.get(asset_id_str)
        if not asset:
            print(f"  ⚠ Asset #{asset_id_str} not in catalog — skipped")
            skipped += 1
            continue

        src = Path(local_path).expanduser()
        if not src.exists():
            print(f"  ⚠ Source not found: {src} — skipped")
            skipped += 1
            continue

        dims = asset.get("dimensions", {})
        target_w = dims.get("width")
        target_h = dims.get("height")
        fmt = dims.get("format", "jpg")

        # Generate output filename
        role = asset.get("asset_role", "image")
        page = asset.get("page_slug", "page")
        out_name = f"{page}-{role}-{asset['position']}"

        if target_w and target_h:
            out_name += f"-{target_w}x{target_h}"
        out_name += f".{fmt}"

        output_path = images_dir / out_name

        print(f"  🖼  {src.name} → {out_name}")

        if target_w and target_h:
            result = smart_crop_resize(str(src), target_w, target_h, str(output_path))
            print(f"     Cropped: {result['original_size']} → {result['output_size']} ({result['file_size_kb']}KB)")
        else:
            # No target dimensions — resize to reasonable max
            result = resize_preserve_aspect(str(src), 1920, 1080, str(output_path))
            print(f"     Resized: {result['original_size']} → {result['output_size']} ({result['file_size_kb']}KB)")

        manifest[out_name] = {
            "template_asset_id": int(asset_id_str),
            "original_url": asset["content"],
            "role": role,
            "page": page,
            "dimensions": result["output_size"],
            "file_size_kb": result["file_size_kb"],
        }
        processed += 1

    # Write manifest.json
    manifest_path = staging_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    # Write content-map.json (text replacements)
    content_map = {
        "text": replacement_map.get("text", {}),
        "brand": replacement_map.get("brand", {}),
    }
    content_map_path = staging_dir / "content-map.json"
    with open(content_map_path, "w") as f:
        json.dump(content_map, f, indent=2)

    # Update job status
    update_job(
        job_id,
        status="processed",
        results={
            **(job.get("results") or {}),
            "staging_dir": str(staging_dir),
            "images_processed": processed,
            "images_skipped": skipped,
        },
    )

    print(f"\n{'='*60}")
    print(f"📊 PROCESSING SUMMARY")
    print(f"   Images processed: {processed}")
    print(f"   Images skipped: {skipped}")
    print(f"   Staging folder: {staging_dir}")
    print(f"   manifest.json: ✅")
    print(f"   content-map.json: ✅")
    print(f"{'='*60}\n")

    return str(staging_dir)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Site Factory Processor — Crop/resize images")
    parser.add_argument("--job", type=int, required=True, help="Job ID from matcher")
    args = parser.parse_args()

    process_job(args.job)


if __name__ == "__main__":
    main()
