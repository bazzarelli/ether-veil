#!/usr/bin/env python3
"""
TCP Vapor Wave Simulator
Sends tcpBytes messages to the River WebSocket bridge to test the vapor visualization.

Usage:
  python3 simulate_tcp.py                  # interactive menu
  python3 simulate_tcp.py --scenario iso   # 5.7GB ISO download (~50 MB/s)
  python3 simulate_tcp.py --scenario audio # streaming audio (~320 kbps)
  python3 simulate_tcp.py --scenario 4k    # 4K video stream (~25 MB/s)
  python3 simulate_tcp.py --scenario ramp  # ramps from 0 to max and back

  WS_URL=ws://localhost:9000 python3 simulate_tcp.py  # custom port
"""

import asyncio
import json
import os
import sys
import time
import argparse

try:
    import websockets
except ImportError:
    print("Missing dependency: pip3 install websockets")
    sys.exit(1)

WS_URL = os.environ.get("WS_URL", "ws://localhost:8787")

# ── Scenario definitions ──────────────────────────────────────────────────────
# bytes_per_sec, label, description
SCENARIOS = {
    "iso": (
        52_000_000,
        "5.7 GB ISO download",
        "~52 MB/s  — should push vapor to near-maximum",
    ),
    "audio": (
        40_000,
        "Audio stream (320 kbps)",
        "~40 KB/s  — faint wisp, barely visible",
    ),
    "spotify": (
        160_000,
        "Spotify HiFi (1411 kbps)",
        "~160 KB/s — thin persistent tendril",
    ),
    "1080": (
        5_000_000,
        "1080p video stream",
        "~5 MB/s   — moderate rolling cloud",
    ),
    "4k": (
        25_000_000,
        "4K video stream",
        "~25 MB/s  — large billowing mass",
    ),
    "ramp": (
        None,
        "Ramp up then down",
        "0 → 70 MB/s → 0 over 30s — full intensity sweep",
    ),
    "idle": (
        0,
        "Idle / no TCP",
        "0 bytes   — vapor should fade to nothing",
    ),
}

FLUSH_INTERVAL = 0.2   # match RIVER_TCP_FLUSH_MS default (200ms)
CHUNK_INTERVAL = 0.01  # how often we generate fake packets (10ms)


async def stream_bytes(ws, bytes_per_sec: float, duration: float, label: str):
    """Send tcpBytes messages simulating a constant throughput."""
    bytes_per_chunk = bytes_per_sec * CHUNK_INTERVAL
    end_time = time.monotonic() + duration
    accumulator = 0.0
    last_flush = time.monotonic()
    sent_total = 0

    print(f"  Streaming: {label}")
    print(f"  Target:    {bytes_per_sec / 1_000_000:.2f} MB/s")
    print(f"  Duration:  {duration:.0f}s  (Ctrl-C to stop early)\n")

    try:
        while time.monotonic() < end_time:
            accumulator += bytes_per_chunk
            now = time.monotonic()

            if now - last_flush >= FLUSH_INTERVAL:
                batch = int(accumulator)
                if batch > 0:
                    msg = json.dumps({"tcpBytes": batch})
                    await ws.send(msg)
                    sent_total += batch
                    mb_sent = sent_total / 1_000_000
                    elapsed = now - (end_time - duration)
                    print(
                        f"\r  Sent: {mb_sent:8.1f} MB  |  "
                        f"Rate: {batch / FLUSH_INTERVAL / 1_000_000:5.1f} MB/s  |  "
                        f"Elapsed: {elapsed:5.1f}s     ",
                        end="",
                        flush=True,
                    )
                    accumulator -= batch
                last_flush = now

            await asyncio.sleep(CHUNK_INTERVAL)
    except asyncio.CancelledError:
        pass

    print(f"\n  Done. Total sent: {sent_total / 1_000_000:.1f} MB\n")


