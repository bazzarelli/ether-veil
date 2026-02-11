#!/usr/bin/env node
/**
 * Simple WebSocket client to inject TCP byte data for testing the vapor wave.
 * Usage: node scripts/test-tcp-vapor.mjs [rate-in-mbps]
 *
 * Examples:
 *   node scripts/test-tcp-vapor.mjs 1     # Simulate 1 MB/s (light browsing)
 *   node scripts/test-tcp-vapor.mjs 5     # Simulate 5 MB/s (1080p streaming)
 *   node scripts/test-tcp-vapor.mjs 20    # Simulate 20 MB/s (4K streaming)
 *   node scripts/test-tcp-vapor.mjs 70    # Simulate 70 MB/s (max intensity)
 */

import { WebSocket } from "ws";

const rateMbps = Number(process.argv[2] ?? 5);
const wsUrl = process.env.NEXT_PUBLIC_RIVER_WS_URL ?? "ws://localhost:8787";
const flushMs = 200; // Match RIVER_TCP_FLUSH_MS from bridge

const bytesPerFlush = (rateMbps * 1_000_000 * flushMs) / 1000;

console.log(`\n🌊 TCP Vapor Wave Test`);
console.log(`   Target rate: ${rateMbps} MB/s`);
console.log(`   Bytes per ${flushMs}ms: ${bytesPerFlush.toLocaleString()}`);
console.log(`   Connecting to: ${wsUrl}\n`);

const ws = new WebSocket(wsUrl);

ws.on("open", () => {
  console.log("✓ Connected to bridge");
  console.log("✓ Injecting TCP byte data...\n");
  console.log("   Open http://localhost:3000 to see the vapor wave");
  console.log("   Press Ctrl+C to stop\n");

  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ tcpBytes: Math.floor(bytesPerFlush) }));

      // Log every 2 seconds
      if (Date.now() % 2000 < flushMs) {
        const intensity = Math.log1p(rateMbps * 1_000_000) / Math.log1p(70_000_000);
        console.log(
          `📊 Sending ${rateMbps} MB/s → Intensity: ${(intensity * 100).toFixed(1)}%`
        );
      }
    }
  }, flushMs);
});

ws.on("error", (err) => {
  console.error("❌ WebSocket error:", err.message);
  console.error("\n   Make sure the bridge is running:");
  console.error("   npm run river:bridge -- --iface en0\n");
  process.exit(1);
});

ws.on("close", () => {
  console.log("\n✓ Connection closed");
  process.exit(0);
});
