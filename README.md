# Ether Veil

Real-time, art-forward network activity visualization built with Next.js and p5.js.

The app renders ambient particles, protocol symbols (TCP/UDP/DNS/Portscan/Malformed/Hierarchy), and a TCP-intensity vapor field from live packet events.

## Open Source Status

This repository is intended for classroom and community use.

- License: MIT ([LICENSE](./LICENSE))
- Contributions: see [CONTRIBUTING.md](./CONTRIBUTING.md)

## Requirements

- Node.js 20+
- npm 10+
- Git
- Wireshark/tshark

## Quick Start

Clone and install:

```bash
git clone https://github.com/<your-org-or-user>/shark-cosmic-river.git
cd shark-cosmic-river
```

### macOS / Linux

```bash
./scripts/bootstrap.sh
```

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

Then run in two terminals:

Terminal 1 (bridge):

```bash
npm run river:interfaces
npm run river:bridge -- --iface <your-interface>
```

Terminal 2 (frontend):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## LAN Classroom Setup

If students should view the same visualization from your machine:

1. Start Next on all interfaces:

```bash
npm run dev -- -H 0.0.0.0
```

2. Point frontend WebSocket to your host IP (example `192.168.1.25`):

```bash
export NEXT_PUBLIC_RIVER_WS_URL="ws://192.168.1.25:8787"
```

3. Ensure firewall allows inbound traffic on ports `3000` and `8787`.

4. Students open:

```text
http://192.168.1.25:3000
```

Note: They will see events captured from the interface running on your host. On switched networks this is usually host-local traffic unless you have mirrored/SPAN visibility.

## Environment Variables

- `NEXT_PUBLIC_RIVER_WS_URL` (default `ws://localhost:8787`)
- `RIVER_WS_PORT` (default `8787`)
- `RIVER_RATE_MS` (event throttle)
- `RIVER_TCP_FLUSH_MS` (TCP byte flush interval)
- `TSHARK_PATH` (custom path to tshark binary)

## Troubleshooting

### tshark not found

- Install Wireshark/tshark.
- If installed in a non-standard path, set `TSHARK_PATH`.

### Permission denied when capturing

- macOS: enable non-root capture support during Wireshark install (ChmodBPF).
- Linux: add user to capture group / configure dumpcap capabilities.
- Fallback: run bridge with elevated privileges if policy allows.

### Frontend cannot connect to WebSocket

- Ensure bridge is running and listening on expected port.
- Ensure `NEXT_PUBLIC_RIVER_WS_URL` matches host + port reachable by browser.
- Restart frontend after env var changes.

## Scripts

- `npm run dev` - start Next.js dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint codebase
- `npm run river:interfaces` - list capture interfaces
- `npm run river:bridge -- --iface <iface>` - start tshark bridge
- `npm run river:test` - inject TCP byte traffic for testing

## Security and Ethics

Run packet capture only on networks and systems where you have explicit authorization.
