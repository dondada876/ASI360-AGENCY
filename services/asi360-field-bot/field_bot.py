#!/usr/bin/env python3
"""
ASI360 Field Capture Bot
Unified Telegram bot for capturing photos, notes, work orders, and tasks from the field.

Modes:
  note         — Quick capture: photo + optional text, AI summary, stored & tagged
  task         — CEO task extraction (29-dept taxonomy, Pomodoro, per-task review)
  work_order   — Equipment/vendor compliance/safety inspection routing
  batch        — Queue photos now, bulk process later
  maintenance  — Facility issue → ticket

Storage: Droplet disk + Google Drive backup + Supabase metadata
Secrets: Supabase Vault (only SUPABASE_URL + SUPABASE_SERVICE_KEY in .env)
"""

import os
import sys
import json
import base64
import uuid
import logging
import asyncio
from pathlib import Path
from datetime import date, datetime, timezone
from typing import Optional

import anthropic
import httpx
from supabase import create_client, Client
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, filters, ContextTypes,
)
import time as _time

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(format="%(asctime)s [%(levelname)s] %(message)s", level=logging.INFO)
log = logging.getLogger("asi360-field-bot")

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
ADMIN_CHAT_ID = int(os.getenv("ADMIN_CHAT_ID", "0"))
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", "/opt/asi360-field-bot/media"))
GDRIVE_SA_KEY = os.getenv("GDRIVE_SA_KEY_PATH", "")
GDRIVE_FOLDER_ID = ""  # populated from Vault at startup
PROM_PORT = int(os.getenv("PROM_PORT", "9511"))  # avoid port conflicts

# ── Prometheus ────────────────────────────────────────────────────────────────
from prometheus_client import Counter, Gauge, Histogram, Info, start_http_server

# Bot identity
prom_bot_info = Info("field_bot", "ASI360 Field Capture Bot info")
prom_bot_info.info({
    "version": "1.2.0",
    "service": "asi360-field-bot",
    "model": "claude-sonnet-4-20250514",
})

# ── Telegram health ──
prom_telegram_up = Gauge("field_bot_telegram_up", "1 = connected to Telegram, 0 = disconnected")
prom_uptime = Gauge("field_bot_uptime_seconds", "Seconds since bot started")
prom_messages_total = Counter("field_bot_messages_total", "All inbound messages", ["type"])  # photo, text, command
prom_commands = Counter("field_bot_commands_total", "Commands invoked", ["command"])
prom_active_users = Gauge("field_bot_active_users", "Distinct chat IDs seen in the last hour")
prom_paused = Gauge("field_bot_paused", "1 = bot is paused, 0 = running")

# ── Photo processing ──
prom_photos = Counter("field_bot_photos_total", "Photos received", ["mode"])
prom_processed = Counter("field_bot_processed_total", "Photos processed", ["mode"])
prom_errors = Counter("field_bot_errors_total", "Processing errors", ["mode", "error_type"])
prom_active_batch = Gauge("field_bot_active_batch_size", "Photos in active batch")
prom_pending = Gauge("field_bot_pending_captures", "Captures in pending/processing state")

# ── AI / Claude metrics ──
prom_ai_duration = Histogram(
    "field_bot_ai_duration_seconds", "Claude API call latency",
    ["mode"], buckets=[1, 2, 5, 10, 20, 30, 60, 90, 120],
)
prom_ai_tokens_in = Counter("field_bot_ai_tokens_input_total", "Claude input tokens", ["mode"])
prom_ai_tokens_out = Counter("field_bot_ai_tokens_output_total", "Claude output tokens", ["mode"])
prom_ai_cost_usd = Counter("field_bot_ai_cost_usd_total", "Estimated Claude API cost in USD", ["mode"])
prom_ai_timeouts = Counter("field_bot_ai_timeouts_total", "Claude API timeouts")
prom_ai_api_errors = Counter("field_bot_ai_api_errors_total", "Claude API errors", ["status_code"])

# ── Storage ──
prom_disk_usage_bytes = Gauge("field_bot_disk_usage_bytes", "Total disk usage of media dir")
prom_gdrive_uploads = Counter("field_bot_gdrive_uploads_total", "Google Drive upload count", ["status"])  # success, failed

# ── Task extraction (task mode) ──
prom_tasks_extracted = Counter("field_bot_tasks_extracted_total", "Tasks extracted from photos")
prom_tasks_added = Counter("field_bot_tasks_added_total", "Tasks accepted by user")
prom_tasks_skipped = Counter("field_bot_tasks_skipped_total", "Tasks skipped by user")
prom_milestones_created = Counter("field_bot_milestones_created_total", "CEO milestones created")

# Sonnet pricing (per M tokens)
SONNET_INPUT_PRICE = 3.00 / 1_000_000
SONNET_OUTPUT_PRICE = 15.00 / 1_000_000
_boot_time = None  # set in main()

# ── Vault Bootstrap ───────────────────────────────────────────────────────────
def load_secrets() -> dict:
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    result = sb.rpc("get_secrets", {"secret_names": [
        "anthropic_api_key",
        "asi360_field_bot_token",
        "airtable_api_key",
        "airtable_base_id",
        "gdrive_folder_id",
        "field_bot_allowed_chats",
    ]}).execute()
    raw = result.data or {}
    # Handle both formats: dict {name: secret} or list [{name:..., secret:...}]
    if isinstance(raw, dict):
        secrets = raw
    elif isinstance(raw, list):
        secrets = {s["name"]: s["secret"] for s in raw}
    else:
        secrets = {}
    # Never log secret values — only names
    log.info("Vault secrets loaded: %s", list(secrets.keys()))
    return secrets


# ── Authorization ────────────────────────────────────────────────────────────
def get_allowed_chats(secrets: dict) -> set[int]:
    """Return set of authorized chat IDs. Falls back to ADMIN_CHAT_ID only."""
    raw = secrets.get("field_bot_allowed_chats", "")
    ids = set()
    if raw:
        for part in raw.split(","):
            part = part.strip()
            if part.isdigit():
                ids.add(int(part))
    if ADMIN_CHAT_ID:
        ids.add(ADMIN_CHAT_ID)
    return ids


# ── Google Drive Helper ───────────────────────────────────────────────────────
_gdrive_service = None

