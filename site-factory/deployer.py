"""
Site Factory Engine 2.0 — Stage 4: Deploy + Activate

Uploads processed images to WordPress Media Library.
Executes str.replace() on page content for both image URLs and text.
Validates the transplant.

Usage:
    python deployer.py --job 1
"""

from __future__ import annotations

import argparse
import json
import re
import time
from collections import Counter
from pathlib import Path

import requests

from config import WP_SITES, USER_AGENT, DEFAULT_SITE, TEMPLATE_BRANDS
from models import (
    get_job,
    update_job,
    get_template_assets,
    create_upload,
    update_upload,
    get_job_uploads,
)


# ---------------------------------------------------------------------------
# WordPress helpers
# ---------------------------------------------------------------------------

def wp_session(site_key: str) -> tuple[str, tuple[str, str], dict]:
    """Return (rest_base, auth, headers)."""
    site = WP_SITES[site_key]
    auth = (site["username"], site["app_password"])
    headers = {"User-Agent": USER_AGENT}
    return site["rest_base"], auth, headers


def upload_image_to_wp(
    site_key: str,
    file_path: str,
    alt_text: str = "",
    title: str = "",
) -> dict | None:
    """
    Upload a single image to WordPress Media Library.
    Returns the media object with source_url.
    """
    rest, auth, headers = wp_session(site_key)
    p = Path(file_path)

    if not p.exists():
        print(f"  ❌ File not found: {p}")
        return None

    mime_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
        "svg": "image/svg+xml",
    }
    ext = p.suffix.lower().lstrip(".")
    content_type = mime_map.get(ext, "image/jpeg")

    upload_headers = {
        **headers,
        "Content-Disposition": f'attachment; filename="{p.name}"',
        "Content-Type": content_type,
    }

    with open(p, "rb") as f:
        r = requests.post(
            f"{rest}/media",
            data=f,
            auth=auth,
            headers=upload_headers,
        )

    if r.status_code not in (200, 201):
        print(f"  ❌ Upload failed ({r.status_code}): {r.text[:200]}")
        return None

    media = r.json()

    # Set alt text if provided
    if alt_text:
        requests.post(
            f"{rest}/media/{media['id']}",
            json={"alt_text": alt_text},
            auth=auth,
            headers={**headers, "Content-Type": "application/json"},
        )

    return media


def fetch_page_content(site_key: str, page_slug: str) -> tuple[int, str] | None:
    """Fetch raw page content. Returns (page_id, raw_content)."""
    rest, auth, headers = wp_session(site_key)
    r = requests.get(
        f"{rest}/pages",
        params={"slug": page_slug, "context": "edit"},
        auth=auth,
        headers=headers,
    )
    if r.status_code != 200 or not r.json():
        return None
    page = r.json()[0]
    content = page.get("content", {})
    raw = content.get("raw", content.get("rendered", "")) if isinstance(content, dict) else str(content)
    return page["id"], raw


def update_page_content(site_key: str, page_id: int, content: str) -> bool:
    """PUT updated content to a page."""
    rest, auth, headers = wp_session(site_key)
    r = requests.put(
        f"{rest}/pages/{page_id}",
        json={"content": content},
        auth=auth,
        headers={**headers, "Content-Type": "application/json"},
    )
    return r.status_code == 200


# ---------------------------------------------------------------------------
# Validation (adapted from v1 lint checks)
# ---------------------------------------------------------------------------

BLOCK_TYPE_RE = re.compile(r'<!-- wp:(\S+?) ')
BLOCK_ID_RE = re.compile(r'"block_id"\s*:\s*"([a-f0-9]+)"')


