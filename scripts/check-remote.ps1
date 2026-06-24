$ErrorActionPreference = "Stop"

$Server = "43.134.7.187"
$User = "ubuntu"
$Remote = "$User@$Server"

ssh $Remote @'
echo "===== node ====="
command -v node || true
node -v || true
echo "===== service ====="
systemctl --no-pager --full status money.service || true
echo "===== journal ====="
journalctl -u money.service -n 120 --no-pager || true
echo "===== ports ====="
ss -ltnp | grep 5173 || true
echo "===== local health ====="
curl -i --max-time 5 http://127.0.0.1:5173/api/health || true
'@
