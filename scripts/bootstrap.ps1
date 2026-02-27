$ErrorActionPreference = "Stop"

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command node)) {
  Write-Error "Node.js is not installed. Install Node.js 20+ and retry."
}

if (-not (Test-Command npm)) {
  Write-Error "npm is not installed. Install npm and retry."
}

if (-not (Test-Command tshark)) {
  Write-Warning "tshark not found on PATH. Install Wireshark/tshark before running the bridge."
}

Write-Host "Installing npm dependencies..."
npm install

Write-Host ""
Write-Host "Setup complete. Next steps:"
Write-Host "  1) npm run river:interfaces"
Write-Host "  2) npm run river:bridge -- --iface <interface>"
Write-Host "  3) npm run dev"