def validate_transplant(
    original_content: str,
    new_content: str,
    old_urls: list[str],
    new_urls: list[str],
    old_texts: list[str],
    new_texts: list[str],
) -> dict:
    """
    5-point validation:
    1. Block tag count matches
    2. Block ID set matches
    3. All new content present
    4. Zero old content remaining
    5. Special blocks survived
    """
    results = {}

    # LINT-001: Block count
    orig_blocks = Counter(BLOCK_TYPE_RE.findall(original_content))
    new_blocks = Counter(BLOCK_TYPE_RE.findall(new_content))
    results["block_count_match"] = orig_blocks == new_blocks
    if not results["block_count_match"]:
        results["block_count_diff"] = {
            "original": sum(orig_blocks.values()),
            "new": sum(new_blocks.values()),
        }

    # LINT-001b: Block ID set
    orig_ids = set(BLOCK_ID_RE.findall(original_content))
    new_ids = set(BLOCK_ID_RE.findall(new_content))
    results["block_ids_match"] = orig_ids == new_ids

    # LINT-002: New content present
    missing_urls = [u for u in new_urls if u not in new_content]
    missing_texts = [t for t in new_texts if t not in new_content]
    results["new_content_present"] = len(missing_urls) == 0 and len(missing_texts) == 0
    if missing_urls:
        results["missing_urls"] = missing_urls
    if missing_texts:
        results["missing_texts"] = missing_texts[:5]  # Limit output

    # LINT-003: Old content gone
    residual_urls = [u for u in old_urls if u in new_content]
    results["old_content_gone"] = len(residual_urls) == 0
    if residual_urls:
        results["residual_urls"] = residual_urls

    # LINT-004: Special blocks survived (both legacy uagb/* and new spectra/*)
    for block_type in [
        "uagb/google-map", "uagb/forms", "srfm/form",
        "spectra/form", "spectra/google-map", "spectra/container",
    ]:
        orig_count = original_content.count(f"wp:{block_type}")
        new_count = new_content.count(f"wp:{block_type}")
        if orig_count != new_count:
            results[f"special_block_{block_type}"] = {
                "original": orig_count,
                "new": new_count,
            }

    # Overall pass/fail
    results["passed"] = all([
        results.get("block_count_match", False),
        results.get("block_ids_match", False),
        results.get("new_content_present", False),
        results.get("old_content_gone", False),
    ])

    return results


# ---------------------------------------------------------------------------
# Deployment pipeline
# ---------------------------------------------------------------------------

