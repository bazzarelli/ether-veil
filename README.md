# Ether Veil

![screen-shot](https://github.com/user-attachments/assets/07befd83-e81c-48e6-bebc-8f74b4b498dd)

Does looking at Wireshark logs repulse you? Wouldn't it be nice if you could see the log data at a glance in a beautiful visualization?

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
git clone https://github.com/bazzarelli/ether-veil.git
cd ether-veil
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

## Security and Ethics

Run packet capture only on networks and systems where you have explicit authorization.
