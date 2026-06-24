#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-}"
BRANCH="${2:-main}"
APP_DIR="${3:-$HOME/money}"
PORT="${PORT:-5173}"

if [[ -z "$REPO_URL" ]]; then
  echo "Usage: $0 <repo-url> [branch] [app-dir]" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y git
fi

if ! command -v node >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y nodejs npm
fi

if [[ -d "$APP_DIR/.git" ]]; then
  git config --global --add safe.directory "$APP_DIR" || true
  git -c safe.directory="$APP_DIR" -C "$APP_DIR" remote set-url origin "$REPO_URL"
  git -c safe.directory="$APP_DIR" -C "$APP_DIR" fetch origin "$BRANCH"
  git -c safe.directory="$APP_DIR" -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cat > "$APP_DIR/run.sh" <<'RUN'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-5173}" node server.js
RUN
chmod +x "$APP_DIR/run.sh"

cat > "$APP_DIR/update-from-git.sh" <<'UPDATE'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
git config --global --add safe.directory "$(pwd)" || true
SAFE_DIR="$(pwd)"
git -c safe.directory="$SAFE_DIR" fetch origin main
LOCAL="$(git -c safe.directory="$SAFE_DIR" rev-parse HEAD)"
REMOTE="$(git -c safe.directory="$SAFE_DIR" rev-parse origin/main)"
if [[ "$LOCAL" != "$REMOTE" ]]; then
  git -c safe.directory="$SAFE_DIR" reset --hard origin/main
  sudo systemctl restart money.service
fi
UPDATE
chmod +x "$APP_DIR/update-from-git.sh"

cat > "$APP_DIR/money.service" <<EOF
[Unit]
Description=Money portfolio dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/run.sh
Restart=always
RestartSec=3
Environment=PORT=$PORT

[Install]
WantedBy=multi-user.target
EOF

cat > "$APP_DIR/money-update.service" <<EOF
[Unit]
Description=Pull latest Money portfolio dashboard from GitHub

[Service]
Type=oneshot
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/update-from-git.sh
EOF

cat > "$APP_DIR/money-update.timer" <<'EOF'
[Unit]
Description=Check GitHub for Money portfolio dashboard updates

[Timer]
OnBootSec=30
OnUnitActiveSec=60
Unit=money-update.service

[Install]
WantedBy=timers.target
EOF

sudo cp "$APP_DIR/money.service" /etc/systemd/system/money.service
sudo cp "$APP_DIR/money-update.service" /etc/systemd/system/money-update.service
sudo cp "$APP_DIR/money-update.timer" /etc/systemd/system/money-update.timer
sudo systemctl daemon-reload
sudo systemctl enable money.service money-update.timer
sudo systemctl restart money.service
sudo systemctl restart money-update.timer

echo "Git auto-update installed."
echo "App: http://$(hostname -I | awk '{print $1}'):$PORT"
