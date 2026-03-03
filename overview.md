## Project Overview

**shark-cosmic-river** is a real-time network traffic visualization application that captures packets via Wireshark/tshark and renders them as an interactive "cosmic river" visualization using WebGL shaders and p5.js.

The application consists of two main components:

1. **Next.js frontend** - Real-time WebGL visualization with floating packet symbols
2. **Node.js bridge** - WebSocket server that spawns tshark and streams parsed packet events

## Build & Development Commands

```bash
# Development server (Next.js)
npm run dev                          # Start at http://localhost:3000

# Production
npm run build                        # Build optimized production bundle
npm start                            # Serve production build

# Linting
npm run lint                         # Run ESLint

# Network capture bridge
npm run river:bridge                 # Start tshark WebSocket bridge (requires --iface)
npm run river:interfaces             # List available network interfaces for capture
```

### Typical Development Workflow

1. List network interfaces: `npm run river:interfaces`
2. Start the tshark bridge with chosen interface:
   ```bash
   npm run river:bridge -- --iface en0
   ```
3. In a separate terminal, start the Next.js dev server:
   ```bash
   npm run dev
   ```
4. Open browser to http://localhost:3000

The frontend will connect to the WebSocket server at `ws://localhost:8787` and begin visualizing captured packets.

## Architecture

### Frontend (`app/`)

- **CosmicRiver.tsx** - Main visualization component. Contains:
  - p5.js sketch setup with WebGL canvas
  - Custom GLSL shaders for the "river" effect (currently toggled off via `SHOW_RIVER` flag)
  - Particle system for background ambience
  - Symbol rendering system for packet events (6 event types with distinct shapes/colors)
  - TCP vapor wave overlay using Canvas 2D API with fBm noise
  - WebSocket client consuming events from the bridge
  - Two global window APIs:
    - `window.pushRiverEvent(event)` - Manually inject packet events (for testing)
    - `window.pushTcpBytes(bytes)` - Manually inject TCP throughput data
    - `window.riverDebug()` - Log current TCP intensity metrics to console

- **EventLegend.tsx** - Live counter component reading from `window.riverCounts` (updated by CosmicRiver)

- **page.tsx** - Main layout with header text and legend overlay

### Backend Bridge (`scripts/lan-bridge.mjs`)

Node.js WebSocket server that:

1. Spawns `tshark` as a subprocess with JSON output (`-T ek`)
2. Parses packet metadata (protocols, ports, flags, frame length)
3. Classifies packets into event types (tcp, udp, dns, portscan, malformed, hierarchy)
4. Implements rate limiting per event type (default 80ms throttle)
5. Tracks TCP throughput separately (flushes accumulated bytes every 200ms)
6. Detects port scans by tracking SYN packets per source IP (8+ unique ports in 3s window)
7. Broadcasts events as JSON to all connected WebSocket clients

**Key environment variables:**

- `TSHARK_PATH` - Path to tshark binary (default: macOS Wireshark.app bundle path)
- `RIVER_WS_PORT` - WebSocket listen port (default: 8787)
- `RIVER_RATE_MS` - Per-event-type rate limit in milliseconds (default: 80)
- `RIVER_TCP_FLUSH_MS` - TCP byte accumulator flush interval (default: 200)

**Frontend environment variables:**

- `NEXT_PUBLIC_RIVER_WS_URL` - WebSocket server URL (default: `ws://localhost:8787`)

### Event Type Classification

The bridge classifies packets into these types (symbol rendering in CosmicRiver.tsx):

| Type        | Visual          | Trigger                                                  | Color                |
| ----------- | --------------- | -------------------------------------------------------- | -------------------- |
| `dns`       | Filled triangle | DNS query present                                        | Pink (255,120,200)   |
| `tcp`       | Filled circle   | TCP port detected                                        | Cyan (120,220,255)   |
| `udp`       | Hollow circle   | UDP port detected                                        | Blue (120,180,255)   |
| `portscan`  | Diamond         | 8+ SYN packets to different ports from same source in 3s | Red (255,90,80)      |
| `malformed` | 8-pointed star  | Malformed protocol flag in frame                         | Yellow (255,190,100) |
| `hierarchy` | Chevron         | 5+ protocol layers, TLS, ARP, or ICMPv6                  | Purple (190,140,255) |

