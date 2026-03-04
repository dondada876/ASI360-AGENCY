# ASI360 Field Capture Bot

Unified Telegram bot for capturing photos, notes, work orders, and tasks from the field at 500 Grand Live.

**Bot:** `@asi360_voice_bot`
**Runtime:** Python 3.11+ on droplet `104.248.69.86`
**Service:** `systemctl status asi360-field-bot`

---

## What It Does

The field bot replaces scattered note-taking with a single Telegram interface. Send a photo from the food hall floor and the bot uses Claude Vision (Sonnet) to analyze it, extract tasks, generate summaries, and route information to the right systems.

### Modes

| Mode | Command | What happens |
|---|---|---|
| **note** | `/note` | Quick capture — AI summary + tags, stored in Supabase |
| **task** | `/task` | CEO task extraction — 29-department taxonomy, Pomodoro estimates, per-task Add/Skip review |
| **work_order** | `/work_order` | Equipment/vendor compliance/safety inspection — routes to maintenance |
| **batch** | `/batch` | Queue multiple photos now, process all at once with `/done` |
| **maintenance** | `/maintenance` | Facility issue capture — generates ticket |

### Commands

| Command | Description |
|---|---|
| `/start` | Welcome message + mode selection |
| `/mode` | Switch capture mode |
| `/note` `/task` `/work_order` `/batch` `/maintenance` | Quick-switch to that mode |
| `/done` | Process all queued photos in batch mode |
| `/pause` | Pause the bot (stops processing, useful during debugging) |
| `/resume` | Resume the bot |
| `/status` | Show current mode, pending captures, session info |

---

## Architecture

```
Telegram Photo/Text
    │
    ▼
┌─────────────────────────────────┐
│  field_bot.py (systemd)         │
│  Port 9511 (/metrics)          │
│                                 │
│  ┌─────────┐  ┌──────────────┐ │
│  │ Telegram │  │ Claude       │ │
│  │ Bot API  │  │ Sonnet       │ │
│  │          │  │ (90s timeout)│ │
│  └─────────┘  └──────────────┘ │
│       │              │          │
│  ┌─────────┐  ┌──────────────┐ │
│  │ Supabase│  │ Google Drive │ │
│  │ (meta)  │  │ (backup)     │ │
│  └─────────┘  └──────────────┘ │
└────────────────────┬────────────┘
                     │ :9511
                     ▼
              ┌──────────────┐
              │  Prometheus  │  ← scrapes every 15s
              │  (Docker)    │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │   Grafana    │  ← "ASI360 Field Bot" dashboard
              │  :9000       │
              └──────────────┘
```

### Data Flow

1. User sends photo + optional caption to the Telegram bot
2. Bot downloads the photo, saves to `/opt/asi360-field-bot/media/`
3. Photo is base64-encoded and sent to Claude Sonnet with a mode-specific prompt
4. AI response is parsed (JSON), stored in `field_captures` table in Supabase
5. In `task` mode, extracted tasks are shown as inline buttons (Add/Skip)
6. Accepted tasks are inserted into `ceo_milestones` + synced to Airtable
7. Photo is backed up to Google Drive (when SA key is configured)

### Storage

| Layer | What | Where |
|---|---|---|
| **Droplet disk** | Original photos | `/opt/asi360-field-bot/media/{YYYY-MM-DD}/` |
| **Supabase** | Metadata, AI summaries, tags, extracted data | `field_captures` table |
| **Google Drive** | Photo backups | Shared Drive folder (via Service Account) |

---

## Secrets

All secrets come from **Supabase Vault** at runtime. The `.env` file contains only two bootstrap variables:

```
SUPABASE_URL=https://gtfffxwfgcxiiauliynd.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
```

Secrets loaded from Vault via `public.get_secrets()`:

