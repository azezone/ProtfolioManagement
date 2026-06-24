#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$HOME/money"
PORT="${PORT:-5173}"

mkdir -p "$APP_DIR"
tar -xzf /tmp/money-app.tar.gz -C "$APP_DIR"
cd "$APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Installing nodejs/npm with apt..."
  sudo apt-get update
  sudo apt-get install -y nodejs npm
fi

cat > "$APP_DIR/run.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-5173}" node server.js
EOF
chmod +x "$APP_DIR/run.sh"

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

sudo cp "$APP_DIR/money.service" /etc/systemd/system/money.service
sudo systemctl daemon-reload
sudo systemctl enable money.service
sudo systemctl restart money.service

echo "Deployment complete."
echo "Service status:"
systemctl --no-pager --full status money.service || true
echo "Open: http://$(hostname -I | awk '{print $1}'):$PORT"
