$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Server = "43.134.7.187"
$User = "ubuntu"
$Remote = "$User@$Server"
$Package = Join-Path $ProjectRoot "money-app.tar.gz"

Set-Location $ProjectRoot

if (Test-Path $Package) {
  Remove-Item $Package -Force
}

tar `
  --exclude=".git" `
  --exclude=".agents" `
  --exclude=".codex" `
  --exclude=".env" `
  --exclude="*.log" `
  --exclude="test-pixel.png" `
  --exclude="money-app.tar.gz" `
  -czf $Package `
  index.html app.js styles.css server.js dev-server.js data scripts .env.example .gitignore

Write-Host "Uploading package to $Remote ..."
scp $Package "${Remote}:/tmp/money-app.tar.gz"

Write-Host "Uploading deploy script ..."
scp (Join-Path $ProjectRoot "scripts\deploy-server.sh") "${Remote}:/tmp/deploy-money.sh"

Write-Host "Running remote deploy script ..."
ssh $Remote "chmod +x /tmp/deploy-money.sh && bash /tmp/deploy-money.sh"

Write-Host ""
Write-Host "Done. Try opening: http://$Server:5173"