| Vault Key | Used For |
|---|---|
| `anthropic_api_key` | Claude Sonnet API calls |
| `telegram_vast_bot_token` | Telegram Bot API authentication |
| `airtable_api_key` | Airtable sync for CEO tasks |
| `airtable_base_id` | JSON with base IDs (uses `ceo_dashboard`) |
| `gdrive_folder_id` | Google Drive backup destination |

---

## Deployment

### Prerequisites

- Python 3.11+ on the droplet
- Supabase project with `field_captures` and `bot_sessions` tables
- Telegram bot token in Supabase Vault
- Anthropic API key in Supabase Vault

### Deploy from repo

```bash
# From the repo root:
bash services/asi360-field-bot/deploy.sh
```

This script:
1. Copies `field_bot.py`, `requirements.txt`, service file to the droplet
2. Creates/updates the Python venv and installs dependencies
3. Creates `.env` from template if missing
4. Reloads systemd and restarts the service
5. Prints service status

### Manual operations

```bash
# SSH to droplet
ssh root@104.248.69.86

# Service management
systemctl status asi360-field-bot
systemctl restart asi360-field-bot
systemctl stop asi360-field-bot

# Logs (live tail)
journalctl -u asi360-field-bot -f

# Check metrics endpoint
curl -s localhost:9511/metrics | head -20
```

---

## Database Schema

### `field_captures`

Main table for all captured media and AI analysis.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `chat_id` | bigint | Telegram chat ID |
| `user_name` | text | Telegram username |
| `mode` | text | `note`, `task`, `work_order`, `batch`, `maintenance` |
| `photo_path` | text | Local path on droplet |
| `gdrive_file_id` | text | Google Drive file ID |
| `gdrive_url` | text | Shareable Drive URL |
| `ai_summary` | text | Claude Vision summary |
| `ai_tags` | text[] | AI-generated searchable tags |
| `extracted_data` | jsonb | Mode-specific structured output |
| `status` | text | `pending`, `processing`, `processed`, `failed`, `archived` |
| `batch_id` | uuid | Links photos in a batch |
| `created_at` | timestamptz | Capture timestamp |

### `bot_sessions`

Conversation state per chat.

| Column | Type | Description |
|---|---|---|
| `chat_id` | bigint | Unique per user |
| `current_mode` | text | Active capture mode |
| `context` | jsonb | Conversation memory |
| `batch_id` | uuid | Active batch if in batch mode |

Migration file: [`migrations/001_field_captures.sql`](migrations/001_field_captures.sql)

---

## Monitoring

The bot exposes 20+ Prometheus metrics on port **9511** and has a dedicated Grafana dashboard with circuit breaker alerting.

### Prometheus Metrics

Metrics are served at `http://localhost:9511/metrics` using `prometheus_client`.

#### Telegram Health
| Metric | Type | Description |
|---|---|---|
| `field_bot_telegram_up` | Gauge | 1 = connected, 0 = disconnected |
| `field_bot_uptime_seconds` | Gauge | Seconds since bot started |
| `field_bot_messages_total` | Counter | Inbound messages by type (`photo`, `text`, `command`) |
| `field_bot_commands_total` | Counter | Commands by name (`start`, `mode`, `task`, etc.) |
| `field_bot_active_users` | Gauge | Distinct chat IDs in the last hour |
| `field_bot_paused` | Gauge | 1 = paused via `/pause`, 0 = running |

#### Photo Processing
| Metric | Type | Description |
|---|---|---|
| `field_bot_photos_total` | Counter | Photos received by mode |
| `field_bot_processed_total` | Counter | Photos successfully processed by mode |
| `field_bot_errors_total` | Counter | Errors by mode and error_type (`timeout`, `json_parse`, `api_error`, `unknown`) |
| `field_bot_pending_captures` | Gauge | Captures in `pending` or `processing` state (polled every 30s from Supabase) |
| `field_bot_active_batch_size` | Gauge | Photos queued in active batch |

