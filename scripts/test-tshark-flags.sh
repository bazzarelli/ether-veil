#!/bin/bash
# Test if tshark can capture TCP flags

echo "Testing tshark TCP flag extraction..."
echo "This will capture 5 packets and show the raw JSON output"
echo "Press Ctrl+C after a few seconds or visit a website to generate traffic"
echo ""

TSHARK_PATH="/Applications/Wireshark.app/Contents/MacOS/tshark"

$TSHARK_PATH -l -n -T ek \
  -e frame.protocols \
  -e ip.src \
  -e tcp.port \
  -e tcp.flags.syn \
  -e tcp.flags.ack \
  -e tcp.flags \
  -i en1 \
  -c 5 \
  tcp

echo ""
echo "Done. Check if tcp.flags.syn and tcp.flags.ack appear in the output."
