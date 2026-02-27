#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed. Install Node.js 20+ and retry."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed. Install npm and retry."
  exit 1
fi

if ! command -v tshark >/dev/null 2>&1; then
  echo "Warning: tshark not found on PATH."
  echo "Install Wireshark/tshark before running the bridge."
fi

echo "Installing npm dependencies..."
npm install

echo
echo "Setup complete. Next steps:"
echo "  1) npm run river:interfaces"
echo "  2) npm run river:bridge -- --iface <interface>"
echo "  3) npm run dev"
