#!/usr/bin/env bash
# ASI360 Field Capture Bot — deployment script
# Run from the repo root: bash services/asi360-field-bot/deploy.sh
set -euo pipefail

REMOTE="root@104.248.69.86"
DEST="/opt/asi360-field-bot"
SVC="asi360-field-bot"

echo "=== ASI360 Field Bot Deploy ==="

# 1. Copy files to droplet
echo "[1/5] Syncing files to $REMOTE:$DEST ..."
ssh "$REMOTE" "mkdir -p $DEST/media"
scp services/asi360-field-bot/field_bot.py       "$REMOTE:$DEST/"
scp services/asi360-field-bot/requirements.txt   "$REMOTE:$DEST/"
scp services/asi360-field-bot/.env.template      "$REMOTE:$DEST/"
scp services/asi360-field-bot/asi360-field-bot.service "$REMOTE:/etc/systemd/system/$SVC.service"

# 2. Create venv + install deps (only if venv missing or requirements changed)
echo "[2/5] Installing dependencies ..."
ssh "$REMOTE" bash -s <<'REMOTE_SCRIPT'
cd /opt/asi360-field-bot
if [ ! -d venv ]; then
    python3 -m venv venv
fi
venv/bin/pip install -q --upgrade pip
venv/bin/pip install -q -r requirements.txt
REMOTE_SCRIPT

# 3. Create .env if missing (bootstrap vars only)
echo "[3/5] Checking .env ..."
ssh "$REMOTE" bash -s <<'REMOTE_SCRIPT'
cd /opt/asi360-field-bot
if [ ! -f .env ]; then
    cp .env.template .env
    echo "⚠️  .env created from template — edit SUPABASE_SERVICE_KEY before starting"
    exit 1
fi
REMOTE_SCRIPT

# 4. Reload systemd + restart service
echo "[4/5] Reloading systemd and restarting $SVC ..."
ssh "$REMOTE" "systemctl daemon-reload && systemctl enable $SVC && systemctl restart $SVC"

# 5. Verify
echo "[5/5] Checking service status ..."
sleep 3
ssh "$REMOTE" "systemctl status $SVC --no-pager -l" || true

echo ""
echo "=== Deploy complete ==="
echo "Logs:  ssh $REMOTE journalctl -u $SVC -f"
echo "Metrics: http://104.248.69.86:9510/metrics"
