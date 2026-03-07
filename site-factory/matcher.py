"""
Site Factory Engine 2.0 — Stage 2: Mapping Engine

Reads a client brief (YAML) and the template_index catalog.
Produces a replacement_map that pairs each template asset with client content.

Usage:
    python matcher.py --brief briefs/goldman-law.yaml --template electrician-company
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

from config import DEFAULT_SITE, WP_SITES
from models import (
    get_template_assets,
    get_template_images,
    create_job,
    update_job,
    get_job,
)


# ---------------------------------------------------------------------------
# Client brief loader
# ---------------------------------------------------------------------------

def load_brief(path: str) -> dict:
    """Load a client brief YAML file."""
    p = Path(path).expanduser()
    if not p.exists():
        raise FileNotFoundError(f"Brief not found: {p}")
    with open(p) as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# Matching engine
# ---------------------------------------------------------------------------

def match_text_assets(
    catalog: list[dict],
    brief: dict,
) -> dict[int, str]:
    """
    Match template text assets to client brief content.
    Returns: {template_asset_id: replacement_text}
    """
    replacements = {}
    brand = brief.get("brand", {})
    services = brief.get("services", [])

    # Get all text assets from catalog
    text_assets = [a for a in catalog if a["asset_type"] == "text"]

    # Phase 1: Brand-level replacements (company name, phone, email, tagline)
    # These replace ANY occurrence in the content via str.replace()
    brand_map = {}
    if brand.get("name"):
        brand_map["company_name"] = brand["name"]
    if brand.get("tagline"):
        brand_map["tagline"] = brand["tagline"]
    if brand.get("phone"):
        brand_map["phone"] = brand["phone"]
    if brand.get("email"):
        brand_map["email"] = brand["email"]
    if brand.get("address"):
        brand_map["address"] = brand["address"]

    # Phase 2: Service-level replacements
    # Match by position — template service slots → client services in order
    #
    # Supports BOTH legacy uagb/* and new spectra/* CSS class patterns:
    #   Legacy:  css_class in ("uagb-heading-text", "uagb-ifb-title")
    #            roles: "heading", "info-box-title"
    #   Spectra: css_class in ("spectra-content-h1"..."spectra-content-h6")
    #            roles: "hero-heading", "section-heading", "sub-heading"
    HEADING_CSS_CLASSES = {
        # Legacy uagb/*
        "uagb-heading-text", "uagb-ifb-title",
        # New spectra/*
        "spectra-content-h1", "spectra-content-h2", "spectra-content-h3",
        "spectra-content-h4", "spectra-content-h5", "spectra-content-h6",
    }
    HEADING_ROLES = {
        # Legacy
        "heading", "info-box-title",
        # Spectra
        "hero-heading", "section-heading", "sub-heading",
    }
    DESC_ROLES = {"description"}
    DESC_CSS_CLASSES = {
        "uagb-ifb-desc",       # Legacy
        "spectra-content-p",   # Spectra paragraph
        "spectra-content-default",  # Spectra default (no tagName)
    }
    BUTTON_ROLES = {"button-label"}
    BUTTON_CSS_CLASSES = {
        "uagb-buttons-repeater",  # Legacy
        "spectra-button",         # Spectra
    }

    # --- Match service headings ---
    # PRIORITY ORDER: services page → home page → other pages
    # Exclude: hero headings, generic contact labels, CTA headings
    SKIP_CONTENT = {
        "Location:", "Email:", "Phone:", "Reach Us",
        "Request a Quote Today", "Request Callback", "Contact Us",
    }
    all_headings = [
        a for a in text_assets
        if a["asset_role"] in HEADING_ROLES
        and a["css_class"] in HEADING_CSS_CLASSES
        and a["asset_role"] not in ("hero-heading",)
        and a["content"] not in SKIP_CONTENT
    ]

    # Separate service-category headings (h3/h5 on services/home pages)
    # from generic section headings (h2) and other pages
    SERVICE_PAGES = {"services", "home"}
    SERVICE_HEADING_CLASSES = {
        "spectra-content-h3", "spectra-content-h5",
        "uagb-ifb-title",  # legacy
    }
    service_headings = [
        a for a in all_headings
        if a["page_slug"] in SERVICE_PAGES
        and a["css_class"] in SERVICE_HEADING_CLASSES
    ]
    # De-duplicate: same text appearing on services AND home page → keep only first
    seen_content = set()
    unique_service_headings = []
    for a in service_headings:
        if a["content"] not in seen_content:
            seen_content.add(a["content"])
            unique_service_headings.append(a)
    service_headings = unique_service_headings

    # Also find service sub-items (h6 under services, not contact labels)
    SERVICE_SUBITEM_CLASSES = {"spectra-content-h6", "uagb-ifb-title"}
    service_subitems = [
        a for a in all_headings
        if a["page_slug"] in SERVICE_PAGES
        and a["css_class"] in SERVICE_SUBITEM_CLASSES
        and a["content"] not in SKIP_CONTENT
    ]
    # De-duplicate sub-items
    seen_subcontent = set()
    unique_subitems = []
    for a in service_subitems:
        if a["content"] not in seen_subcontent:
            seen_subcontent.add(a["content"])
            unique_subitems.append(a)
    service_subitems = unique_subitems

    # Map service categories (brief services → service_headings by position)
    for i, service in enumerate(services):
        if i < len(service_headings):
            asset = service_headings[i]
            if service.get("name"):
                replacements[asset["id"]] = service["name"]

    # Map service sub-items if brief provides them
    # (services[i].sub_items or fallback: cycle service names for sub-item slots)
    sub_services = []
    for service in services:
        if isinstance(service, dict) and service.get("sub_items"):
            sub_services.extend(service["sub_items"])
    # If no explicit sub_items, use service names cyclically for sub-item slots
    if not sub_services and services:
        service_names = [s.get("name", "") for s in services if s.get("name")]
        sub_services = service_names  # Will cycle below

    for i, sub_asset in enumerate(service_subitems):
        if i < len(sub_services):
            name = sub_services[i] if isinstance(sub_services[i], str) else sub_services[i].get("name", "")
            if name:
                replacements[sub_asset["id"]] = name

    # --- Match service descriptions ---
    # Same page-priority: services/home pages first
    service_descs = [
        a for a in text_assets
        if a["asset_role"] in DESC_ROLES
        and (a["css_class"] in DESC_CSS_CLASSES or a["asset_role"] == "description")
        and a["page_slug"] in SERVICE_PAGES
    ]
    # De-duplicate descriptions
    seen_descs = set()
    unique_descs = []
    for a in service_descs:
        if a["content"] not in seen_descs:
            seen_descs.add(a["content"])
            unique_descs.append(a)
    service_descs = unique_descs

    for i, service in enumerate(services):
        if i < len(service_descs):
            asset = service_descs[i]
            if service.get("description"):
                replacements[asset["id"]] = service["description"]

    # --- Match button labels ---
    button_assets = [
        a for a in text_assets
        if a["asset_role"] in BUTTON_ROLES
        and (a["css_class"] in BUTTON_CSS_CLASSES or a["asset_role"] == "button-label")
    ]
    button_labels = brief.get("buttons", [])
    for i, label in enumerate(button_labels):
        if i < len(button_assets):
            replacements[button_assets[i]["id"]] = label

    # --- Match accordion/FAQ headings ---
    accordion_assets = [
        a for a in text_assets
        if a["asset_role"] == "accordion-heading"
    ]
    faq_items = brief.get("faq", [])
    for i, item in enumerate(faq_items):
        if i < len(accordion_assets):
            if isinstance(item, dict):
                replacements[accordion_assets[i]["id"]] = item.get("question", item.get("name", ""))
            else:
                replacements[accordion_assets[i]["id"]] = str(item)

    # --- Match hero heading ---
    # Priority: home page hero first, then fall back to first hero heading
    hero_headings = [
        a for a in text_assets
        if a["asset_role"] == "hero-heading"
    ]
    # Prefer home page hero over other pages (about-us, services, etc.)
    home_hero = [a for a in hero_headings if a["page_slug"] == "home"]
    target_hero = home_hero[0] if home_hero else (hero_headings[0] if hero_headings else None)

    hero_text = brief.get("hero", {})
    if target_hero:
        if isinstance(hero_text, dict) and hero_text.get("headline"):
            replacements[target_hero["id"]] = hero_text["headline"]
        elif isinstance(hero_text, str):
            replacements[target_hero["id"]] = hero_text

    return replacements, brand_map


def match_image_assets(
    catalog: list[dict],
    brief: dict,
) -> dict[int, str]:
    """
    Match template image assets to client brief images.
    Returns: {template_asset_id: local_image_path}
    """
    replacements = {}
    images = brief.get("images", {})

    # Get image assets from catalog
    image_assets = [a for a in catalog if a["asset_type"] == "image"]

    # Match by role
    role_map = {
        "hero": images.get("hero"),
        "logo": images.get("logo"),
        "background": images.get("background"),
    }

    # Team photos (list)
    team_photos = images.get("team", [])
    if isinstance(team_photos, str):
        team_photos = [team_photos]

    # Service images (list)
    service_images = images.get("services", [])
    if isinstance(service_images, str):
        service_images = [service_images]

    # Match single-role images
    for asset in image_assets:
        role = asset.get("asset_role", "")
        if role in role_map and role_map[role]:
            path = role_map[role]
            replacements[asset["id"]] = str(Path(path).expanduser())

    # Match team photos by position
    team_assets = [a for a in image_assets if a["asset_role"] == "team-photo"]
    for i, photo_path in enumerate(team_photos):
        if i < len(team_assets):
            replacements[team_assets[i]["id"]] = str(Path(photo_path).expanduser())

    # Match service/card images by position
    card_assets = [a for a in image_assets if a["asset_role"] in ("card-thumb", "content-image")]
    for i, img_path in enumerate(service_images):
        if i < len(card_assets):
            replacements[card_assets[i]["id"]] = str(Path(img_path).expanduser())

    return replacements


# ---------------------------------------------------------------------------
# Main matching pipeline
# ---------------------------------------------------------------------------

def match_brief(
    template_slug: str,
    brief_path: str,
    site_key: str = DEFAULT_SITE,
) -> dict:
    """
    Full matching pipeline:
    1. Load client brief
    2. Load template catalog from Supabase
    3. Match text + images
    4. Create site_jobs record
    5. Return the job with replacement_map
    """
    print(f"\n{'='*60}")
    print(f"🔗 SITE FACTORY MATCHER v2.0")
    print(f"   Template: {template_slug}")
    print(f"   Brief: {brief_path}")
    print(f"{'='*60}\n")

    # Load brief
    brief = load_brief(brief_path)
    brand = brief.get("brand", {})
    print(f"📋 Client: {brand.get('name', 'Unknown')}")
    print(f"   Industry: {brand.get('industry', 'Unknown')}")

    # Load catalog
    catalog = get_template_assets(template_slug)
    if not catalog:
        print(f"❌ No catalog found for template '{template_slug}'")
        print(f"   Run scanner first: python scanner.py --template {template_slug}")
        return {}

    image_count = sum(1 for a in catalog if a["asset_type"] == "image")
    text_count = sum(1 for a in catalog if a["asset_type"] == "text")
    print(f"📊 Catalog: {len(catalog)} assets ({image_count} images, {text_count} text)")

    # Match
    text_replacements, brand_map = match_text_assets(catalog, brief)
    image_replacements = match_image_assets(catalog, brief)

    print(f"\n✅ Matched:")
    print(f"   Text replacements: {len(text_replacements)}")
    print(f"   Brand-level keys: {len(brand_map)}")
    print(f"   Image replacements: {len(image_replacements)}")

    # Build replacement map
    replacement_map = {
        "text": {str(k): v for k, v in text_replacements.items()},
        "images": {str(k): v for k, v in image_replacements.items()},
        "brand": brand_map,
    }

    # Create job
    site = WP_SITES[site_key]
    job = create_job(
        job_name=f"{brand.get('name', 'Unknown')} — {site['url']}",
        template_slug=template_slug,
        site_url=site["url"],
        client_brief=brief,
    )
    job_id = job["id"]

    # Save replacement map to job
    update_job(job_id, replacement_map=replacement_map, status="matched")

    print(f"\n💾 Job created: #{job_id}")
    print(f"   Status: matched")
    print(f"\n{'='*60}\n")

    return job


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Site Factory Matcher — Map client brief to template")
    parser.add_argument("--brief", required=True, help="Path to client brief YAML")
    parser.add_argument("--template", required=True, help="Template slug")
    parser.add_argument("--site", default=DEFAULT_SITE, choices=list(WP_SITES.keys()))
    args = parser.parse_args()

    match_brief(args.template, args.brief, args.site)


if __name__ == "__main__":
    main()