def get_gdrive_service():
    global _gdrive_service
    if _gdrive_service:
        return _gdrive_service
    if not GDRIVE_SA_KEY or not Path(GDRIVE_SA_KEY).exists():
        log.warning("Google Drive SA key not found — Drive backup disabled")
        return None
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
        creds = service_account.Credentials.from_service_account_file(
            GDRIVE_SA_KEY, scopes=["https://www.googleapis.com/auth/drive.file"]
        )
        _gdrive_service = build("drive", "v3", credentials=creds)
        return _gdrive_service
    except Exception as e:
        log.error("Failed to init Google Drive: %s", e)
        return None


def upload_to_gdrive(local_path: str, folder_id: str, filename: str) -> Optional[dict]:
    svc = get_gdrive_service()
    if not svc:
        return None
    try:
        from googleapiclient.http import MediaFileUpload
        media = MediaFileUpload(local_path, mimetype="image/jpeg")
        file_meta = {"name": filename, "parents": [folder_id]}
        result = svc.files().create(body=file_meta, media_body=media, fields="id,webViewLink").execute()
        log.info("Uploaded to GDrive: %s → %s", filename, result.get("id"))
        prom_gdrive_uploads.labels(status="success").inc()
        return result
    except Exception as e:
        log.error("GDrive upload failed: %s", e)
        prom_gdrive_uploads.labels(status="failed").inc()
        return None


# ── Airtable Helper ───────────────────────────────────────────────────────────
async def airtable_create_record(api_key: str, base_id: str, table_name: str, fields: dict) -> Optional[dict]:
    url = f"https://api.airtable.com/v0/{base_id}/{table_name}"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json={"fields": fields},
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=15,
        )
        if resp.status_code in (200, 201):
            return resp.json()
        log.error("Airtable create failed (%s): %s", resp.status_code, resp.text[:200])
        return None


# ── AI Prompts ────────────────────────────────────────────────────────────────
DEPT_REF = """
DEPARTMENT CODES (use most specific subdept, e.g. #CH03.1):
CH01 Executive Leadership (.1 Strategic Planning .2 Board Relations .3 Partnerships .4 Governance)
CH02 Business Development (.1 Market Analysis .2 Partnership Creation .3 Opportunities .4 Expansion)
CH03 Sales Operations (.1 Outside Sales .2 Inside Sales .3 Channel Mgmt .4 Sales Admin)
CH04 Customer Relationships (.1 Account Mgmt .2 Customer Success .3 Retention .4 UX)
CH05 Marketing Operations (.1 Digital Marketing .2 Content Strategy .3 Events .4 Analytics)
CH06 Brand Management (.1 Brand Dev .2 Visual Identity .3 Communications .4 PR)
CH07 Product Strategy (.1 Market Research .2 Roadmapping .3 Portfolio .4 Pricing)
CH08 Product Development (.1 Design .2 Engineering .3 QA .4 Documentation)
CH09 Innovation & R&D (.1 Research .2 Experimental .3 IP .4 Tech Scouting)
CH10 Service Delivery (.1 Implementation .2 Support .3 QA .4 Service Innovation)
CH11 Operations Mgmt (.1 Process Optimization .2 Facilities .3 Excellence .4 Safety)
CH12 Supply Chain (.1 Procurement .2 Vendor Mgmt .3 Logistics .4 Inventory)
CH13 Project Office (.1 Methodology .2 Resource Alloc .3 Tracking .4 Risk Mgmt)
CH14 Active Projects (.1 Internal .2 Client .3 Infrastructure .4 Strategic)
CH15 IT Operations (.1 Infrastructure .2 Networks .3 Sysadmin .4 Support)
CH16 Digital Transformation (.1 Applications .2 Data Mgmt .3 Automation .4 Innovation)
CH17 Information Security (.1 SecOps .2 Risk .3 Compliance .4 Disaster Recovery)
CH18 Talent Management (.1 Recruitment .2 Performance .3 L&D .4 Culture)
CH19 Workforce Operations (.1 Comp & Benefits .2 HR Admin .3 Labor Relations .4 Contractors)
CH20 Financial Operations (.1 Accounting .2 AR .3 AP .4 Reporting)
CH21 Strategic Finance (.1 Planning .2 Investment .3 Capital Mgmt .4 Tax)
CH22 Legal & Compliance (.1 Corporate Law .2 Contracts .3 Regulatory .4 Litigation)
CH25 Data Operations (.1 Governance .2 BI .3 Analytics .4 Architecture)
CH26 Corporate Responsibility (.1 Environmental .2 Social .3 Ethics .4 ESG Reporting)
CH27 Global Business (.1 Regional .2 Integration .3 Market Entry .4 Intl Compliance)
CH28 Personal Development (.1 Health & Wellness .2 Professional Growth .3 Knowledge .4 Work-Life)
CH29 Family & Personal (.1 Family Mgmt .2 Home Admin .3 Personal Finance .4 Legacy .5 Legal Affairs .6 Child Development .7 Childcare .8 Family Events)
"""

NOTE_PROMPT = """You are an operations assistant. Analyze this image and provide:
1. A concise 1-2 sentence summary of what you see
2. A list of 3-8 searchable tags (single words or short phrases)
3. Full text transcription if there is any readable text

Return ONLY valid JSON:
{"summary": "...", "tags": ["tag1", "tag2"], "raw_text": "full transcription or empty string"}
"""

TASK_PROMPT = f"""You are a CEO operations assistant. Today is {date.today()}.
Analyze this image and extract every actionable item.

{DEPT_REF}

PRIORITY: P1=Critical P2=High P3=Medium P4=Low P5=Backlog P6=Optional
STATUS: S1=Not Started S2=In Progress S3=Waiting S4=Completed S5=Cancelled
ENERGY: E1=Minimal E2=Low E3=Moderate E4=High E5=Peak
POMODORO: 1=25min. Tasks >4 Pomo must split into Session 1/Session 2.

Return ONLY valid JSON:
{{"tasks": [{{"task_identifier":"#SALES22","title":"...","notes":"...","task_category":"...","department_code":"#CH03.1","department_name":"Outside Sales","priority_code":"P2","status_code":"S1","energy_level":"E4","pomodoro_total":3,"duration_minutes":75,"due_date":"YYYY-MM-DD or null"}}],
"milestones": [{{"title":"...","phase":"Q2 2026","category":"ops","status":"active","target_date":null,"impact_score":7}}],
"raw_text": "verbatim transcription"}}
"""