async def stream_ramp(ws, duration: float = 30.0):
    """Ramp throughput from 0 to 70 MB/s and back down."""
    max_bps = 70_000_000
    start = time.monotonic()
    end = start + duration
    accumulator = 0.0
    last_flush = time.monotonic()

    print(f"  Ramping 0 → 70 MB/s → 0 over {duration:.0f}s")
    print(f"  Watch the vapor expand then contract.\n")

    try:
        while time.monotonic() < end:
            now = time.monotonic()
            elapsed = now - start
            # Triangle wave: up for first half, down for second
            progress = elapsed / duration
            intensity = 1.0 - abs(2.0 * progress - 1.0)
            current_bps = max_bps * intensity

            accumulator += current_bps * CHUNK_INTERVAL

            if now - last_flush >= FLUSH_INTERVAL:
                batch = int(accumulator)
                if batch > 0:
                    await ws.send(json.dumps({"tcpBytes": batch}))
                    print(
                        f"\r  Rate: {current_bps / 1_000_000:5.1f} MB/s  |  "
                        f"Intensity: {'█' * int(intensity * 30):<30}  {intensity * 100:3.0f}%  ",
                        end="",
                        flush=True,
                    )
                    accumulator -= batch
                last_flush = now

            await asyncio.sleep(CHUNK_INTERVAL)
    except asyncio.CancelledError:
        pass

    print("\n  Ramp complete.\n")


async def run_scenario(scenario_key: str):
    print(f"\nConnecting to {WS_URL} …")
    try:
        async with websockets.connect(WS_URL) as ws:
            print(f"Connected.\n")

            if scenario_key == "ramp":
                await stream_ramp(ws, duration=30.0)
            elif scenario_key == "idle":
                print("  Sending nothing for 10s — vapor should decay to zero.\n")
                await asyncio.sleep(10)
                print("  Done.\n")
            else:
                bps, label, _ = SCENARIOS[scenario_key]
                await stream_bytes(ws, bps, duration=20.0, label=label)

    except OSError as e:
        print(f"\nCould not connect to {WS_URL}")
        print(f"  → Make sure the bridge is running:  npm run river:bridge -- --iface en0")
        print(f"  Error: {e}\n")
        sys.exit(1)


def print_menu():
    print("\n┌─ TCP Vapor Wave Simulator ──────────────────────────────────────┐")
    print(f"│  WebSocket: {WS_URL:<53}│")
    print("├─────────────────────────────────────────────────────────────────┤")
    for i, (key, (bps, label, desc)) in enumerate(SCENARIOS.items(), 1):
        bps_str = f"{bps / 1_000_000:.1f} MB/s" if bps else "ramp  " if bps is None else "0     "
        print(f"│  {i}.  {label:<30}  {bps_str}  │")
    print("└─────────────────────────────────────────────────────────────────┘")
    print()


async def interactive():
    keys = list(SCENARIOS.keys())
    print_menu()
    while True:
        try:
            choice = input("Pick a scenario (1-7) or q to quit: ").strip().lower()
            if choice in ("q", "quit", "exit"):
                break
            try:
                idx = int(choice) - 1
                if 0 <= idx < len(keys):
                    await run_scenario(keys[idx])
                    print_menu()
                else:
                    print(f"  Enter a number between 1 and {len(keys)}")
            except ValueError:
                if choice in keys:
                    await run_scenario(choice)
                else:
                    print("  Invalid choice.")
        except (KeyboardInterrupt, EOFError):
            print("\nBye.")
            break


def main():
    parser = argparse.ArgumentParser(description="TCP Vapor Wave Simulator")
    parser.add_argument(
        "--scenario", "-s",
        choices=list(SCENARIOS.keys()),
        help="Run a scenario directly without the menu",
    )
    parsed = parser.parse_args()

    if parsed.scenario:
        _, label, desc = SCENARIOS[parsed.scenario]
        print(f"\n{label} — {desc}")
        asyncio.run(run_scenario(parsed.scenario))
    else:
        asyncio.run(interactive())


if __name__ == "__main__":
    main()