def deploy_job(job_id: int, site_key: str = DEFAULT_SITE, dry_run: bool = False):
    """
    Full deployment pipeline:
    1. Upload images to WP Media Library
    2. Build URL replacement map (old CDN → new WP)
    3. Apply text + image replacements per page
    4. Validate each page
    """
    job = get_job(job_id)
    if not job:
        print(f"❌ Job #{job_id} not found")
        return

    print(f"\n{'='*60}")
    print(f"🚀 SITE FACTORY DEPLOYER v2.0")
    print(f"   Job: #{job_id} — {job['job_name']}")
    print(f"   Mode: {'DRY RUN' if dry_run else 'LIVE DEPLOY'}")
    print(f"{'='*60}\n")

    replacement_map = job.get("replacement_map", {})
    results = job.get("results", {})
    staging_dir = Path(results.get("staging_dir", ""))
    template_slug = job["template_slug"]

    catalog = get_template_assets(template_slug)
    catalog_by_id = {str(a["id"]): a for a in catalog}

    # ------------------------------------------------------------------
    # Step 1: Upload images
    # ------------------------------------------------------------------
    manifest_path = staging_dir / "manifest.json"
    url_replacements = {}  # old_url → new_url

    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)

        print(f"📤 Uploading {len(manifest)} images to WordPress Media Library...")

        for filename, info in manifest.items():
            file_path = staging_dir / "images" / filename
            asset = catalog_by_id.get(str(info["template_asset_id"]))
            old_url = info.get("original_url", "")
            alt_text = ""
            if asset:
                meta = asset.get("metadata", {})
                alt_text = meta.get("alt_text", "")

            print(f"  ↑ {filename}", end="")

            if dry_run:
                print(" — [DRY RUN skip]")
                url_replacements[old_url] = f"https://example.com/wp-content/uploads/{filename}"
                continue

            media = upload_image_to_wp(site_key, str(file_path), alt_text=alt_text)
            if media:
                new_url = media.get("source_url", "")
                url_replacements[old_url] = new_url

                # Track upload
                create_upload(
                    job_id=job_id,
                    template_asset_id=info["template_asset_id"],
                    original_url=old_url,
                    local_path=str(file_path),
                )

                print(f" ✅ → {new_url}")
            else:
                print(f" ❌ FAILED")
    else:
        print("📤 No manifest.json found — text-only deployment")

    # ------------------------------------------------------------------
    # Step 2: Build combined replacement map
    # ------------------------------------------------------------------
    content_map_path = staging_dir / "content-map.json"
    text_map = {}
    brand_map = {}

    if content_map_path.exists():
        with open(content_map_path) as f:
            cm = json.load(f)
        text_map = cm.get("text", {})
        brand_map = cm.get("brand", {})

    # Resolve text replacements: asset_id → (old_text, new_text)
    text_replacements = {}
    for asset_id_str, new_text in text_map.items():
        asset = catalog_by_id.get(asset_id_str)
        if asset:
            text_replacements[asset["content"]] = new_text

    # Resolve brand originals from template config
    # Each brand key maps to a list of original template values (variants)
    template_brand_config = TEMPLATE_BRANDS.get(template_slug, {})
    brand_originals = {}  # brand_key → list of old values to replace
    for brand_key in brand_map:
        variants = template_brand_config.get(brand_key, [])
        if isinstance(variants, str):
            variants = [variants] if variants else []
        brand_originals[brand_key] = variants

    brand_replacement_count = sum(len(v) for v in brand_originals.values())
    print(f"\n📝 Replacement map:")
    print(f"   Image URL swaps: {len(url_replacements)}")
    print(f"   Text replacements: {len(text_replacements)}")
    print(f"   Brand-level keys: {len(brand_map)} ({brand_replacement_count} variant patterns)")

    # ------------------------------------------------------------------
    # Step 3: Apply replacements per page
    # ------------------------------------------------------------------
    # Get unique pages from catalog
    pages = sorted(set(a["page_slug"] for a in catalog))
    print(f"\n📄 Processing {len(pages)} pages...")

    all_validation = {}
    total_replacements = 0

    for page_slug in pages:
        print(f"\n  📄 Page: /{page_slug}/")
        result = fetch_page_content(site_key, page_slug)
        if not result:
            print(f"     ⚠ Page not found — skipped")
            continue

        page_id, original = result
        modified = original

        # Apply image URL replacements
        img_count = 0
        for old_url, new_url in url_replacements.items():
            if old_url in modified:
                modified = modified.replace(old_url, new_url)
                img_count += 1

        # Apply text replacements — track which ones hit this page
        txt_count = 0
        page_old_texts = []
        page_new_texts = []
        for old_text, new_text in text_replacements.items():
            if old_text in modified:
                modified = modified.replace(old_text, new_text)
                txt_count += 1
                page_old_texts.append(old_text)
                page_new_texts.append(new_text)

        # Apply brand replacements (global string-level)
        # Each brand key can have multiple variant patterns to replace
        brand_count = 0
        for brand_key, new_value in brand_map.items():
            old_variants = brand_originals.get(brand_key, [])
            for old_value in old_variants:
                if old_value and old_value in modified:
                    modified = modified.replace(old_value, new_value)
                    brand_count += 1

        if modified == original:
            print(f"     No changes for this page")
            continue

        total_replacements += img_count + txt_count + brand_count
        print(f"     Replacements: {img_count} images, {txt_count} texts, {brand_count} brand")

        # Validate — page-aware: only check texts that matched THIS page
        validation = validate_transplant(
            original, modified,
            old_urls=[u for u in url_replacements.keys() if u in original],
            new_urls=[url_replacements[u] for u in url_replacements.keys() if u in original],
            old_texts=page_old_texts,
            new_texts=page_new_texts,
        )
        all_validation[page_slug] = validation
        status = "✅ PASS" if validation["passed"] else "⚠ ISSUES"
        print(f"     Validation: {status}")

        if not validation["passed"]:
            for k, v in validation.items():
                if k not in ("passed",) and v not in (True,):
                    print(f"       {k}: {v}")

        # Deploy
        if not dry_run and validation["passed"]:
            success = update_page_content(site_key, page_id, modified)
            print(f"     Deploy: {'✅ Updated' if success else '❌ Failed'}")
        elif dry_run:
            print(f"     Deploy: [DRY RUN skip]")
        else:
            print(f"     Deploy: ⏸ Skipped (validation issues)")

    # ------------------------------------------------------------------
    # Step 4: Update job
    # ------------------------------------------------------------------
    update_job(
        job_id,
        status="deployed" if not dry_run else "dry-run",
        results={
            **(results or {}),
            "validation": all_validation,
            "total_replacements": total_replacements,
            "images_uploaded": len(url_replacements),
            "deployed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
    )

    # Summary
    print(f"\n{'='*60}")
    print(f"📊 DEPLOYMENT SUMMARY")
    print(f"   Job: #{job_id}")
    print(f"   Pages processed: {len(pages)}")
    print(f"   Total replacements: {total_replacements}")
    print(f"   Images uploaded: {len(url_replacements)}")
    all_passed = all(v.get("passed", False) for v in all_validation.values())
    print(f"   Validation: {'✅ ALL PASSED' if all_passed else '⚠ ISSUES FOUND'}")
    print(f"   Status: {'DEPLOYED' if not dry_run else 'DRY RUN COMPLETE'}")
    print(f"{'='*60}\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Site Factory Deployer — Upload + activate")
    parser.add_argument("--job", type=int, required=True, help="Job ID")
    parser.add_argument("--site", default=DEFAULT_SITE, choices=list(WP_SITES.keys()))
    parser.add_argument("--dry-run", action="store_true", help="Preview without deploying")
    args = parser.parse_args()

    deploy_job(args.job, args.site, args.dry_run)


if __name__ == "__main__":
    main()