WORK_ORDER_PROMPT = """You are a facility operations assistant for 500 Grand Live, a food hall/parking facility in Oakland.
Analyze this photo and extract work order information:

1. What equipment, area, or system is shown?
2. What is the condition or issue?
3. What action is needed?
4. Priority assessment (urgent/high/normal/low)
5. Is this a safety concern?
6. Vendor related? If so, which vendor might this pertain to?

Return ONLY valid JSON:
{"equipment_name": "...", "location": "...", "condition": "...", "issue_description": "...",
 "action_needed": "...", "priority": "urgent|high|normal|low", "is_safety_concern": true/false,
 "vendor_related": "vendor name or null", "category": "equipment|electrical|plumbing|structural|safety|cleanliness|other",
 "tags": ["tag1","tag2"], "raw_text": "any visible text"}
"""

MAINTENANCE_PROMPT = """You are a facility maintenance assistant for 500 Grand Live.
Analyze this photo of a facility issue and provide:

1. Brief description of the issue
2. Location (if identifiable)
3. Severity: critical (immediate danger), high (needs attention today), medium (this week), low (when convenient)
4. Suggested fix or action
5. Tags for categorization

Return ONLY valid JSON:
{"issue_description": "...", "location": "...", "severity": "critical|high|medium|low",
 "suggested_action": "...", "category": "plumbing|electrical|structural|hvac|safety|pest|cleanliness|other",
 "tags": ["tag1","tag2"], "raw_text": "any visible text"}
"""


def get_prompt_for_mode(mode: str) -> str:
    return {
        "note": NOTE_PROMPT,
        "task": TASK_PROMPT,
        "work_order": WORK_ORDER_PROMPT,
        "maintenance": MAINTENANCE_PROMPT,
    }.get(mode, NOTE_PROMPT)


def parse_ai_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(raw.strip())


# ── Session Management ────────────────────────────────────────────────────────
def get_or_create_session(sb: Client, chat_id: int, user_name: str = "") -> dict:
    result = sb.table("bot_sessions").select("*").eq("chat_id", chat_id).execute()
    if result.data:
        session = result.data[0]
        sb.table("bot_sessions").update({"last_active": datetime.now(timezone.utc).isoformat()}).eq("id", session["id"]).execute()
        return session
    new_session = {
        "chat_id": chat_id,
        "user_name": user_name,
        "current_mode": "note",
        "context": {},
    }
    result = sb.table("bot_sessions").insert(new_session).execute()
    return result.data[0]


def update_session_mode(sb: Client, chat_id: int, mode: str):
    sb.table("bot_sessions").update({"current_mode": mode, "last_active": datetime.now(timezone.utc).isoformat()}).eq("chat_id", chat_id).execute()


def update_session_batch(sb: Client, chat_id: int, batch_id: Optional[str]):
    sb.table("bot_sessions").update({"batch_id": batch_id, "last_active": datetime.now(timezone.utc).isoformat()}).eq("chat_id", chat_id).execute()


# ── Photo Storage ─────────────────────────────────────────────────────────────
def save_photo_to_disk(file_bytes: bytes, mode: str) -> tuple[str, str]:
    today = date.today().isoformat()
    dir_path = MEDIA_ROOT / today / mode
    dir_path.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())[:12]
    filename = f"{file_id}.jpg"
    file_path = dir_path / filename
    file_path.write_bytes(file_bytes)
    return str(file_path), filename


# ── Mode Display ──────────────────────────────────────────────────────────────
MODE_INFO = {
    "note":        ("📝", "Note",        "Quick capture: photo + AI summary, stored & tagged"),
    "task":        ("✅", "Task",        "CEO task extraction with dept codes & Pomodoro"),
    "work_order":  ("📋", "Work Order",  "Equipment, compliance, safety inspection routing"),
    "batch":       ("📸", "Batch",       "Queue photos now, bulk process later"),
    "maintenance": ("🔧", "Maintenance", "Facility issue → ticket"),
}


def mode_keyboard() -> InlineKeyboardMarkup:
    buttons = []
    for mode_key, (emoji, label, _desc) in MODE_INFO.items():
        buttons.append([InlineKeyboardButton(f"{emoji} {label}", callback_data=f"mode:{mode_key}")])
    return InlineKeyboardMarkup(buttons)


def format_mode_status(mode: str) -> str:
    emoji, label, desc = MODE_INFO.get(mode, ("📌", mode, ""))
    return f"{emoji} *{label} Mode*\n_{desc}_"


# ── Auth Check ────────────────────────────────────────────────────────────────

_recent_chats: dict[int, float] = {}  # chat_id → last_seen_timestamp

