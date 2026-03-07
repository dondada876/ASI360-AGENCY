"""
Site Factory Engine 2.0 — Configuration & Vault Bootstrap

Loads all secrets from Supabase Vault at startup.
Only SUPABASE_URL and SUPABASE_SERVICE_KEY come from environment.
"""

import os
from pathlib import Path
from supabase import create_client, Client

# ---------------------------------------------------------------------------
# Bootstrap — only two env vars allowed (loaded from .env if present)
# ---------------------------------------------------------------------------
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://gtfffxwfgcxiiauliynd.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_SERVICE_KEY:
    raise RuntimeError(
        "SUPABASE_SERVICE_KEY not set. "
        "Export it or add to .env (the ONLY secret allowed in .env)."
    )


def get_supabase_client() -> Client:
    """Return an authenticated Supabase client."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def load_secrets(names: list[str]) -> dict[str, str]:
    """Fetch secrets from Supabase Vault via public.get_secrets() RPC."""
    sb = get_supabase_client()
    result = sb.rpc("get_secrets", {"secret_names": names}).execute()
    # Handle both formats: dict (single call) or list of dicts
    if isinstance(result.data, dict):
        return result.data
    return {s["name"]: s["secret"] for s in result.data}


# ---------------------------------------------------------------------------
# Cached secrets — loaded once on import
# ---------------------------------------------------------------------------
_secrets: dict[str, str] | None = None


def secrets() -> dict[str, str]:
    """Lazy-load and cache all secrets needed by site-factory."""
    global _secrets
    if _secrets is None:
        _secrets = load_secrets([
            "siteground_ftp_password",
            "siteground_ftp_host",
            "siteground_ftp_user",
        ])
    return _secrets


# ---------------------------------------------------------------------------
# WordPress site configs
# ---------------------------------------------------------------------------
# Each site the factory can target
WP_SITES = {
    "sandbox": {
        "url": "https://sandbox.asi360.co/asi360",
        "rest_base": "https://sandbox.asi360.co/asi360/wp-json/wp/v2",
        "username": "webdevteam",
        "app_password": "Z7O2 0wbR Lsqy Vz57 4dSO 28eT",
    },
    "teslaev": {
        "url": "https://asi360.co/teslaev",
        "rest_base": "https://asi360.co/teslaev/wp-json/wp/v2",
        "username": "webdevteam",
        "app_password": "2aB1 GV9o Sima qjh9 hqMa UfGg",
    },
    # -----------------------------------------------------------------------
    # Engine 3.0 — New site targets (credentials TBD after WordPress install)
    # -----------------------------------------------------------------------
    "asi360-root": {
        "url": "https://asi360.co",
        "rest_base": "https://asi360.co/wp-json/wp/v2",
        "username": "",       # Set after SiteGround WP install
        "app_password": "",   # Set after Application Password generation
    },
    "shop": {
        "url": "https://shop.asi360.co",
        "rest_base": "https://shop.asi360.co/wp-json/wp/v2",
        "username": "",       # Set after SiteGround subdomain + WP install
        "app_password": "",   # Set after Application Password generation
    },
}

# Default target
DEFAULT_SITE = "sandbox"

# Required headers for all WP REST API calls
USER_AGENT = "ASI360-SiteFactory/2.0.0 (+https://asi360.co; contact=ops@asi360.co)"


# ---------------------------------------------------------------------------
# Plugin dependency stack — MUST be validated before any transfer/activation
# BUG-007: Missing dependency crashed entire site. Never skip this check.
# ---------------------------------------------------------------------------
# Activation order matters. Free plugins before premium extensions.
# Each entry: (plugin_slug, display_name, [dependencies])
PLUGIN_STACK = [
    # Layer 1: Standalone plugins (no plugin dependencies)
    ("ultimate-addons-for-gutenberg", "Spectra Free", []),
    ("sureforms", "SureForms", []),
    ("astra-addon", "Astra Pro", []),  # requires Astra theme, not a plugin dep
    # Layer 2: Free base plugins
    ("astra-sites", "Starter Templates (Free)", []),
    # Layer 3: Premium extensions (depend on free bases)
    ("spectra-pro", "Spectra Pro", ["ultimate-addons-for-gutenberg"]),
    ("astra-pro-sites", "Premium Starter Templates", ["astra-sites"]),
]

# Quick lookup: plugin_slug → list of required plugin slugs
PLUGIN_DEPENDENCIES = {
    slug: deps for slug, _, deps in PLUGIN_STACK
}

# Ordered list of all plugin slugs for transfer (dependency-safe order)
PLUGIN_TRANSFER_ORDER = [slug for slug, _, _ in PLUGIN_STACK]


# ---------------------------------------------------------------------------
# FTP configuration — SiteGround
# BUG-006: Only Python ftplib is reliable. lftp/curl have issues.
# ---------------------------------------------------------------------------
FTP_HOST = "ftp.asi360.co"
FTP_PORT = 21
FTP_USER = "claude_agentic_system@asi360.co"
# FTP password loaded from Vault at runtime via secrets()

# SiteGround FTP base paths per site
FTP_PLUGIN_PATHS = {
    "sandbox": "/sandbox.asi360.co/public_html/asi360/wp-content/plugins",
    "teslaev": "/asi360.co/public_html/teslaev/wp-content/plugins",
    # Engine 3.0 — New site targets
    "asi360-root": "/asi360.co/public_html/wp-content/plugins",
    "shop": "/shop.asi360.co/public_html/wp-content/plugins",
}


# ---------------------------------------------------------------------------
# SSH configuration — SiteGround (preferred over FTP)
# Both sandbox and teslaev are on the same server
# ---------------------------------------------------------------------------
SSH_HOST = "ssh.asi360.co"
SSH_PORT = 18765
SSH_USER = "u2154-jvbuddbe6fqb"
SSH_KEY = os.path.expanduser("~/.ssh/siteground_ed25519")
SSH_WRAPPER = "/tmp/sg-ssh.sh"  # Expect script handles passphrase

# SiteGround server filesystem paths
SERVER_PATHS = {
    "sandbox": "~/www/sandbox.asi360.co/public_html/asi360",
    "teslaev": "~/www/asi360.co/public_html/teslaev",
    # Engine 3.0 — New site targets
    "asi360-root": "~/www/asi360.co/public_html",
    "shop": "~/www/shop.asi360.co/public_html",
}


# ---------------------------------------------------------------------------
# Image processing defaults
# ---------------------------------------------------------------------------
IMAGE_QUALITY = {
    "jpeg": 85,
    "jpg": 85,
    "webp": 80,
    "png": 6,  # compress_level, not quality
}

# Staging directory base
STAGING_BASE = os.path.expanduser("~/staging")


# ---------------------------------------------------------------------------
# Template original brand values
# ---------------------------------------------------------------------------
# Each template's placeholder brand values used by the deployer to know
# WHAT to replace. The deployer does str.replace(old_value, new_value)
# for each brand key.
TEMPLATE_BRANDS = {
    "electrician-company": {
        "company_name": ["Spark Electric"],
        "phone": ["+1-800-123-4567", "+1 123-456-7890"],
        "email": ["info@domain.com"],
        "address": ["36-B W 1st Ave, Miller, SD 57362, USA"],
        "tagline": ["Quality Electrical Services"],
    },
    "electrician-company-v2": {
        # v2 uses generic headings — no company name to replace
        "company_name": [],
        "phone": [
            "+1-800-123-4567\u003cbr\u003e+1 123-456-7890",  # HTML <br> variant
            "+1-800-123-4567<br>+1 123-456-7890",             # raw <br> variant
            "+1-800-123-4567",
            "+1 123-456-7890",
        ],
        "email": ["info@domain.com"],
        "address": [
            "36-B W 1st Ave, Miller, SD 57362, USA",
            "36/B W 1st Ave, Miller, SD 57362, USA",
            "24/C W 2nd Ave, James Rd, ND 12345, USA",
        ],
        "tagline": ["Quality Work Through Dedication"],  # h2 section heading on home page
    },
}
