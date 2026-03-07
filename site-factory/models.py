"""
Site Factory Engine 2.0 — Supabase Table Models

CRUD helpers for the 3 core tables:
  - template_index  — cataloged template assets
  - site_jobs       — client site build jobs
  - asset_uploads   — per-image upload tracking
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Any

from config import get_supabase_client


# ---------------------------------------------------------------------------
# template_index
# ---------------------------------------------------------------------------

def insert_template_asset(
    template_slug: str,
    page_slug: str,
    asset_type: str,  # 'image', 'text', 'icon', 'form'
    content: str,
    *,
    asset_role: str | None = None,
    block_type: str | None = None,
    block_id: str | None = None,
    dimensions: dict | None = None,
    css_class: str | None = None,
    position: int | None = None,
    metadata: dict | None = None,
) -> dict:
    """Insert a single asset row into template_index."""
    sb = get_supabase_client()
    row = {
        "template_slug": template_slug,
        "page_slug": page_slug,
        "asset_type": asset_type,
        "content": content,
        "asset_role": asset_role,
        "block_type": block_type,
        "block_id": block_id,
        "dimensions": dimensions or {},
        "css_class": css_class,
        "position": position,
        "metadata": metadata or {},
    }
    result = sb.table("template_index").insert(row).execute()
    return result.data[0] if result.data else {}


def insert_template_assets_batch(rows: list[dict]) -> list[dict]:
    """Batch insert multiple asset rows into template_index."""
    sb = get_supabase_client()
    result = sb.table("template_index").insert(rows).execute()
    return result.data or []


def get_template_assets(template_slug: str, page_slug: str | None = None) -> list[dict]:
    """Query template_index for a given template, optionally filtered by page."""
    sb = get_supabase_client()
    query = sb.table("template_index").select("*").eq("template_slug", template_slug)
    if page_slug:
        query = query.eq("page_slug", page_slug)
    result = query.order("page_slug").order("position").execute()
    return result.data or []


def get_template_images(template_slug: str) -> list[dict]:
    """Get only image assets from a template catalog."""
    sb = get_supabase_client()
    result = (
        sb.table("template_index")
        .select("*")
        .eq("template_slug", template_slug)
        .eq("asset_type", "image")
        .order("page_slug")
        .order("position")
        .execute()
    )
    return result.data or []


def clear_template_catalog(template_slug: str) -> int:
    """Delete all rows for a template (re-scan). Returns count deleted."""
    sb = get_supabase_client()
    result = sb.table("template_index").delete().eq("template_slug", template_slug).execute()
    return len(result.data) if result.data else 0


# ---------------------------------------------------------------------------
# site_jobs
# ---------------------------------------------------------------------------

def create_job(
    job_name: str,
    template_slug: str,
    site_url: str,
    client_brief: dict,
) -> dict:
    """Create a new site build job."""
    sb = get_supabase_client()
    row = {
        "job_name": job_name,
        "template_slug": template_slug,
        "site_url": site_url,
        "client_brief": client_brief,
        "status": "draft",
        "results": {},
    }
    result = sb.table("site_jobs").insert(row).execute()
    return result.data[0] if result.data else {}


def update_job(job_id: int, **fields) -> dict:
    """Update a job's fields (status, replacement_map, results, etc.)."""
    sb = get_supabase_client()
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("site_jobs").update(fields).eq("id", job_id).execute()
    return result.data[0] if result.data else {}


def get_job(job_id: int) -> dict | None:
    """Fetch a single job by ID."""
    sb = get_supabase_client()
    result = sb.table("site_jobs").select("*").eq("id", job_id).execute()
    return result.data[0] if result.data else None


def list_jobs(status: str | None = None) -> list[dict]:
    """List all jobs, optionally filtered by status."""
    sb = get_supabase_client()
    query = sb.table("site_jobs").select("*")
    if status:
        query = query.eq("status", status)
    result = query.order("created_at", desc=True).execute()
    return result.data or []


# ---------------------------------------------------------------------------
# asset_uploads
# ---------------------------------------------------------------------------

def create_upload(
    job_id: int,
    template_asset_id: int,
    original_url: str,
    local_path: str | None = None,
) -> dict:
    """Track a pending asset upload."""
    sb = get_supabase_client()
    row = {
        "job_id": job_id,
        "template_asset_id": template_asset_id,
        "original_url": original_url,
        "local_path": local_path,
        "status": "pending",
    }
    result = sb.table("asset_uploads").insert(row).execute()
    return result.data[0] if result.data else {}


def update_upload(upload_id: int, **fields) -> dict:
    """Update upload status after processing or WP upload."""
    sb = get_supabase_client()
    result = sb.table("asset_uploads").update(fields).eq("id", upload_id).execute()
    return result.data[0] if result.data else {}


def get_job_uploads(job_id: int) -> list[dict]:
    """Get all upload records for a job."""
    sb = get_supabase_client()
    result = (
        sb.table("asset_uploads")
        .select("*")
        .eq("job_id", job_id)
        .order("id")
        .execute()
    )
    return result.data or []
