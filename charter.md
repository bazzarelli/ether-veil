# Project Charter

## Title
**shark-cosmic-river: Live Network Traffic Visualization**

---

## Purpose Statement

The intent of this project is to build a real-time network traffic visualization system that captures live packets from the local network and renders them as a beautiful, ambient display — equal parts lava lamp and data dashboard. The system exists to make the invisible visible: translating raw network events into a living, breathing visual language that students can observe passively or analyze actively. By running this display in a classroom environment, students gain an intuitive, ongoing awareness of what network traffic actually looks like — DNS queries, TCP streams, port scans, and more — without needing to stare at raw packet captures.

---

## Goals

- Capture live network packets using Wireshark/tshark and stream them over WebSocket to a browser-based visualization
- Classify packets in real time into meaningful event types: TCP, UDP, DNS, port scans, malformed frames, and complex protocol hierarchies
- Render each event as a distinct floating symbol with unique color and shape, drifting across a full-screen WebGL canvas
- Visualize TCP throughput as an ambient "vapor wave" overlay that breathes and pulses with traffic intensity
- Detect and flag suspicious activity (e.g., port scans: 8+ SYN packets to different ports from a single source within 3 seconds)
- Provide a live event legend that counts each packet type in real time
- Allow manual event injection via browser console for classroom demos and testing without a live capture session

---

## Scope

**In scope:**
- Node.js bridge (`lan-bridge.mjs`) that spawns tshark, parses packet metadata, classifies events, and broadcasts via WebSocket
- Next.js/React frontend with a full-screen WebGL canvas, particle system, and symbol/vapor-wave rendering
- Six event type classifications with distinct visual encodings
- TCP throughput tracking with logarithmic intensity scaling (reference: 70 MB/s = full saturation)
- Port scan detection engine with a per-source SYN tracking window
- Event rate limiting to prevent visual overload (default: 80ms throttle per event type)
- Browser console debug API for classroom demonstrations

**Out of scope:**
- Persistent logging or storage of captured packets
- Authentication or access control on the WebSocket server
- WebSocket auto-reconnect (page refresh required if bridge restarts)
- Deep packet inspection beyond protocol classification and frame length
- Mobile device support

---

## Stakeholders

| Role | Who |
|---|---|
| Developer / Instructor | Project author — builds, maintains, and demonstrates the system |
| Primary Audience | Classroom students — observe the display to build intuition about live network behavior |
| Secondary Audience | Lab guests / visitors — passive observers of the ambient display |
| Network Infrastructure | Campus/lab network — the data source; tshark must have capture permissions on the chosen interface |

---

## Success Criteria

- The display connects to a live network interface and renders packet events within a perceptible delay (< 1 second)
- All six event types are visually distinguishable on the canvas without explanation
- A port scan event is correctly detected and rendered in red as a diamond symbol
- TCP throughput changes (e.g., a large file transfer) produce a visible, proportional change in the vapor wave intensity
- A student with no prior networking background can watch the display for 60 seconds and correctly identify that different shapes represent different kinds of traffic
- An instructor can point at the screen during class and narrate what is happening on the network in real time
- The visualization remains stable and performant during normal classroom network activity (max 24 symbols, 8 pulses, 120 particles on screen at once)
