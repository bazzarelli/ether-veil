#!/usr/bin/env python3
"""Generate LAN traffic to exercise Ether Veil's density meter.

Run this from a second device on the same network when possible so the
capture host sees traffic on its physical interface.
"""

from __future__ import annotations

import argparse
import random
import socket
import threading
import time
from typing import Iterable


def build_http_request(host: str, payload_size: int) -> bytes:
    padding = max(0, payload_size - 96)
    path = f"/?burst={random.randint(1000, 9999)}&pad={'x' * padding}"
    request = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        "User-Agent: ether-veil-sim/1.0\r\n"
        "Connection: close\r\n\r\n"
    )
    return request.encode("utf-8")


def udp_worker(
    stop_at: float,
    target_host: str,
    target_port: int,
    payload_size: int,
    pause_ms: int,
    stats: dict[str, int],
) -> None:
    payload = random.randbytes(payload_size)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        while time.time() < stop_at:
            sent = sock.sendto(payload, (target_host, target_port))
            stats["udp_bytes"] += sent
            stats["udp_packets"] += 1
            if pause_ms > 0:
                time.sleep(pause_ms / 1000)
    finally:
        sock.close()


def tcp_worker(
    stop_at: float,
    target_host: str,
    target_port: int,
    payload_size: int,
    pause_ms: int,
    stats: dict[str, int],
) -> None:
    while time.time() < stop_at:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1.5)
        try:
            sock.connect((target_host, target_port))
            request = build_http_request(target_host, payload_size)
            sock.sendall(request)
            stats["tcp_bytes"] += len(request)
            stats["tcp_connections"] += 1

            while sock.recv(4096):
                pass
        except OSError:
            stats["tcp_errors"] += 1
        finally:
            sock.close()

        if pause_ms > 0:
            time.sleep(pause_ms / 1000)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate mixed UDP/TCP traffic for Ether Veil.",
    )
    parser.add_argument("target_host", help="LAN IP or hostname of the capture host")
    parser.add_argument(
        "--mode",
        choices=("udp", "tcp", "mixed"),
        default="mixed",
        help="Traffic pattern to generate",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=20,
        help="Duration in seconds",
    )
    parser.add_argument(
        "--payload-size",
        type=int,
        default=1400,
        help="Approximate bytes per UDP datagram or HTTP request padding",
    )
    parser.add_argument(
        "--udp-port",
        type=int,
        default=9999,
        help="UDP destination port",
    )
    parser.add_argument(
        "--tcp-port",
        type=int,
        default=3000,
        help="TCP destination port; 3000 works well with `npm run dev:lan`",
    )
    parser.add_argument(
        "--udp-workers",
        type=int,
        default=2,
        help="Parallel UDP senders",
    )
    parser.add_argument(
        "--tcp-workers",
        type=int,
        default=2,
        help="Parallel TCP connectors",
    )
    parser.add_argument(
        "--pause-ms",
        type=int,
        default=15,
        help="Delay between sends per worker in milliseconds",
    )
    return parser.parse_args()


def launch_threads(
    threads: Iterable[threading.Thread],
) -> None:
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()


def main() -> int:
    args = parse_args()
    stop_at = time.time() + args.duration
    stats = {
        "udp_bytes": 0,
        "udp_packets": 0,
        "tcp_bytes": 0,
        "tcp_connections": 0,
        "tcp_errors": 0,
    }
    threads: list[threading.Thread] = []

    if args.mode in {"udp", "mixed"}:
        for _ in range(args.udp_workers):
            threads.append(
                threading.Thread(
                    target=udp_worker,
                    args=(
                        stop_at,
                        args.target_host,
                        args.udp_port,
                        args.payload_size,
                        args.pause_ms,
                        stats,
                    ),
                    daemon=True,
                )
            )

    if args.mode in {"tcp", "mixed"}:
        for _ in range(args.tcp_workers):
            threads.append(
                threading.Thread(
                    target=tcp_worker,
                    args=(
                        stop_at,
                        args.target_host,
                        args.tcp_port,
                        args.payload_size,
                        args.pause_ms,
                        stats,
                    ),
                    daemon=True,
                )
            )

    print(
        "Generating traffic:",
        f"mode={args.mode}",
        f"target={args.target_host}",
        f"duration={args.duration}s",
        f"payload={args.payload_size}B",
    )
    launch_threads(threads)
    total_bytes = stats["udp_bytes"] + stats["tcp_bytes"]
    print(
        "Done:",
        f"total={total_bytes / 1_000_000:.2f} MB",
        f"udp_packets={stats['udp_packets']}",
        f"tcp_connections={stats['tcp_connections']}",
        f"tcp_errors={stats['tcp_errors']}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
