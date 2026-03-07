"""
Site Factory Engine 2.0 — Stage 1: Template Scanner

Scans a WordPress starter template via REST API.
Extracts every asset (images + text) with full metadata.
Stores the catalog in Supabase `template_index`.

Usage:
    python scanner.py --site sandbox --template electrician-company
    python scanner.py --site sandbox --template electrician-company --page home
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from urllib.parse import urlparse

import requests

from config import WP_SITES, USER_AGENT, DEFAULT_SITE
from models import (
    insert_template_assets_batch,
    clear_template_catalog,
    get_template_assets,
)


# ---------------------------------------------------------------------------
# WordPress REST API helpers
# ---------------------------------------------------------------------------

def wp_auth(site_key: str) -> tuple[str, tuple[str, str], dict]:
    """Return (rest_base, auth_tuple, headers) for a WP site."""
    site = WP_SITES[site_key]
    auth = (site["username"], site["app_password"])
    headers = {"User-Agent": USER_AGENT}
    return site["rest_base"], auth, headers


def fetch_pages(site_key: str) -> list[dict]:
    """Get all pages from the site."""
    rest, auth, headers = wp_auth(site_key)
    pages = []
    page_num = 1
    while True:
        r = requests.get(
            f"{rest}/pages",
            params={"per_page": 50, "page": page_num, "context": "edit"},
            auth=auth,
            headers=headers,
        )
        if r.status_code != 200:
            break
        data = r.json()
        if not data:
            break
        pages.extend(data)
        page_num += 1
    return pages


def fetch_page_by_slug(site_key: str, slug: str) -> dict | None:
    """Get a single page by slug with raw block content."""
    rest, auth, headers = wp_auth(site_key)
    r = requests.get(
        f"{rest}/pages",
        params={"slug": slug, "context": "edit"},
        auth=auth,
        headers=headers,
    )
    if r.status_code != 200:
        print(f"  ERROR: {r.status_code} - {r.text[:200]}")
        return None
    data = r.json()
    return data[0] if data else None


# ---------------------------------------------------------------------------
# Block parsing — extract all assets from raw block markup
# ---------------------------------------------------------------------------

# Image URL patterns in Spectra/Gutenberg block markup
IMAGE_PATTERNS = [
    # Spectra image block: "url":"https://..."
    (r'"url"\s*:\s*"(https?://[^"]+\.(?:jpg|jpeg|png|gif|svg|webp))"', "block_attr_url"),
    # Background image: "backgroundImage":{"url":"..."}
    (r'"backgroundImage"\s*:\s*\{[^}]*"url"\s*:\s*"(https?://[^"]+)"', "background_image"),
    # HTML img src: src="https://..."
    (r'<img[^>]+src="(https?://[^"]+)"', "img_src"),
    # Spectra icon/image: "iconImage":{"url":"..."}
    (r'"iconImage"\s*:\s*\{[^}]*"url"\s*:\s*"(https?://[^"]+)"', "icon_image"),
    # srcSet patterns
    (r'"srcSet"\s*:\s*"(https?://[^"]+)"', "srcset"),
]

# Text extraction patterns — supports BOTH old (uagb/*) and new (spectra/*) blocks
TEXT_PATTERNS_V1 = [
    # Legacy Spectra (uagb/) — still works on sandbox and older templates
    # 1. Section headings
    (r'<h[1-6][^>]*class="uagb-heading-text"[^>]*>(.*?)</h[1-6]>', "uagb-heading-text", "heading"),
    # 2. Info-box titles AND checklist items
    (r'<[ph][1-6]? class="uagb-ifb-title">(.*?)</[ph][1-6]?>', "uagb-ifb-title", "info-box-title"),
    # 3. Info-box descriptions
    (r'<p class="uagb-ifb-desc">(.*?)</p>', "uagb-ifb-desc", "description"),
    # 4. Button labels
    (r'<a class="uagb-buttons-repeater[^"]*"[^>]*>(.*?)</a>', "uagb-buttons-repeater", "button-label"),
    # 5. JSON attribute (editor sync)
    (r'"tempHeadingDesc":"([^"]*)"', "tempHeadingDesc", "heading-json"),
]

# New Spectra (spectra/*) — 2024+ block format, text is in JSON block attributes
SPECTRA_TEXT_PATTERNS = [
    # spectra/content — main text block (headings, paragraphs, etc.)
    # Text stored in "text" JSON attribute of block comment
    (r'<!-- wp:spectra/content \{[^}]*"tagName":"(h[1-6])"[^}]*"text":"([^"]+)"',
     "spectra-content", "heading"),
    (r'<!-- wp:spectra/content \{[^}]*"tagName":"p"[^}]*"text":"([^"]+)"',
     "spectra-content-p", "description"),
    # spectra/button — button text
    (r'<!-- wp:spectra/button \{[^}]*"text":"([^"]+)"',
     "spectra-button", "button-label"),
    # spectra/accordion-child-header-content — FAQ/accordion headers
    (r'<!-- wp:spectra/accordion-child-header-content \{[^}]*"text":"([^"]+)"',
     "spectra-accordion-header", "accordion-heading"),
]

# Block type patterns
BLOCK_TYPE_RE = re.compile(r'<!-- wp:(\S+?) ')
BLOCK_ID_RE = re.compile(r'"block_id"\s*:\s*"([a-f0-9]+)"')

# Dimension extraction from block attributes
WIDTH_RE = re.compile(r'"width"\s*:\s*(\d+)')
HEIGHT_RE = re.compile(r'"height"\s*:\s*(\d+)')
ALT_RE = re.compile(r'"alt"\s*:\s*"([^"]*)"')


def extract_images(content: str) -> list[dict]:
    """Extract all image URLs from block markup with metadata."""
    images = []
    seen_urls = set()

    for pattern, source_type in IMAGE_PATTERNS:
        for match in re.finditer(pattern, content):
            url = match.group(1)
            if url in seen_urls:
                continue
            seen_urls.add(url)

            # Try to find dimensions near this URL in the content
            # Look in a window around the match
            start = max(0, match.start() - 500)
            end = min(len(content), match.end() + 500)
            context_window = content[start:end]

            width_m = WIDTH_RE.search(context_window)
            height_m = HEIGHT_RE.search(context_window)
            alt_m = ALT_RE.search(context_window)

            # Determine format from URL
            parsed = urlparse(url)
            ext = parsed.path.rsplit(".", 1)[-1].lower() if "." in parsed.path else "unknown"

            # Determine block type from surrounding context
            block_window_start = max(0, match.start() - 2000)
            block_context = content[block_window_start:match.start()]
            block_types = BLOCK_TYPE_RE.findall(block_context)
            block_type = block_types[-1] if block_types else None

            # Find block_id
            block_ids = BLOCK_ID_RE.findall(block_context)
            block_id = block_ids[-1] if block_ids else None

            images.append({
                "url": url,
                "source_type": source_type,
                "format": ext,
                "width": int(width_m.group(1)) if width_m else None,
                "height": int(height_m.group(1)) if height_m else None,
                "alt_text": alt_m.group(1) if alt_m else None,
                "block_type": f"wp:{block_type}" if block_type else None,
                "block_id": block_id,
            })

    return images


def extract_text(content: str) -> list[dict]:
    """Extract all replaceable text from block markup.

    Supports both legacy uagb/* patterns (v1) and new spectra/* patterns (2024+).
    Tries new patterns first, falls back to legacy if none found.
    """
    texts = []

    # --- New Spectra patterns (spectra/content, spectra/button, etc.) ---
    spectra_count = 0

    # spectra/content with tagName heading (h1-h6) — has 2 capture groups
    for i, match in enumerate(re.finditer(
        r'<!-- wp:spectra/content \{[^}]*"tagName":"(h[1-6])"[^}]*"text":"([^"]+)"',
        content
    )):
        tag = match.group(1)
        text = match.group(2).strip()
        if not text or len(text) < 2:
            continue
        # Map h1→hero-heading, h2→section-heading, h3-h6→sub-heading
        if tag == "h1":
            role = "hero-heading"
        elif tag == "h2":
            role = "section-heading"
        else:
            role = "sub-heading"

        texts.append({
            "text": text,
            "css_class": f"spectra-content-{tag}",
            "role": role,
            "position": i,
            "block_type": "wp:spectra/content",
            "block_id": None,
        })
        spectra_count += 1

    # spectra/content with tagName=p — 1 capture group (text only)
    # Need to match "p" but NOT already matched headings
    for i, match in enumerate(re.finditer(
        r'<!-- wp:spectra/content \{[^}]*"tagName":"p"[^}]*"text":"([^"]+)"',
        content
    )):
        text = match.group(1).strip()
        if not text or len(text) < 2:
            continue
        texts.append({
            "text": text,
            "css_class": "spectra-content-p",
            "role": "description",
            "position": i,
            "block_type": "wp:spectra/content",
            "block_id": None,
        })
        spectra_count += 1

    # spectra/content without explicit tagName (defaults to p)
    # Match "text" before "tagName" or without "tagName"
    for i, match in enumerate(re.finditer(
        r'<!-- wp:spectra/content \{"text":"([^"]+)"',
        content
    )):
        text = match.group(1).strip()
        if not text or len(text) < 2:
            continue
        # Avoid duplicates — check if this text was already captured
        if any(t["text"] == text for t in texts):
            continue
        texts.append({
            "text": text,
            "css_class": "spectra-content-default",
            "role": "description",
            "position": i,
            "block_type": "wp:spectra/content",
            "block_id": None,
        })
        spectra_count += 1

    # spectra/button — button text
    for i, match in enumerate(re.finditer(
        r'<!-- wp:spectra/button \{[^}]*"text":"([^"]+)"',
        content
    )):
        text = match.group(1).strip()
        if not text or len(text) < 2:
            continue
        texts.append({
            "text": text,
            "css_class": "spectra-button",
            "role": "button-label",
            "position": i,
            "block_type": "wp:spectra/button",
            "block_id": None,
        })
        spectra_count += 1

    # spectra/accordion-child-header-content — FAQ headers
    for i, match in enumerate(re.finditer(
        r'<!-- wp:spectra/accordion-child-header-content \{[^}]*"text":"([^"]+)"',
        content
    )):
        text = match.group(1).strip()
        if not text or len(text) < 2:
            continue
        texts.append({
            "text": text,
            "css_class": "spectra-accordion-header",
            "role": "accordion-heading",
            "position": i,
            "block_type": "wp:spectra/accordion-child-header-content",
            "block_id": None,
        })
        spectra_count += 1

    # --- Legacy uagb/* patterns (v1) — fallback for older templates ---
    if spectra_count == 0:
        for pattern, css_class, role in TEXT_PATTERNS_V1:
            for i, match in enumerate(re.finditer(pattern, content, re.DOTALL)):
                text = match.group(1).strip()
                if not text or len(text) < 2:
                    continue

                if css_class == "tempHeadingDesc":
                    role = "heading-json-sync"

                block_window_start = max(0, match.start() - 2000)
                block_context = content[block_window_start:match.start()]
                block_types = BLOCK_TYPE_RE.findall(block_context)
                block_type = block_types[-1] if block_types else None

                block_ids = BLOCK_ID_RE.findall(block_context)
                block_id = block_ids[-1] if block_ids else None

                texts.append({
                    "text": text,
                    "css_class": css_class,
                    "role": role,
                    "position": i,
                    "block_type": f"wp:{block_type}" if block_type else None,
                    "block_id": block_id,
                })

    return texts


def classify_image_role(url: str, block_type: str | None, width: int | None, height: int | None) -> str:
    """Heuristic classification of image role based on context."""
    url_lower = url.lower()

    # Check filename hints
    if any(x in url_lower for x in ["logo", "brand"]):
        return "logo"
    if any(x in url_lower for x in ["hero", "banner", "header-bg"]):
        return "hero"
    if any(x in url_lower for x in ["team", "person", "staff", "portrait"]):
        return "team-photo"
    if any(x in url_lower for x in ["icon", "svg"]):
        return "icon"
    if any(x in url_lower for x in ["bg", "background", "pattern"]):
        return "background"
    if any(x in url_lower for x in ["testimonial", "review", "avatar"]):
        return "testimonial"
    if any(x in url_lower for x in ["gallery", "project", "portfolio", "work"]):
        return "portfolio"

    # Check dimensions
    if width and height:
        aspect = width / height if height > 0 else 0
        if width >= 1200 and aspect > 1.5:
            return "hero"
        if width == height and width <= 500:
            return "avatar"
        if width <= 200 and height <= 200:
            return "icon"
        if width <= 600 and height <= 600:
            return "card-thumb"

    # Check block type
    if block_type and "image" in block_type:
        return "content-image"
    if block_type and "info-box" in block_type:
        return "card-thumb"
    if block_type and "testimonial" in block_type:
        return "testimonial"
    if block_type and "team" in block_type:
        return "team-photo"

    return "content-image"


# ---------------------------------------------------------------------------
# Scanner pipeline
# ---------------------------------------------------------------------------

def scan_page(site_key: str, template_slug: str, page: dict) -> list[dict]:
    """Scan a single page and return asset rows for template_index."""
    slug = page["slug"]
    content = page.get("content", {})

    # Handle both dict and string content formats
    if isinstance(content, dict):
        raw = content.get("raw", content.get("rendered", ""))
    else:
        raw = str(content)

    if not raw:
        print(f"  ⚠ Page '{slug}' has no content")
        return []

    # Block census
    block_types = BLOCK_TYPE_RE.findall(raw)
    block_ids = BLOCK_ID_RE.findall(raw)
    census = Counter(block_types)

    print(f"  📊 Block census: {sum(census.values())} blocks, {len(set(block_ids))} unique IDs")
    for bt, count in census.most_common(10):
        print(f"     {bt}: {count}")

    rows = []

    # Extract images
    images = extract_images(raw)
    print(f"  🖼  Found {len(images)} unique images")
    for i, img in enumerate(images):
        role = classify_image_role(img["url"], img["block_type"], img["width"], img["height"])
        rows.append({
            "template_slug": template_slug,
            "page_slug": slug,
            "asset_type": "image",
            "asset_role": role,
            "block_type": img["block_type"],
            "block_id": img["block_id"],
            "content": img["url"],
            "dimensions": {
                "width": img["width"],
                "height": img["height"],
                "format": img["format"],
            },
            "css_class": None,
            "position": i,
            "metadata": {
                "alt_text": img["alt_text"],
                "source_type": img["source_type"],
            },
        })

    # Extract text
    texts = extract_text(raw)
    print(f"  📝 Found {len(texts)} text assets")
    for i, txt in enumerate(texts):
        rows.append({
            "template_slug": template_slug,
            "page_slug": slug,
            "asset_type": "text",
            "asset_role": txt["role"],
            "block_type": txt["block_type"],
            "block_id": txt["block_id"],
            "content": txt["text"],
            "dimensions": {},
            "css_class": txt["css_class"],
            "position": txt["position"],
            "metadata": {},
        })

    return rows


def scan_template(site_key: str, template_slug: str, page_slug: str | None = None):
    """
    Scan all pages (or a single page) of a template.
    Stores results in Supabase template_index.
    """
    print(f"\n{'='*60}")
    print(f"🔍 SITE FACTORY SCANNER v2.0")
    print(f"   Site: {site_key}")
    print(f"   Template: {template_slug}")
    print(f"   Target: {'all pages' if not page_slug else page_slug}")
    print(f"{'='*60}\n")

    if page_slug:
        page = fetch_page_by_slug(site_key, page_slug)
        if not page:
            print(f"❌ Page '{page_slug}' not found")
            return
        pages = [page]
    else:
        print("📡 Fetching all pages...")
        pages = fetch_pages(site_key)
        print(f"   Found {len(pages)} pages\n")

    # Clear existing catalog for this template (re-scan)
    existing = get_template_assets(template_slug)
    if existing:
        print(f"🗑  Clearing {len(existing)} existing catalog entries for '{template_slug}'")
        clear_template_catalog(template_slug)

    all_rows = []
    total_images = 0
    total_texts = 0

    for page in pages:
        slug = page["slug"]
        title = page.get("title", {})
        if isinstance(title, dict):
            title = title.get("rendered", title.get("raw", slug))

        print(f"\n📄 Page: {title} (/{slug}/)")
        print(f"   ID: {page['id']} | Status: {page.get('status', 'unknown')}")

        rows = scan_page(site_key, template_slug, page)
        all_rows.extend(rows)

        img_count = sum(1 for r in rows if r["asset_type"] == "image")
        txt_count = sum(1 for r in rows if r["asset_type"] == "text")
        total_images += img_count
        total_texts += txt_count

    if not all_rows:
        print("\n⚠ No assets found to catalog")
        return

    # Batch insert into Supabase
    print(f"\n{'='*60}")
    print(f"💾 Inserting {len(all_rows)} assets into template_index...")
    inserted = insert_template_assets_batch(all_rows)
    print(f"   ✅ Inserted {len(inserted)} rows")

    # Summary
    print(f"\n📊 SCAN SUMMARY")
    print(f"   Template: {template_slug}")
    print(f"   Pages scanned: {len(pages)}")
    print(f"   Images cataloged: {total_images}")
    print(f"   Text assets cataloged: {total_texts}")
    print(f"   Total assets: {len(all_rows)}")

    # Role breakdown
    roles = Counter(r["asset_role"] for r in all_rows)
    print(f"\n   Asset roles:")
    for role, count in roles.most_common():
        print(f"     {role}: {count}")

    print(f"\n{'='*60}\n")
    return inserted


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Site Factory Scanner — Catalog template assets")
    parser.add_argument("--site", default=DEFAULT_SITE, choices=list(WP_SITES.keys()),
                        help="WordPress site key (default: sandbox)")
    parser.add_argument("--template", required=True,
                        help="Template slug (e.g., electrician-company)")
    parser.add_argument("--page", default=None,
                        help="Scan only this page slug (default: all pages)")
    args = parser.parse_args()

    scan_template(args.site, args.template, args.page)


if __name__ == "__main__":
    main()
