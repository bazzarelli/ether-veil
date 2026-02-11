#!/usr/bin/env node
import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";

const args = process.argv.slice(2);
const listOnly = args.includes("--list") || args.includes("-l");
const ifaceArgIndex = args.findIndex((arg) => arg === "--iface" || arg === "-i");
const iface = ifaceArgIndex >= 0 ? args[ifaceArgIndex + 1] : undefined;

const tsharkPath =
  process.env.TSHARK_PATH ??
  "/Applications/Wireshark.app/Contents/MacOS/tshark";
const wsPort = Number(process.env.RIVER_WS_PORT ?? 8787);

const ensureTshark = () => {
  if (!tsharkPath) {
    throw new Error("TSHARK_PATH not set.");
  }
};

const runList = () => {
  ensureTshark();
  const proc = spawn(tsharkPath, ["-D"], { stdio: "inherit" });
  proc.on("exit", (code) => process.exit(code ?? 0));
};

if (listOnly) {
  runList();
} else {
  ensureTshark();

  const wss = new WebSocketServer({ port: wsPort });
  const clients = new Set();
  wss.on("connection", (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  });

  const synTracker = new Map();
  const recordSyn = (src, dstPort) => {
    const now = Date.now();
    const bucket = synTracker.get(src) ?? { ports: new Map(), last: now };
    bucket.ports.set(dstPort, now);
    bucket.last = now;
    synTracker.set(src, bucket);
  };

  const pruneSyn = () => {
    const now = Date.now();
    for (const [src, bucket] of synTracker.entries()) {
      for (const [port, ts] of bucket.ports.entries()) {
        if (now - ts > 3000) {
          bucket.ports.delete(port);
        }
      }
      if (bucket.ports.size === 0) synTracker.delete(src);
    }
  };

  const sendEvent = (event) => {
    if (!clients.size) return;
    const payload = JSON.stringify(event);
    for (const socket of clients) {
      if (socket.readyState === socket.OPEN) {
        socket.send(payload);
      }
    }
  };

  const rateMs = Number(process.env.RIVER_RATE_MS ?? 80);
  const lastSentByType = new Map();
  const shouldSend = (type) => {
    const now = Date.now();
    const last = lastSentByType.get(type) ?? 0;
    if (now - last < rateMs) return false;
    lastSentByType.set(type, now);
    return true;
  };

  const tsharkArgs = [
    "-l",
    "-n",
    "-T",
    "ek",
    "-e",
    "frame.time_epoch",
    "-e",
    "frame.protocols",
    "-e",
    "ip.src",
    "-e",
    "ip.dst",
    "-e",
    "udp.port",
    "-e",
    "tcp.port",
    "-e",
    "dns.qry.name",
    "-e",
    "tcp.flags.syn",
    "-e",
    "tcp.flags.ack",
    "-e",
    "_ws.col.Protocol",
  ];

  if (iface) {
    tsharkArgs.push("-i", iface);
  }

  const proc = spawn(tsharkPath, tsharkArgs, { stdio: ["ignore", "pipe", "pipe"] });

  let buffer = "";
  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      try {
        const payload = JSON.parse(line);
        const layers = payload?.layers ?? {};
        const getLayer = (keys) => {
          for (const key of keys) {
            const value = layers[key];
            if (value && value.length) return value[0];
          }
          return undefined;
        };

        const protocols = getLayer(["frame.protocols", "frame_protocols"]) ?? "";
        const protoCol = getLayer(["_ws.col.Protocol", "_ws_col_Protocol"]) ?? "";
        const src = getLayer(["ip.src", "ip_src"]);
        const tcpFlagsSyn = getLayer(["tcp.flags.syn", "tcp_flags_syn"]) === "1";
        const tcpFlagsAck = getLayer(["tcp.flags.ack", "tcp_flags_ack"]) === "1";
        const dnsQuery = getLayer(["dns.qry.name", "dns_qry_name"]);
        const udpPort = getLayer(["udp.port", "udp_port"]);
        const tcpPort = getLayer(["tcp.port", "tcp_port"]);

        pruneSyn();

        let type = "tcp";
        let strength = 1;

        if (dnsQuery) {
          type = "dns";
          strength = 1.3;
        } else if (udpPort) {
          type = "udp";
          strength = 1.0;
        } else if (protocols.includes("malformed")) {
          type = "malformed";
          strength = 1.6;
        } else if (tcpPort) {
          type = "tcp";
          strength = 1.0;
        }

        if (protocols.includes("arp") || protocols.includes("icmpv6")) {
          type = "hierarchy";
          strength = 0.9;
        }

        if (src && tcpFlagsSyn && !tcpFlagsAck && tcpPort) {
          recordSyn(src, tcpPort);
          const bucket = synTracker.get(src);
          if (bucket && bucket.ports.size >= 8) {
            type = "portscan";
            strength = 1.8;
          }
        }

        if (protocols.split(":").length >= 5 || protoCol.includes("TLS")) {
          type = type === "dns" ? "dns" : "hierarchy";
          strength = Math.max(strength, 1.2);
        }

        if (shouldSend(type)) {
          sendEvent({ type, strength, protocol: protoCol, src });
        }
      } catch (err) {
        // Ignore parse errors from partial JSON lines.
      }
    }
  });

  proc.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  proc.on("exit", (code) => {
    console.log(`tshark exited with code ${code ?? 0}`);
    process.exit(code ?? 0);
  });

  console.log(`River bridge listening on ws://localhost:${wsPort}`);
  console.log(`Using tshark at ${tsharkPath}`);
  if (!iface) {
    console.log("No interface specified. Use --iface <name> after listing interfaces.");
  }
}