#### AI / Claude Performance
| Metric | Type | Description |
|---|---|---|
| `field_bot_ai_duration_seconds` | Histogram | Claude API call latency by mode (buckets: 1s to 120s) |
| `field_bot_ai_tokens_input_total` | Counter | Input tokens consumed by mode |
| `field_bot_ai_tokens_output_total` | Counter | Output tokens consumed by mode |
| `field_bot_ai_cost_usd_total` | Counter | Estimated cost in USD by mode (Sonnet: $3/$15 per M tokens) |
| `field_bot_ai_timeouts_total` | Counter | Claude API timeouts (90s limit) |
| `field_bot_ai_api_errors_total` | Counter | Claude API errors by HTTP status code |

#### Task Workflow
| Metric | Type | Description |
|---|---|---|
| `field_bot_tasks_extracted_total` | Counter | Tasks extracted from photos |
| `field_bot_tasks_added_total` | Counter | Tasks accepted (user pressed Add) |
| `field_bot_tasks_skipped_total` | Counter | Tasks skipped (user pressed Skip) |
| `field_bot_milestones_created_total` | Counter | CEO milestones created in Supabase |

#### Storage
| Metric | Type | Description |
|---|---|---|
| `field_bot_disk_usage_bytes` | Gauge | Total bytes in media directory |
| `field_bot_gdrive_uploads_total` | Counter | Google Drive uploads by status (`success`, `failed`) |

### Grafana Dashboard

**URL:** `http://104.248.69.86:9000/d/field-bot-v1/asi360-field-bot`
**Login:** `admin` / `asi360ceo`

33 panels organized in 6 rows:

| Row | Panels |
|---|---|
| **Bot Health** | Status indicator, Uptime, Paused flag, Active Users, Pending Queue (red when > 0), Memory |
| **Message Traffic** | Messages/min by type (stacked), Photos/min by mode, Commands breakdown, Photos today |
| **AI Performance** | Latency p95 (stat), Latency over time (p50/p95/p99), Token consumption, Cost today ($), Cost trend |
| **Circuit Breaker** | Timeout count, Error rate %, Errors by type, API errors by status, Processing Stuck indicator |
| **Task Workflow** | Tasks extracted today, Added vs Skipped, Acceptance rate %, Milestones created |
| **Storage** | Disk usage, GDrive uploads, GDrive failures |

Dashboard JSON: [`grafana/field-bot-dashboard.json`](grafana/field-bot-dashboard.json)

### Alert Rules

Prometheus alerting rules: [`prometheus/field_bot_rules.yml`](prometheus/field_bot_rules.yml)

#### Circuit Breaker Alerts
| Alert | Condition | Severity |
|---|---|---|
| `FieldBotProcessingStuck` | `pending_captures > 0` for 5 minutes | critical |
| `FieldBotDown` | Bot or Telegram connection down for 1 minute | critical |
| `FieldBotAITimeoutSpike` | > 2 timeouts in 15 minutes | warning |
| `FieldBotMessageFlood` | > 4 photos/min sustained for 3 minutes | warning |
| `FieldBotProcessingLoop` | > 10 processed in 10m but pending still > 3 | critical |

#### Cost Alerts
| Alert | Condition | Severity |
|---|---|---|
| `FieldBotCostHourlyHigh` | > $0.50/hour | warning |
| `FieldBotCostDailyHigh` | > $2/day | warning |
| `FieldBotCostDailyCritical` | > $5/day | critical |

#### Error Alerts
| Alert | Condition | Severity |
|---|---|---|
| `FieldBotHighErrorRate` | > 30% error rate for 5 minutes | critical |
| `FieldBotAILatencyHigh` | p95 latency > 60s for 10 minutes | warning |
| `FieldBotDiskHigh` | Disk usage > 500MB for 5 minutes | warning |

