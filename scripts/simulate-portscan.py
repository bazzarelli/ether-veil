#!/usr/bin/env python3
"""
Simulate port scan traffic for testing the cosmic river port scan visualization.

This script sends TCP SYN packets to multiple ports on a target IP to trigger
the port scan detection logic in lan-bridge.mjs.

Usage:
    python3 simulate-portscan.py [target_ip] [num_ports]

Examples:
    python3 simulate-portscan.py 192.168.1.1 12       # Scan 12 ports (triggers detection at 8)
    python3 simulate-portscan.py scanme.nmap.org 20   # Scan public test server

Requirements:
    pip install scapy

Note: Requires root/sudo privileges to send raw packets.
"""

import sys
import time
from scapy.all import IP, TCP, sr1, send

def simulate_portscan(target_ip: str, num_ports: int = 12, delay_ms: float = 100):
    """
    Send SYN packets to multiple ports on target IP.

    Args:
        target_ip: Target IP address
        num_ports: Number of ports to scan (default 12, need 8+ to trigger detection)
        delay_ms: Delay between packets in milliseconds (default 100ms)
    """
    # Common ports to scan - mix of well-known services
    ports = [
        21,    # FTP
        22,    # SSH
        23,    # Telnet
        25,    # SMTP
        53,    # DNS
        80,    # HTTP
        110,   # POP3
        143,   # IMAP
        443,   # HTTPS
        445,   # SMB
        3306,  # MySQL
        3389,  # RDP
        5432,  # PostgreSQL
        8080,  # HTTP Alt
        8443,  # HTTPS Alt
    ]

    ports_to_scan = ports[:min(num_ports, len(ports))]

    print(f"🔍 Simulating port scan on {target_ip}")
    print(f"📊 Scanning {len(ports_to_scan)} ports (need 8+ within 3s to trigger detection)")
    print(f"⏱️  Delay: {delay_ms}ms between packets")
    print(f"🎯 Ports: {ports_to_scan}")
    print()

    print("Starting scan...")
    start_time = time.time()

    for i, port in enumerate(ports_to_scan, 1):
        # Create SYN packet (SYN=1, ACK=0)
        packet = IP(dst=target_ip) / TCP(dport=port, flags="S")

        print(f"  [{i}/{len(ports_to_scan)}] Sending SYN to port {port}...", end=" ")

        # Send packet (don't wait for response to be faster)
        send(packet, verbose=0)

        elapsed = time.time() - start_time
        print(f"✓ (t={elapsed:.2f}s)")

        # Small delay to avoid overwhelming the network
        if i < len(ports_to_scan):
            time.sleep(delay_ms / 1000)

    total_time = time.time() - start_time
    print()
    print(f"✅ Scan complete!")
    print(f"⏱️  Total time: {total_time:.2f}s")

    if total_time <= 3.0:
        print(f"💎 Port scan detection SHOULD trigger (completed in < 3s window)")
    else:
        print(f"⚠️  Port scan detection MAY NOT trigger (took > 3s)")
        print(f"   Try reducing the delay: python3 {sys.argv[0]} {target_ip} {num_ports} 50")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\n⚠️  No target specified. Using localhost (127.0.0.1) as default.")
        target = "127.0.0.1"
    else:
        target = sys.argv[1]

    num_ports = int(sys.argv[2]) if len(sys.argv) >= 3 else 12
    delay = float(sys.argv[3]) if len(sys.argv) >= 4 else 100

    print("\n" + "="*60)
    print("  COSMIC RIVER - Port Scan Simulator")
    print("="*60 + "\n")

    try:
        simulate_portscan(target, num_ports, delay)
    except PermissionError:
        print("\n❌ ERROR: Permission denied")
        print("   Raw packet sending requires root privileges.")
        print(f"   Run: sudo python3 {sys.argv[0]} {' '.join(sys.argv[1:])}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        sys.exit(1)

    print("\n💡 Check your visualization for red diamond shapes!")
    print("   If you don't see them, make sure:")
    print("   1. The bridge is running with the correct interface")
    print("   2. The visualization is connected to the WebSocket")
    print("   3. tshark is capturing the traffic (check terminal output)")


if __name__ == "__main__":
    main()
