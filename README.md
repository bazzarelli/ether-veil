## Getting Started (macOS, from scratch)

### 1) Install system prerequisites

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

Install Homebrew (if needed): [brew.sh](https://brew.sh)

Install `nvm` and Node.js 20 LTS:

```bash
brew install nvm
mkdir -p ~/.nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$(brew --prefix nvm)/nvm.sh" ] && . "$(brew --prefix nvm)/nvm.sh"
nvm install 20
nvm use 20
```

Verify:

```bash
node -v
npm -v
```

### 2) Clone and install project dependencies

```bash
git clone <your-repo-url>
cd shark-cosmic-river
npm install
```

### 3) Install Wireshark / tshark

Install Wireshark from [wireshark.org](https://www.wireshark.org/download.html) and ensure `tshark` is available.

This project defaults to:

`/Applications/Wireshark.app/Contents/MacOS/tshark`

If your `tshark` is elsewhere, set:

```bash
export TSHARK_PATH="/path/to/tshark"
```

### 4) Ensure capture permissions on macOS

Packet capture may fail without BPF permissions. In Wireshark installation, enable non-root packet capture support (ChmodBPF) when prompted.

If you skipped it and see permission errors, reinstall/repair Wireshark capture permissions, or run the bridge with `sudo` as a fallback.

### 5) Start the app

Terminal 1: list interfaces and start the packet bridge.

```bash
npm run river:interfaces
npm run river:bridge -- --iface en0
```

Use the interface that matches your connection (`en0`, `en1`, etc.).

Terminal 2: start the Next.js app.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The frontend connects to `ws://localhost:8787` by default.

### Optional environment overrides

```bash
export RIVER_WS_PORT=8787
export NEXT_PUBLIC_RIVER_WS_URL="ws://localhost:8787"
export RIVER_RATE_MS=80
export RIVER_TCP_FLUSH_MS=200
```

## Troubleshooting

### No packets showing in the visualization

1. Confirm the bridge is running and prints:
`River bridge listening on ws://localhost:8787`
2. Confirm your interface is active:

```bash
npm run river:interfaces
```

3. Try a different interface (`en0`, `en1`, etc.):

```bash
npm run river:bridge -- --iface en1
```

4. Generate test traffic in another terminal:

```bash
ping -c 5 1.1.1.1
```

### Permission denied / cannot capture packets

If `tshark` reports permission issues on macOS:

1. Re-run Wireshark installer and enable ChmodBPF (non-root capture).
2. Retry bridge startup.
3. If still blocked, run with `sudo`:

```bash
sudo npm run river:bridge -- --iface en0
```

### `tshark` not found or wrong path

Check default path exists:

```bash
ls -l /Applications/Wireshark.app/Contents/MacOS/tshark
```

If missing, set `TSHARK_PATH`:

```bash
export TSHARK_PATH="/your/actual/path/to/tshark"
npm run river:interfaces
```

### Frontend cannot connect to the bridge

1. Ensure the bridge and frontend are using the same WebSocket port.
2. If you changed bridge port, also set frontend URL:

```bash
export RIVER_WS_PORT=8788
export NEXT_PUBLIC_RIVER_WS_URL="ws://localhost:8788"
```

3. Restart both terminals after changing env vars.
