# Ether Veil (Wireshark visualization)

![screen-shot](https://github.com/user-attachments/assets/dec504c0-20f1-4e2f-96fb-b9adcdab5c69)

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

Then start classroom sharing with one command:

```bash
npm run river:interfaces
npm run dev:lan -- --iface <your-interface>
```

The launcher will:

- detect the current LAN IPv4 address
- set `NEXT_PUBLIC_RIVER_WS_URL` automatically unless you already provided one
- start the WebSocket bridge on `0.0.0.0:8787`
- start Next.js on `0.0.0.0:3000`
- print the classroom URL to share

Open the printed LAN URL from your machine or another device on the same network.

If you only want the frontend locally, `npm run dev` still works.

## Run Modes

Choose one of these modes depending on what you are trying to do.

### Mode 1: Ambient Classroom Mode

Use this for the normal art-forward classroom display.

Step by step:

1. List interfaces:

```bash
npm run river:interfaces
```

2. Pick the interface that actually carries the traffic you want to observe, such as `en1` for Wi-Fi or `en0` for Ethernet.

3. Start the app:

```bash
npm run dev:lan -- --iface <your-interface>
```

4. Open the printed URL from your own machine or share it with classmates on the same LAN.

What this does:

- uses the default bridge throttle of `80ms`
- keeps glyph density calmer and more ambient
- leaves the activity meter enabled

### Mode 2: Live Fidelity Mode

Use this when you want floods, bursts, and rapid traffic changes to read more literally on screen.

Step by step:

1. List interfaces:

```bash
npm run river:interfaces
```

2. Start the app with live fidelity enabled:

```bash
NEXT_PUBLIC_LIVE_FIDELITY_MODE=true \
npm run dev:lan -- --iface <your-interface>
```

3. If you want the bridge to send events as fast as possible, lower the bridge throttle even more:

```bash
NEXT_PUBLIC_LIVE_FIDELITY_MODE=true \
RIVER_RATE_MS=0 \
npm run dev:lan -- --iface <your-interface>
```

What this does:

- lowers the bridge throttle to `8ms` unless you override `RIVER_RATE_MS`
- raises the visible symbol cap
- makes glyphs smaller, faster, and shorter-lived so bursts look more like bursts

### Mode 3: High-Traffic Mirror-Port Mode

Use this for SPAN / port-mirror capture or any dense network segment where `tshark` CPU usage matters.

Step by step:

1. List interfaces:

```bash
npm run river:interfaces
```

2. Choose the NIC connected to the mirrored traffic.

3. Start the app in high-traffic capture mode:

```bash
RIVER_HIGH_TRAFFIC_MODE=true \
RIVER_SNAPLEN=128 \
RIVER_CAPTURE_FILTER="tcp or udp or arp or icmp" \
npm run dev:lan -- --iface <your-interface>
```

4. Keep promiscuous mode on unless you intentionally want it off. If you really need to disable it:

```bash
RIVER_HIGH_TRAFFIC_MODE=true \
RIVER_PROMISCUOUS=false \
npm run dev:lan -- --iface <your-interface>
```

What this does:

- reduces capture overhead by limiting snap length
- optionally drops unwanted traffic before tshark parses it
- does not change frontend visuals by itself

### Mode 4: Local Demo / Meter Testing Mode

Use this when you want to prove the activity meter works before you have real mirrored traffic.

Step by step:

1. On the capture host, start Ether Veil:

```bash
npm run dev:lan -- --iface <your-interface>
```

2. From a second machine on the same LAN, generate traffic against the capture host:

```bash
python3 scripts/simulate-traffic.py <capture-host-ip> --mode mixed --duration 20
```

3. For a cleaner meter-only test, use UDP:

```bash
python3 scripts/simulate-traffic.py <capture-host-ip> --mode udp --duration 20
```

4. For real requests into the dev server, use TCP:

```bash
python3 scripts/simulate-traffic.py <capture-host-ip> --mode tcp --duration 20
```

Notes:

- running the simulator from another device is the most realistic test
- if you run it on the same machine, traffic to your own LAN IP may not traverse the physical NIC
- in that case, either capture on `lo0` for local-only testing or use a second device

## How Runtime Configuration Works

Ether Veil has two moving parts:

- a Next.js frontend that renders the visualization in the browser
- a Node.js bridge that runs `tshark`, classifies packets, and streams events over WebSocket

When you run `npm run dev:lan`, the launcher in [scripts/dev-lan.mjs](/Volumes/1TB-SSD/Dev/ether-veil/scripts/dev-lan.mjs) does three things:

1. detects your current LAN IP
2. computes `NEXT_PUBLIC_RIVER_WS_URL` if you did not set one yourself
3. starts both the bridge and the Next.js dev server with the same environment

That means a single env var can affect:

- the browser bundle if it starts with `NEXT_PUBLIC_`
- the Node launcher / bridge if it starts with `RIVER_` or `TSHARK_`

### Where Defaults Live

There is no committed `.env` file in this repo by default.

Instead, most values use code defaults such as:

- `RIVER_RATE_MS` defaults to `80`
- `RIVER_WS_PORT` defaults to `8787`
- `RIVER_TRAFFIC_FLUSH_MS` defaults to `200`
- `NEXT_PUBLIC_ENABLE_ACTIVITY_METER` is on unless set to `"false"`
- `NEXT_PUBLIC_LIVE_FIDELITY_MODE` is off unless set to `"true"`

You can see the current supported variables in [.env.example](./.env.example).

### Recommended Local Setup

If you want persistent local settings, create a `.env.local` file in the repo root
and copy in the values you care about from `.env.example`.

Example:

```bash
cp .env.example .env.local
```

Then uncomment and edit the lines you want.

You can also set variables inline for one run only:

```bash
NEXT_PUBLIC_LIVE_FIDELITY_MODE=true \
RIVER_RATE_MS=0 \
npm run dev:lan -- --iface <your-interface>
```

### Client vs Bridge Variables

Use `NEXT_PUBLIC_*` for browser-visible behavior:

- `NEXT_PUBLIC_RIVER_WS_URL` - browser WebSocket endpoint
- `NEXT_PUBLIC_ENABLE_ACTIVITY_METER` - show/hide the density meter
- `NEXT_PUBLIC_LIVE_FIDELITY_MODE` - denser, more literal glyph rendering

Use `RIVER_*` or `TSHARK_*` for packet capture and bridge behavior:

- `TSHARK_PATH` - tshark binary path
- `RIVER_RATE_MS` - per-event glyph throttle
- `RIVER_TRAFFIC_FLUSH_MS` - byte aggregation flush interval
- `RIVER_HIGH_TRAFFIC_MODE` - mirrored-network CPU-friendly capture mode
- `RIVER_SNAPLEN` - snap length for header-only capture
- `RIVER_CAPTURE_FILTER` - BPF capture filter
- `RIVER_PROMISCUOUS` - promiscuous mode on/off
- `RIVER_WS_HOST` and `RIVER_WS_PORT` - bridge bind host/port

### Important Note About Next.js

`NEXT_PUBLIC_*` variables are read at app startup and embedded into the client bundle.
If you change one of them, restart the dev server so the browser receives the new value.

## Advanced Reference

Use the **Run Modes** section above for normal operation. This section is the shorter
reference for what the main knobs do.

### Live Fidelity

- `NEXT_PUBLIC_LIVE_FIDELITY_MODE=true` enables denser, more literal glyph behavior
- `RIVER_RATE_MS` controls bridge-side event throttling
- `RIVER_RATE_MS=0` is the most literal but also the noisiest setting

### High-Traffic Capture

- `RIVER_HIGH_TRAFFIC_MODE=true` enables CPU-friendlier mirrored-port capture defaults
- `RIVER_SNAPLEN=128` keeps capture to headers plus a small prefix
- `RIVER_CAPTURE_FILTER` lets you drop unwanted traffic before tshark parses it
- `RIVER_PROMISCUOUS=false` disables promiscuous mode, but for SPAN / mirror capture you usually want promiscuous mode left on

### Traffic Simulation

- `python3 scripts/simulate-traffic.py <capture-host-ip> --mode mixed --duration 20` sends mixed traffic
- `--mode udp` is a cleaner density-meter test
- `--mode tcp` hits the dev server on port `3000`
- running the simulator from a second machine is the most realistic setup
- for same-machine testing, capture on `lo0` if needed

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
- Allow inbound firewall access for TCP ports `3000` and `8787` on the host machine when sharing with classmates.

## Scripts

> > identify your appropriate interface e.g. ethernet

- `npm run river:interfaces` - list capture interfaces
  > > use that <iface> in this command
- `npm run dev:lan -- --iface <iface>` - detect LAN IP, start bridge + Next.js for classroom sharing

- `npm run dev` - start Next.js dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint codebase

- `npm run river:bridge -- --iface <iface>` - start tshark bridge
- `python3 scripts/simulate-traffic.py <capture-host-ip>` - generate test traffic for the density meter

## Security and Ethics

Run packet capture only on networks and systems where you have explicit authorization.