### TCP Throughput Visualization

The TCP vapor wave effect intensity is driven by a 3-second rolling window of TCP byte counts:

- **Scale reference**: 70 MB/s → intensity 1.0 (full saturation)
- Intensity uses logarithmic scaling: `log(1 + bps) / log(1 + 70_000_000)`
- The bridge accumulates frame lengths (`frame.len`) for any packet with a TCP port
- Byte counts are flushed to clients separately from visual packet events to maintain accurate throughput data even when event rate limiting is active

### Shaders & Visual Effects

- **River shader** (GLSL): Multi-layer flowing rivers with breathing animation and pulse effects. Currently disabled via `SHOW_RIVER = false` in CosmicRiver.tsx.
- **TCP Vapor Wave**: Canvas 2D overlay using 4-octave fBm noise to create organic drifting smoke/fog. Intensity, opacity, and turbulence scale with TCP throughput.
- **Particles**: 120 drifting points with noise-based wobble, creating ambient depth.
- **Symbols**: Each packet event spawns a symbol that drifts horizontally, fades in/out over 20s lifespan, and rotates/pulses based on event type and strength.

## Testing & Debugging

**Manual event injection** (useful when bridge is not running or for testing specific scenarios):

Open browser console:

```javascript
// Inject a DNS event
window.pushRiverEvent({ type: "dns", strength: 1.5 });

// Inject TCP throughput (5 MB)
window.pushTcpBytes(5_000_000);

// Check current TCP metrics
window.riverDebug();
```

**Python test scripts** (`scripts/`):

- `udp_burst.py` - Generates UDP traffic for testing
- `simulate-tcp.py` - (Present but not analyzed) Likely generates TCP traffic

## Key Implementation Details

- **Symbol lifecycle**: Symbols fade in over 2.4s, fade out starting at 20s, and are pruned after 20s total age. Max 24 symbols on screen.
- **Pulse lifecycle**: Pulses (shader-based ripples) last 10s and are limited to 8 concurrent (MAX_PULSES).
- **Idle behavior**: Activity level decays after 10s of no events, reaching 50% at 18s idle.
- **Port scan detection**: Tracks SYN packets (flag combinations: SYN=1, ACK=0) per source IP. If 8+ unique destination ports seen within 3s window, classifies as portscan.
- **Frame protocols**: tshark's `frame.protocols` field is a colon-separated list (e.g., `eth:ethertype:ip:tcp:tls`). Deep stacks (≥5 layers) trigger hierarchy classification.

## Modifying Visualization Behavior

- To **enable the river shader background**: Set `SHOW_RIVER = true` in CosmicRiver.tsx:42
- To **adjust event rate limiting**: Set `RIVER_RATE_MS` environment variable when starting the bridge
- To **change TCP vapor intensity scaling**: Modify `TCP_SCALE_BPS` constant in CosmicRiver.tsx:152
- To **add new event types**:
  1. Add to `EVENT_TYPES` map in CosmicRiver.tsx:33
  2. Add classification logic in lan-bridge.mjs (around line 162)
  3. Add symbol rendering case in CosmicRiver.tsx draw() switch statement (around line 450)
  4. Add legend entry in EventLegend.tsx

## Common Patterns

- **Client-side state**: The frontend uses no React state for packet data. All event data flows through `window` globals (`riverCounts`, `__tcpIntensity`) which are polled by React components via `useEffect` + `setTimeout` loops.
- **WebSocket reconnection**: Not currently implemented. If the bridge restarts, the page must be refreshed.
- **Type casting window globals**: TypeScript window extensions are done inline with intersection types: `(window as Window & { customProp?: Type }).customProp = value`
