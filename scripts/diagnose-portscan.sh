#!/bin/bash
# Diagnostic script for port scan detection issues

echo "🔍 Port Scan Detection Diagnostic"
echo "=================================="
echo ""

# Check if bridge is running
echo "1. Checking if bridge is running..."
BRIDGE_PID=$(pgrep -f "lan-bridge.mjs")
if [ -z "$BRIDGE_PID" ]; then
    echo "   ❌ Bridge is NOT running"
    echo "   → Start it with: npm run river:bridge -- --iface <interface>"
    exit 1
else
    echo "   ✅ Bridge is running (PID: $BRIDGE_PID)"

    # Check which interface
    IFACE=$(ps aux | grep lan-bridge.mjs | grep -o '\-i [^ ]*' | awk '{print $2}')
    if [ -z "$IFACE" ]; then
        echo "   ⚠️  No interface specified - might not capture traffic"
    else
        echo "   📡 Capturing on interface: $IFACE"
    fi
fi
echo ""

# Check if tshark is running
echo "2. Checking if tshark is running..."
TSHARK_PID=$(pgrep -f "tshark.*-T ek")
if [ -z "$TSHARK_PID" ]; then
    echo "   ❌ tshark is NOT running"
else
    echo "   ✅ tshark is running (PID: $TSHARK_PID)"
fi
echo ""

# Check network interfaces
echo "3. Available network interfaces:"
ifconfig | grep "^[a-z]" | cut -d: -f1 | while read iface; do
    IP=$(ifconfig "$iface" | grep "inet " | awk '{print $2}' | head -1)
    if [ ! -z "$IP" ]; then
        echo "   - $iface: $IP"
    fi
done
echo ""

# Get default gateway
echo "4. Default gateway (good target for testing):"
GATEWAY=$(route -n get default 2>/dev/null | grep gateway | awk '{print $2}')
if [ ! -z "$GATEWAY" ]; then
    echo "   🎯 $GATEWAY"
    echo "   → Use this IP for nmap: nmap -F $GATEWAY"
else
    echo "   ⚠️  Could not determine gateway"
fi
echo ""

# Check if frontend is running
echo "5. Checking if frontend is running..."
NEXT_PID=$(pgrep -f "next dev")
if [ -z "$NEXT_PID" ]; then
    echo "   ❌ Next.js dev server is NOT running"
    echo "   → Start it with: npm run dev"
else
    echo "   ✅ Next.js dev server is running (PID: $NEXT_PID)"
fi
echo ""

# Check WebSocket connectivity
echo "6. Testing WebSocket connectivity..."
if command -v wscat >/dev/null 2>&1; then
    timeout 2 wscat -c ws://localhost:8787 -x '{"type":"test"}' 2>&1 | grep -q "connected" && echo "   ✅ WebSocket is accessible" || echo "   ❌ WebSocket connection failed"
else
    echo "   ⚠️  wscat not installed (optional, skipping test)"
fi
echo ""

echo "=================================="
echo "📋 Recommended Testing Procedure:"
echo "=================================="
echo ""
echo "A. Test visualization manually (verify it works):"
echo "   1. Open http://localhost:3000"
echo "   2. Open browser console (F12)"
echo "   3. Run: window.pushRiverEvent({ type: 'portscan', strength: 1.8 })"
echo "   4. You should see a RED DIAMOND appear"
echo ""
echo "B. Test with actual nmap scan:"
if [ ! -z "$GATEWAY" ]; then
    echo "   1. Scan your gateway (NOT localhost):"
    echo "      nmap -F $GATEWAY"
else
    echo "   1. Find your gateway IP and scan it:"
    echo "      nmap -F <gateway-ip>"
fi
echo ""
echo "   2. Watch the bridge terminal for debug output like:"
echo "      [SYN] 192.168.x.x:80 -> 1 unique ports tracked"
echo "      [SYN] 192.168.x.x:443 -> 2 unique ports tracked"
echo "      ..."
echo "      🚨 PORT SCAN DETECTED from 192.168.x.x (8 ports)"
echo ""
echo "C. Why scanning localhost (127.0.0.1) doesn't work:"
echo "   - Localhost traffic uses the loopback interface (lo0)"
echo "   - Your bridge is capturing on a physical interface ($IFACE)"
echo "   - These packets never appear on the physical interface"
echo "   - Solution: Scan a REAL network IP (gateway, router, etc.)"
echo ""
echo "D. If still not working:"
echo "   1. Check bridge output for [SYN] messages"
echo "   2. If no [SYN] messages: wrong interface or no traffic"
echo "   3. If [SYN] messages but no detection: threshold not reached"
echo "   4. Use: sudo python3 scripts/simulate-portscan.py <real-ip>"
echo ""