#### Heartbeat Alerts
| Alert | Condition | Severity |
|---|---|---|
| `FieldBotRestarted` | Uptime < 120 seconds | info |
| `FieldBotCrashLoop` | > 3 restarts in 30 minutes | critical |
| `FieldBotRecovered` | Telegram up + pending == 0 + uptime > 300s + no stuck alerts | info |

### Recording Rules

Pre-computed PromQL aggregates for dashboard performance:

| Rule | Expression |
|---|---|
| `field_bot:msg_rate_5m` | 5-minute message rate |
| `field_bot:photo_rate_5m` | 5-minute photo rate |
| `field_bot:error_rate_pct_5m` | Error percentage over 5 minutes |
| `field_bot:ai_latency_p50/p95/p99` | AI call latency percentiles |
| `field_bot:ai_cost_hourly` | Rolling hourly cost |
| `field_bot:ai_cost_daily` | Rolling daily cost |
| `field_bot:task_accept_ratio_24h` | 24-hour task acceptance ratio |

### Monitoring Infrastructure

All monitoring runs in Docker on the droplet:

| Service | Container | Port | Purpose |
|---|---|---|---|
| Prometheus | `prometheus` | 9090 | Metrics collection + alerting |
| Grafana | `grafana` | 9000 | Dashboards + visualization |
| Node Exporter | `node-exporter` | 9100 | Host system metrics |
| cAdvisor | `cadvisor` | 8080 | Container resource metrics |

The field bot's scrape job is configured in `/opt/monitoring/prometheus/prometheus.yml`:

```yaml
- job_name: field_bot
  scrape_interval: 15s
  metrics_path: /metrics
  static_configs:
  - targets:
    - host.docker.internal:9511
    labels:
      service: field_bot
      bot: asi360_field_bot
```

Alert rules are bind-mounted into the Prometheus container via `/opt/monitoring/docker-compose.yml`.

---

## File Structure

```
services/asi360-field-bot/
├── README.md                  # This file
├── field_bot.py               # Main bot application (~1100 lines)
├── requirements.txt           # Python dependencies
├── .env.template              # Bootstrap env vars template
├── deploy.sh                  # One-command deployment script
├── asi360-field-bot.service   # systemd unit file
├── migrations/
│   └── 001_field_captures.sql # Database schema
├── prometheus/
│   └── field_bot_rules.yml    # Alerting + recording rules
└── grafana/
    └── field-bot-dashboard.json  # 33-panel Grafana dashboard
```

---

## Known Issues & Notes

- **Google Drive backup** requires a Service Account key file on the droplet at the path specified by `GDRIVE_SA_KEY_PATH`. If not configured, photos are stored locally only.
- **Claude API timeout** is set to 90 seconds. If the API hangs beyond this, the bot marks the capture as `failed` and increments the timeout counter. The `FieldBotProcessingStuck` alert catches sustained stuck states.
- The bot was originally on Claude Opus but was switched to **Sonnet** due to cost ($3/$15 vs $15/$75 per M tokens) and timeout issues observed in production.
- **Port 9511** is dedicated to this bot. No conflicts with other services (gateway: 9500, commerce: 9501, nginx: 9510).
- The `FieldBotRecovered` alert fires when all circuit breaker conditions clear, confirming the bot has returned to a healthy resting state.

---

## Commit History

| Commit | Description |
|---|---|
| `7f6fb7c` | Initial bot — 5 modes, Claude Vision, Supabase, GDrive |
| `b0e7294` | Security hardening — auth, input sanitization, secret stripping |
| `14cabcf` | Fix Vault response format handling |
| `6dc27f0` | Add 90s API timeout, `/pause` `/resume`, switch Opus to Sonnet |
| `70d6539` | Add 20+ Prometheus metrics for Grafana monitoring |
| `8e62725` | Add Prometheus alert rules + Grafana dashboard |

**Branch:** `feature/asi360-field-bot`
**PR:** [#1](https://github.com/dondada876/ASI360-AGENCY/pull/1) (open, targeting staging)
