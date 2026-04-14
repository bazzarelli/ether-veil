#!/usr/bin/env node
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const isPrivateIpv4 = (address) => {
  if (!address) return false;
  if (address.startsWith("10.")) return true;
  if (address.startsWith("192.168.")) return true;

  const parts = address.split(".").map(Number);
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
};

const collectIpv4Addresses = () => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      const family =
        typeof entry.family === "string" ? entry.family : String(entry.family);
      if (family !== "IPv4" || entry.internal) continue;
      addresses.push({ name, address: entry.address });
    }
  }

  return addresses;
};

const detectLanIpv4 = () => {
  const addresses = collectIpv4Addresses();
  const privateAddress = addresses.find(({ address }) => isPrivateIpv4(address));
  return privateAddress?.address ?? addresses[0]?.address ?? "localhost";
};

const lanHost = detectLanIpv4();
const nextPublicRiverWsUrl =
  process.env.NEXT_PUBLIC_RIVER_WS_URL ?? `ws://${lanHost}:8787`;

const sharedEnv = {
  ...process.env,
  NEXT_PUBLIC_RIVER_WS_URL: nextPublicRiverWsUrl,
  RIVER_WS_HOST: "0.0.0.0",
};

const bridgeArgs = [
  path.join(projectRoot, "scripts", "lan-bridge.mjs"),
  ...process.argv.slice(2),
];

const nextCliPath = path.join(
  projectRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

let shuttingDown = false;
const children = new Set();

const shutdown = (signal = "SIGTERM") => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

const spawnChild = (label, command, args, env) => {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });

  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;

    if (signal) {
      console.error(`${label} exited due to signal ${signal}`);
      shutdown("SIGTERM");
      process.exitCode = 1;
      return;
    }

    if ((code ?? 0) !== 0) {
      console.error(`${label} exited with code ${code ?? 0}`);
      shutdown("SIGTERM");
      process.exitCode = code ?? 1;
    }
  });

  return child;
};

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(0);
});

console.log(
  `here is the address to share with the classroom: http://${lanHost}:3000`,
);
console.log(`live data websocket: ${nextPublicRiverWsUrl}`);

spawnChild("bridge", process.execPath, bridgeArgs, sharedEnv);
spawnChild(
  "next",
  process.execPath,
  [nextCliPath, "dev", "--hostname", "0.0.0.0"],
  sharedEnv,
);