def is_authorized(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    allowed = context.bot_data.get("allowed_chats", set())
    chat_id = update.effective_chat.id
    if chat_id not in allowed:
        log.warning("Unauthorized access attempt from chat_id=%s user=%s",
                     chat_id, getattr(update.effective_user, 'full_name', '?'))
        return False
    # Track active users for Prometheus
    _recent_chats[chat_id] = _time.time()
    # Prune chats older than 1 hour, update gauge
    cutoff = _time.time() - 3600
    active = {cid for cid, ts in _recent_chats.items() if ts > cutoff}
    prom_active_users.set(len(active))
    return True


# ── Handlers ──────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update, context):
        await update.message.reply_text("Not authorized. Contact admin.")
        return
    sb: Client = context.bot_data["supabase"]
    chat_id = update.effective_chat.id
    user_name = update.effective_user.full_name or ""
    session = get_or_create_session(sb, chat_id, user_name)
    mode = session.get("current_mode", "note")

    await update.message.reply_text(
        f"*ASI360 Field Capture Bot*\n\n"
        f"Snap photos from the field — AI processes, stores, and routes them.\n\n"
        f"Current mode: {format_mode_status(mode)}\n\n"
        f"Send a photo or use /mode to switch modes.\n"
        f"Use /help for all commands.",
        parse_mode="Markdown",
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "*ASI360 Field Capture Bot*\n\n"
        "*MODES:*\n"
        "📝 Note — Quick capture + AI summary\n"
        "✅ Task — CEO task extraction (29-dept)\n"
        "📋 Work Order — Equipment/compliance\n"
        "📸 Batch — Queue now, process later\n"
        "🔧 Maintenance — Facility issue ticket\n\n"
        "*COMMANDS:*\n"
        "/mode — Switch capture mode\n"
        "/status — Current mode + stats\n"
        "/pause — Stop AI processing (photos still saved)\n"
        "/resume — Restart AI processing\n"
        "/search <term> — Search past captures\n"
        "/batch — Show batch queue\n"
        "/process — Process batch queue\n"
        "/recent — Last 5 captures\n"
        "/help — This message\n\n"
        "*USAGE:*\n"
        "Just send a photo! Bot uses current mode to process.\n"
        "Add a caption to your photo for extra context.\n"
        "Send text for quick notes (Note mode).",
        parse_mode="Markdown",
    )


async def cmd_mode(update: Update, context: ContextTypes.DEFAULT_TYPE):
    sb: Client = context.bot_data["supabase"]
    session = get_or_create_session(sb, update.effective_chat.id)
    current = session.get("current_mode", "note")
    emoji, label, _ = MODE_INFO.get(current, ("📌", current, ""))
    await update.message.reply_text(
        f"Current: {emoji} *{label}*\n\nChoose a mode:",
        parse_mode="Markdown",
        reply_markup=mode_keyboard(),
    )


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    sb: Client = context.bot_data["supabase"]
    chat_id = update.effective_chat.id
    session = get_or_create_session(sb, chat_id)
    mode = session.get("current_mode", "note")

    # Count captures today
    today = date.today().isoformat()
    result = sb.table("field_captures").select("id", count="exact").eq("chat_id", chat_id).gte("created_at", f"{today}T00:00:00Z").execute()
    today_count = result.count or 0

    # Count batch queue
    batch_count = 0
    if session.get("batch_id"):
        br = sb.table("field_captures").select("id", count="exact").eq("batch_id", session["batch_id"]).eq("status", "pending").execute()
        batch_count = br.count or 0

    emoji, label, desc = MODE_INFO.get(mode, ("📌", mode, ""))
    await update.message.reply_text(
        f"{emoji} *{label} Mode*\n_{desc}_\n\n"
        f"📊 Today: {today_count} capture(s)\n"
        f"📦 Batch queue: {batch_count} photo(s)",
        parse_mode="Markdown",
    )


async def cmd_search(update: Update, context: ContextTypes.DEFAULT_TYPE):
    sb: Client = context.bot_data["supabase"]
    if not context.args:
        await update.message.reply_text("Usage: /search <term>")
        return
    term = " ".join(context.args)
    # Sanitize: strip special chars that could interfere with PostgREST filters
    import re as _re
    safe_term = _re.sub(r"[^\w\s\-]", "", term).strip()[:100]
    if not safe_term:
        await update.message.reply_text("Invalid search term.")
        return
    result = sb.table("field_captures").select("id,mode,ai_summary,ai_tags,created_at").or_(
        f"ai_summary.ilike.%{safe_term}%,raw_text.ilike.%{safe_term}%,caption.ilike.%{safe_term}%"
    ).eq("chat_id", update.effective_chat.id).order("created_at", desc=True).limit(10).execute()

    if not result.data:
        await update.message.reply_text(f"No captures matching: _{term}_", parse_mode="Markdown")
        return

    lines = [f"🔍 *Search: {term}* ({len(result.data)} results)\n"]
    for r in result.data:
        emoji = MODE_INFO.get(r["mode"], ("📌",))[0]
        ts = r["created_at"][:10]
        summary = (r.get("ai_summary") or "no summary")[:60]
        lines.append(f"{emoji} `{ts}` — {summary}")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_recent(update: Update, context: ContextTypes.DEFAULT_TYPE):
    sb: Client = context.bot_data["supabase"]
    result = sb.table("field_captures").select("id,mode,ai_summary,status,created_at").eq("chat_id", update.effective_chat.id).order("created_at", desc=True).limit(5).execute()

    if not result.data:
        await update.message.reply_text("No captures yet. Send a photo to get started!")
        return

    lines = ["📋 *Recent Captures*\n"]
    for r in result.data:
        emoji = MODE_INFO.get(r["mode"], ("📌",))[0]
        status_icon = {"pending": "⏳", "processing": "⚙️", "processed": "✅", "failed": "❌"}.get(r["status"], "❓")
        ts = r["created_at"][:16].replace("T", " ")
        summary = (r.get("ai_summary") or "processing...")[:50]
        lines.append(f"{status_icon} {emoji} `{ts}`\n  {summary}")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_batch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    sb: Client = context.bot_data["supabase"]
    session = get_or_create_session(sb, update.effective_chat.id)
    batch_id = session.get("batch_id")

    if not batch_id:
        await update.message.reply_text("No active batch. Switch to 📸 Batch mode and send photos.")
        return

    result = sb.table("field_captures").select("id,status,caption,created_at").eq("batch_id", batch_id).order("created_at").execute()
    pending = [r for r in (result.data or []) if r["status"] == "pending"]
    processed = [r for r in (result.data or []) if r["status"] == "processed"]

    await update.message.reply_text(
        f"📸 *Active Batch*\n\n"
        f"⏳ Pending: {len(pending)}\n"
        f"✅ Processed: {len(processed)}\n\n"
        f"Send /process to run AI extraction on all pending photos.\n"
        f"Send /mode to switch out of batch mode.",
        parse_mode="Markdown",
    )


async def cmd_process(update: Update, context: ContextTypes.DEFAULT_TYPE):
    sb: Client = context.bot_data["supabase"]
    secrets = context.bot_data["secrets"]
    session = get_or_create_session(sb, update.effective_chat.id)
    batch_id = session.get("batch_id")

    if not batch_id:
        await update.message.reply_text("No active batch to process.")
        return

    result = sb.table("field_captures").select("*").eq("batch_id", batch_id).eq("status", "pending").order("created_at").execute()
    pending = result.data or []

    if not pending:
        await update.message.reply_text("Batch is empty or already processed.")
        return

    msg = await update.message.reply_text(f"⚙️ Processing {len(pending)} photos...")

    processed = 0
    errors = 0
    all_items = []

    for capture in pending:
        try:
            photo_path = capture.get("photo_path", "")
            if not photo_path or not Path(photo_path).exists():
                errors += 1
                continue

            file_bytes = Path(photo_path).read_bytes()
            image_b64 = base64.standard_b64encode(file_bytes).decode()

            client = anthropic.Anthropic(
                api_key=secrets.get("anthropic_api_key", ""),
                timeout=httpx.Timeout(90.0, connect=10.0),
            )
            t0 = _time.monotonic()
            ai_msg = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                    {"type": "text", "text": NOTE_PROMPT},
                ]}],
            )
            ai_elapsed = _time.monotonic() - t0

            # ── Batch AI metrics ──
            prom_ai_duration.labels(mode="batch").observe(ai_elapsed)
            in_tok = getattr(ai_msg.usage, "input_tokens", 0)
            out_tok = getattr(ai_msg.usage, "output_tokens", 0)
            prom_ai_tokens_in.labels(mode="batch").inc(in_tok)
            prom_ai_tokens_out.labels(mode="batch").inc(out_tok)
            cost = in_tok * SONNET_INPUT_PRICE + out_tok * SONNET_OUTPUT_PRICE
            prom_ai_cost_usd.labels(mode="batch").inc(cost)

            extracted = parse_ai_json(ai_msg.content[0].text)
            sb.table("field_captures").update({
                "status": "processed",
                "ai_summary": extracted.get("summary", ""),
                "ai_tags": extracted.get("tags", []),
                "raw_text": extracted.get("raw_text", ""),
                "extracted_data": extracted,
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", capture["id"]).execute()

            all_items.append(extracted)
            processed += 1
            prom_processed.labels(mode="batch").inc()
        except httpx.TimeoutException:
            log.error("Batch AI timeout for %s", capture["id"])
            sb.table("field_captures").update({"status": "pending"}).eq("id", capture["id"]).execute()
            prom_ai_timeouts.inc()
            prom_errors.labels(mode="batch", error_type="timeout").inc()
            errors += 1
        except Exception as e:
            log.error("Batch process error for %s: %s", capture["id"], e)
            sb.table("field_captures").update({"status": "failed"}).eq("id", capture["id"]).execute()
            prom_errors.labels(mode="batch", error_type="unknown").inc()
            errors += 1

    await msg.edit_text(
        f"✅ *Batch Complete*\n\n"
        f"Processed: {processed}\n"
        f"Errors: {errors}\n\n"
        f"Use /recent to see results or /search to find specific items.",
        parse_mode="Markdown",
    )


# ── Mode Callback ─────────────────────────────────────────────────────────────

async def handle_mode_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    if not data.startswith("mode:"):
        return

    sb: Client = context.bot_data["supabase"]
    chat_id = update.effective_chat.id
    new_mode = data.split(":", 1)[1]

    update_session_mode(sb, chat_id, new_mode)

    # Start new batch if switching to batch mode
    if new_mode == "batch":
        batch_id = str(uuid.uuid4())
        update_session_batch(sb, chat_id, batch_id)

    emoji, label, desc = MODE_INFO.get(new_mode, ("📌", new_mode, ""))
    extra = ""
    if new_mode == "batch":
        extra = "\n\nSend photos — they'll be queued. Use /process when ready."
    elif new_mode == "task":
        extra = "\n\nSend a photo of notes/whiteboard — AI extracts tasks with dept codes & Pomodoro estimates."
    elif new_mode == "work_order":
        extra = "\n\nSnap equipment, signs, or issues — AI creates a structured work order."

    await query.edit_message_text(
        f"Switched to {emoji} *{label}*\n_{desc}_{extra}",
        parse_mode="Markdown",
    )


# ── Task Mode Helpers ─────────────────────────────────────────────────────────
# In-memory pending task reviews: {f"{chat_id}:{session_id}": [task_dicts]}
pending_task_reviews: dict[str, list[dict]] = {}


def derive_scope(dept_code: Optional[str]) -> str:
    if not dept_code:
        return "ceo"
    import re
    m = re.search(r"CH(\d+)", str(dept_code))
    if not m:
        return "ceo"
    n = int(m.group(1))
    if n == 1: return "ceo"
    if n == 22: return "legal"
    if n in (26, 27): return "project"
    if n == 28: return "personal"
    if n == 29: return "family"
    return "business"


def format_task_card(t: dict, idx: int, total: int) -> str:
    scope = derive_scope(t.get("department_code", ""))
    scope_icon = {"ceo": "👔", "legal": "⚖️", "personal": "🧘", "family": "🏠",
                  "project": "🏗️", "business": "💼"}.get(scope, "📌")
    pomo = t.get("pomodoro_total", 1)
    energy = t.get("energy_level", "E3")
    pid = t.get("task_identifier", "")
    dept = t.get("department_code", "")
    dept_name = t.get("department_name", "")
    priority = t.get("priority_code", "P3")
    notes_snippet = (t.get("notes") or "")[:80]

    lines = [
        f"Task {idx + 1} of {total}",
        f"{scope_icon} {pid}  ·  #{priority}  ·  {dept} {dept_name}",
        f"*{t.get('title', '')}*",
    ]
    if notes_snippet:
        lines.append(f"_{notes_snippet}_")
    lines.append(f"🍅×{pomo} ({pomo * 25}min)  ·  {energy}  ·  scope: {scope}")
    return "\n".join(lines)


async def handle_task_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    if not (data.startswith("tadd:") or data.startswith("tskip:")):
        return

    sb: Client = context.bot_data["supabase"]
    secrets = context.bot_data["secrets"]
    action, session_id, idx_str = data.split(":", 2)
    idx = int(idx_str)
    chat_id = update.effective_chat.id
    session_key = f"{chat_id}:{session_id}"
    tasks = pending_task_reviews.get(session_key, [])

    if idx >= len(tasks):
        await query.edit_message_text("⚠️ Session expired.")
        return

    t = tasks[idx]

    if action == "tadd":
        # Save to Supabase ceo_tasks
        try:
            sb.table("ceo_tasks").insert({
                "task_identifier": t.get("task_identifier", ""),
                "title": t.get("title", ""),
                "notes": t.get("notes", ""),
                "task_category": t.get("task_category", ""),
                "department_code": t.get("department_code", ""),
                "department_name": t.get("department_name", ""),
                "priority_code": t.get("priority_code", "P3"),
                "status_code": t.get("status_code", "S1"),
                "energy_level": t.get("energy_level", "E3"),
                "pomodoro_total": t.get("pomodoro_total", 1),
                "duration_minutes": t.get("duration_minutes", 25),
                "due_date": t.get("due_date"),
                "task_scope": derive_scope(t.get("department_code")),
                "status": "backlog",
            }).execute()

            # Also sync to Airtable CEO Dashboard Tasks
            airtable_key = secrets.get("airtable_api_key", "")
            base_ids = json.loads(secrets.get("airtable_base_id", "{}"))
            ceo_base = base_ids.get("ceo_dashboard", "")
            if airtable_key and ceo_base:
                await airtable_create_record(airtable_key, ceo_base, "Tasks", {
                    "Title": t.get("title", ""),
                    "Status": t.get("status_code", "S1"),
                    "Priority": t.get("priority_code", "P3"),
                    "Category": t.get("task_category", ""),
                    "Notes": t.get("notes", ""),
                })

            prom_tasks_added.inc()
            scope = derive_scope(t.get("department_code"))
            await query.edit_message_text(
                f"✅ Added — `{t.get('task_identifier', '?')}` [{scope}]\n_{t.get('title', '')[:40]}_",
                parse_mode="Markdown",
            )
        except Exception as e:
            log.error("Task add error: %s", e)
            await query.edit_message_text("Task save failed. Check logs.")
    else:
        prom_tasks_skipped.inc()
        await query.edit_message_text(f"❌ Skipped — _{t.get('title', '')[:40]}_", parse_mode="Markdown")


# ── Pause / Resume ───────────────────────────────────────────────────────────

async def cmd_pause(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update, context):
        return
    context.bot_data["paused"] = True
    prom_paused.set(1)
    log.info("Bot PAUSED by %s (chat_id=%s)", update.effective_user.full_name, update.effective_chat.id)
    await update.message.reply_text(
        "⏸️ *Bot paused*\n\nPhotos will be saved to disk but NOT sent to AI.\n"
        "Use /resume to restart processing.",
        parse_mode="Markdown",
    )


async def cmd_resume(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update, context):
        return
    context.bot_data["paused"] = False
    prom_paused.set(0)
    log.info("Bot RESUMED by %s (chat_id=%s)", update.effective_user.full_name, update.effective_chat.id)
    await update.message.reply_text(
        "▶️ *Bot resumed*\n\nPhotos will be processed by AI again.",
        parse_mode="Markdown",
    )


# ── Photo Handler (main) ─────────────────────────────────────────────────────

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    prom_messages_total.labels(type="photo").inc()
    if not is_authorized(update, context):
        await update.message.reply_text("Not authorized.")
        return
    sb: Client = context.bot_data["supabase"]
    secrets = context.bot_data["secrets"]
    chat_id = update.effective_chat.id

    session = get_or_create_session(sb, chat_id, update.effective_user.full_name or "")
    mode = session.get("current_mode", "note")
    caption = update.message.caption or ""

    prom_photos.labels(mode=mode).inc()

    # Download photo
    photo = update.message.photo[-1]  # highest resolution
    f = await context.bot.get_file(photo.file_id)
    file_bytes = await f.download_as_bytearray()
    file_bytes = bytes(file_bytes)

    # Save to disk
    photo_path, filename = save_photo_to_disk(file_bytes, mode)
    log.info("Photo saved: %s (%d bytes)", photo_path, len(file_bytes))

    # Upload to Google Drive
    gdrive_result = None
    gdrive_folder = secrets.get("gdrive_folder_id", "") or GDRIVE_FOLDER_ID
    if gdrive_folder:
        gdrive_result = upload_to_gdrive(photo_path, gdrive_folder, filename)

    # Create capture record
    capture = {
        "chat_id": chat_id,
        "user_name": update.effective_user.full_name or "",
        "mode": mode,
        "photo_path": photo_path,
        "gdrive_file_id": gdrive_result.get("id") if gdrive_result else None,
        "gdrive_url": gdrive_result.get("webViewLink") if gdrive_result else None,
        "file_size_bytes": len(file_bytes),
        "caption": caption,
        "status": "pending" if mode == "batch" else "processing",
        "batch_id": session.get("batch_id") if mode == "batch" else None,
    }
    result = sb.table("field_captures").insert(capture).execute()
    capture_id = result.data[0]["id"]

    # Batch mode: just queue it
    if mode == "batch":
        # Count items in batch
        bc = sb.table("field_captures").select("id", count="exact").eq("batch_id", session["batch_id"]).eq("status", "pending").execute()
        count = bc.count or 0
        prom_active_batch.set(count)
        await update.message.reply_text(
            f"📸 Queued ({count} in batch)\n"
            f"{'📝 ' + caption if caption else ''}\n"
            f"Send more or /process when ready.",
        )
        return

    # Pause check: save photo but skip AI processing
    if context.bot_data.get("paused", False):
        await update.message.reply_text(
            f"⏸️ Paused — photo saved to disk.\n"
            f"Use /resume to restart AI processing, or /process to batch-process saved photos.",
        )
        return

    # All other modes: process immediately
    status_msg = await update.message.reply_text(f"⚙️ Processing in {MODE_INFO.get(mode, ('📌',))[0]} {MODE_INFO.get(mode, ('','mode'))[1]} mode...")

    try:
        image_b64 = base64.standard_b64encode(file_bytes).decode()
        prompt = get_prompt_for_mode(mode)
        if caption:
            prompt += f"\n\nUser caption/context: {caption}"

        ai_client = anthropic.Anthropic(
            api_key=secrets.get("anthropic_api_key", ""),
            timeout=httpx.Timeout(90.0, connect=10.0),  # 90s total, 10s connect
        )
        # Sonnet for all modes (cost-effective, Opus was ~10x more expensive)
        model = "claude-sonnet-4-20250514"

        t0 = _time.monotonic()
        ai_msg = ai_client.messages.create(
            model=model,
            max_tokens=4096,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                {"type": "text", "text": prompt},
            ]}],
        )
        ai_elapsed = _time.monotonic() - t0

        # ── Record AI metrics ──
        prom_ai_duration.labels(mode=mode).observe(ai_elapsed)
        in_tok = getattr(ai_msg.usage, "input_tokens", 0)
        out_tok = getattr(ai_msg.usage, "output_tokens", 0)
        prom_ai_tokens_in.labels(mode=mode).inc(in_tok)
        prom_ai_tokens_out.labels(mode=mode).inc(out_tok)
        cost = in_tok * SONNET_INPUT_PRICE + out_tok * SONNET_OUTPUT_PRICE
        prom_ai_cost_usd.labels(mode=mode).inc(cost)
        log.info("AI done in %.1fs  tokens=%d/%d  cost=$%.4f", ai_elapsed, in_tok, out_tok, cost)

        extracted = parse_ai_json(ai_msg.content[0].text)

        # Update capture record
        update_data = {
            "status": "processed",
            "extracted_data": extracted,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }

        # Mode-specific field mapping
        if mode == "note":
            update_data["ai_summary"] = extracted.get("summary", "")
            update_data["ai_tags"] = extracted.get("tags", [])
            update_data["raw_text"] = extracted.get("raw_text", "")
        elif mode == "task":
            update_data["ai_summary"] = f"{len(extracted.get('tasks', []))} tasks, {len(extracted.get('milestones', []))} milestones"
            update_data["raw_text"] = extracted.get("raw_text", "")
            tags = []
            for t in extracted.get("tasks", []):
                tags.append(t.get("department_code", ""))
                tags.append(t.get("priority_code", ""))
            update_data["ai_tags"] = [t for t in tags if t]
        elif mode in ("work_order", "maintenance"):
            update_data["ai_summary"] = extracted.get("issue_description", extracted.get("action_needed", ""))
            update_data["ai_tags"] = extracted.get("tags", [])
            update_data["raw_text"] = extracted.get("raw_text", "")

        sb.table("field_captures").update(update_data).eq("id", capture_id).execute()
        prom_processed.labels(mode=mode).inc()

        # Mode-specific response
        if mode == "note":
            tags_str = ", ".join(extracted.get("tags", [])[:6])
            storage_info = "💾 Droplet"
            if gdrive_result:
                storage_info += " + Google Drive"
            await status_msg.edit_text(
                f"📝 *Captured*\n\n"
                f"{extracted.get('summary', 'No summary')}\n\n"
                f"🏷️ {tags_str}\n"
                f"{storage_info}\n"
                f"{'📜 Text: ' + extracted.get('raw_text', '')[:100] if extracted.get('raw_text') else ''}",
                parse_mode="Markdown",
            )

        elif mode == "task":
            tasks = extracted.get("tasks", [])
            milestones = extracted.get("milestones", [])

            # Track task extraction count
            prom_tasks_extracted.inc(len(tasks))

            # Insert milestones immediately
            for m in milestones:
                try:
                    sb.table("ceo_milestones").insert({
                        "title": m["title"],
                        "phase": m.get("phase", "Q2 2026"),
                        "category": m.get("category", "ops"),
                        "status": m.get("status", "active"),
                        "target_date": m.get("target_date"),
                        "impact_score": m.get("impact_score", 7),
                    }).execute()
                    prom_milestones_created.inc()
                except Exception as e:
                    log.warning("Milestone insert error: %s", e)

            if not tasks:
                await status_msg.edit_text(
                    f"No tasks found. {len(milestones)} milestone(s) added.\n"
                    f"Raw: {extracted.get('raw_text', '')[:200]}",
                )
                return

            # Per-task review with buttons
            review_id = str(uuid.uuid4())[:8]
            pending_task_reviews[f"{chat_id}:{review_id}"] = tasks

            await status_msg.edit_text(
                f"📋 Extracted *{len(tasks)}* task(s) — review each:\n"
                f"_{len(milestones)} milestone(s) already added_",
                parse_mode="Markdown",
            )
            for i, t in enumerate(tasks):
                card = format_task_card(t, i, len(tasks))
                kb = InlineKeyboardMarkup([[
                    InlineKeyboardButton("✅ Add", callback_data=f"tadd:{review_id}:{i}"),
                    InlineKeyboardButton("❌ Skip", callback_data=f"tskip:{review_id}:{i}"),
                ]])
                await update.message.reply_text(card, parse_mode="Markdown", reply_markup=kb)

        elif mode == "work_order":
            pri_emoji = {"urgent": "🔴", "high": "🟠", "normal": "🟡", "low": "🟢"}.get(extracted.get("priority", "normal"), "⚪")
            safety = "⚠️ SAFETY CONCERN" if extracted.get("is_safety_concern") else ""

            # Sync to Airtable Vendor Ops if vendor-related
            airtable_key = secrets.get("airtable_api_key", "")
            base_ids = json.loads(secrets.get("airtable_base_id", "{}"))
            vendor_base = base_ids.get("vendor_ops", "")
            airtable_synced = ""
            if airtable_key and vendor_base and extracted.get("category") in ("equipment", "safety"):
                at_result = await airtable_create_record(airtable_key, vendor_base, "Equipment Audit", {
                    "Equipment Name": extracted.get("equipment_name", "Unknown"),
                    "Location": extracted.get("location", ""),
                    "Review Notes": extracted.get("issue_description", ""),
                })
                if at_result:
                    airtable_synced = "\n📊 Synced to Airtable"

            await status_msg.edit_text(
                f"📋 *Work Order*\n\n"
                f"{pri_emoji} Priority: {extracted.get('priority', 'normal').upper()}\n"
                f"{'⚠️ SAFETY CONCERN\n' if safety else ''}"
                f"📍 {extracted.get('location', 'Unknown location')}\n"
                f"🔧 {extracted.get('equipment_name', 'Unknown')}\n\n"
                f"*Issue:* {extracted.get('issue_description', 'N/A')}\n"
                f"*Action:* {extracted.get('action_needed', 'N/A')}\n"
                f"{'🏪 Vendor: ' + extracted.get('vendor_related') if extracted.get('vendor_related') else ''}"
                f"{airtable_synced}",
                parse_mode="Markdown",
            )

        elif mode == "maintenance":
            sev_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(extracted.get("severity", "medium"), "⚪")

            await status_msg.edit_text(
                f"🔧 *Maintenance Ticket*\n\n"
                f"{sev_emoji} Severity: {extracted.get('severity', 'medium').upper()}\n"
                f"📍 {extracted.get('location', 'Unknown')}\n"
                f"📁 {extracted.get('category', 'other')}\n\n"
                f"*Issue:* {extracted.get('issue_description', 'N/A')}\n"
                f"*Fix:* {extracted.get('suggested_action', 'N/A')}",
                parse_mode="Markdown",
            )

    except httpx.TimeoutException:
        log.error("Claude API timeout for capture %s (mode=%s)", capture_id, mode)
        sb.table("field_captures").update({"status": "pending"}).eq("id", capture_id).execute()
        prom_errors.labels(mode=mode, error_type="timeout").inc()
        prom_ai_timeouts.inc()
        await status_msg.edit_text("⏱️ AI timed out. Photo saved — try /process later or send again.")
    except json.JSONDecodeError as e:
        log.error("AI JSON parse error: %s", e)
        sb.table("field_captures").update({"status": "failed"}).eq("id", capture_id).execute()
        prom_errors.labels(mode=mode, error_type="json_parse").inc()
        await status_msg.edit_text("Photo saved but AI extraction failed. Try again or check /recent.")
    except anthropic.APIError as e:
        log.error("Claude API error: %s", e)
        sb.table("field_captures").update({"status": "pending"}).eq("id", capture_id).execute()
        prom_errors.labels(mode=mode, error_type="api_error").inc()
        prom_ai_api_errors.labels(status_code=str(getattr(e, "status_code", "unknown"))).inc()
        await status_msg.edit_text("⚠️ AI service error. Photo saved — try again shortly.")
    except Exception as e:
        log.error("Photo processing error: %s", e)
        sb.table("field_captures").update({"status": "failed"}).eq("id", capture_id).execute()
        prom_errors.labels(mode=mode, error_type="unknown").inc()
        await status_msg.edit_text("Processing error. Photo saved to disk. Check logs or try again.")


# ── Text Handler ──────────────────────────────────────────────────────────────

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    prom_messages_total.labels(type="text").inc()
    if not is_authorized(update, context):
        return  # silently ignore unauthorized text
    sb: Client = context.bot_data["supabase"]
    chat_id = update.effective_chat.id
    session = get_or_create_session(sb, chat_id)
    mode = session.get("current_mode", "note")
    text = update.message.text.strip()

    if mode == "note":
        # Store as text-only capture
        sb.table("field_captures").insert({
            "chat_id": chat_id,
            "user_name": update.effective_user.full_name or "",
            "mode": "note",
            "caption": text,
            "ai_summary": text[:200],
            "ai_tags": [],
            "status": "processed",
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        await update.message.reply_text(f"📝 Note saved: _{text[:60]}_", parse_mode="Markdown")
    else:
        await update.message.reply_text(
            f"Send a *photo* in {MODE_INFO.get(mode, ('📌','this'))[0]} {MODE_INFO.get(mode, ('','this'))[1]} mode.\n"
            f"Or switch to 📝 Note mode for text: /mode",
            parse_mode="Markdown",
        )


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log.info("Loading secrets from Supabase Vault...")
    secrets = load_secrets()
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    token = secrets.get("asi360_field_bot_token", "")
    if not token:
        log.error("asi360_field_bot_token not found in vault!")
        sys.exit(1)

    allowed_chats = get_allowed_chats(secrets)
    if not allowed_chats:
        log.error("No allowed chat IDs configured! Set ADMIN_CHAT_ID or field_bot_allowed_chats in Vault.")
        sys.exit(1)
    log.info("Authorized chat IDs: %s", allowed_chats)

    # Ensure media dir exists
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

    # Populate GDRIVE_FOLDER_ID from Vault
    global GDRIVE_FOLDER_ID
    GDRIVE_FOLDER_ID = secrets.get("gdrive_folder_id", "")

    # Start Prometheus metrics server
    try:
        start_http_server(PROM_PORT)
        log.info("Prometheus metrics on :%d", PROM_PORT)
    except Exception as e:
        log.warning("Prometheus start failed (port %d): %s", PROM_PORT, e)

    global _boot_time
    _boot_time = _time.time()
    prom_telegram_up.set(1)
    prom_paused.set(0)

    # Background thread for uptime + disk usage gauges
    import threading

    def _metrics_updater():
        while True:
            try:
                prom_uptime.set(_time.time() - _boot_time)
                # Disk usage
                total_bytes = sum(f.stat().st_size for f in MEDIA_ROOT.rglob("*") if f.is_file())
                prom_disk_usage_bytes.set(total_bytes)
                # Pending captures count
                try:
                    pc = sb.table("field_captures").select("id", count="exact").in_("status", ["pending", "processing"]).execute()
                    prom_pending.set(pc.count or 0)
                except Exception:
                    pass
            except Exception:
                pass
            _time.sleep(30)

    t = threading.Thread(target=_metrics_updater, daemon=True)
    t.start()

    app = Application.builder().token(token).build()
    app.bot_data.update({"secrets": secrets, "supabase": sb, "allowed_chats": allowed_chats, "paused": False})

    # Commands — with Prometheus tracking wrapper
    def _tracked(cmd_name, handler_fn):
        """Wrap a command handler to count invocations."""
        async def _wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
            prom_commands.labels(command=cmd_name).inc()
            prom_messages_total.labels(type="command").inc()
            return await handler_fn(update, context)
        return _wrapper

    app.add_handler(CommandHandler("start", _tracked("start", cmd_start)))
    app.add_handler(CommandHandler("help", _tracked("help", cmd_help)))
    app.add_handler(CommandHandler("mode", _tracked("mode", cmd_mode)))
    app.add_handler(CommandHandler("status", _tracked("status", cmd_status)))
    app.add_handler(CommandHandler("search", _tracked("search", cmd_search)))
    app.add_handler(CommandHandler("recent", _tracked("recent", cmd_recent)))
    app.add_handler(CommandHandler("batch", _tracked("batch", cmd_batch)))
    app.add_handler(CommandHandler("process", _tracked("process", cmd_process)))
    app.add_handler(CommandHandler("pause", _tracked("pause", cmd_pause)))
    app.add_handler(CommandHandler("resume", _tracked("resume", cmd_resume)))

    # Callbacks
    app.add_handler(CallbackQueryHandler(handle_mode_callback, pattern=r"^mode:"))
    app.add_handler(CallbackQueryHandler(handle_task_callback, pattern=r"^t(add|skip):"))

    # Messages
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    log.info("ASI360 Field Capture Bot starting...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
