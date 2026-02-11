"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";

type Pulse = {
  time: number;
  type: number;
  strength: number;
  seed: number;
};

type SymbolEvent = {
  born: number;
  type: number;
  strength: number;
  x: number;
  y: number;
  spin: number;
  size: number;
  drift: number;
};

type RiverEventInput =
  | {
      type?: string;
      strength?: number;
      bytes?: number;
    }
  | string;

const MAX_PULSES = 8;
const EVENT_TYPES: Record<string, number> = {
  tcp: 0,
  udp: 1,
  dns: 2,
  portscan: 3,
  malformed: 4,
  hierarchy: 5,
};

const SHOW_RIVER = false;

// ─── Existing river shader (unchanged) ────────────────────────────────────────

const VERTEX_SHADER = `
precision mediump float;

attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec2 vUv;

void main() {
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec2 vUv;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_activity;
uniform float u_layer;
uniform float u_depth;
uniform float u_speed;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
uniform float u_exposure;
uniform float u_pulseCount;
uniform vec4 u_pulses[8];

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 pulseColor(float t) {
  if (t < 0.5) return vec3(0.8, 0.45, 0.95);
  if (t < 1.5) return vec3(0.3, 0.7, 1.0);
  if (t < 2.5) return vec3(0.9, 0.8, 0.35);
  if (t < 3.5) return vec3(1.0, 0.4, 0.3);
  if (t < 4.5) return vec3(0.65, 1.0, 0.6);
  return vec3(0.7, 0.55, 1.0);
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 pos = (uv - 0.5) * aspect;

  float time = u_time * u_speed;
  float activity = clamp(u_activity, 0.0, 1.0);

  float center = 0.05 * sin(pos.x * 1.6 + time * 0.12 + u_layer);

  float thickness = 0.15 + 0.03 * u_layer;
  float dist = abs(pos.y - center);
  float body = smoothstep(thickness, thickness * 0.6, dist);

  float edge = smoothstep(thickness * 0.75, thickness * 0.2, dist);
  float shimmer = pow(edge, 2.0) * 0.15;

  float breathing = 0.6 + 0.4 * sin(u_time * 0.25 + u_layer * 1.7);

  vec3 base = mix(u_colorA, u_colorB, 0.5 + 0.5 * sin(pos.x * 1.2 + time * 0.12));
  base = mix(base, u_colorC, 0.4);

  float glow = pow(body, 1.25) * (0.7 + 0.9 * shimmer);
  vec3 color = base * (0.22 + 0.38 * breathing) * body;
  color += base * glow * (0.32 + u_depth * 0.2);

  float rays = pow(max(0.0, 1.0 - abs(pos.x) * 1.8), 2.0);
  rays *= 0.2 * activity;
  color += u_colorB * rays * 0.08;

  vec3 pulse = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float active = step(float(i), u_pulseCount - 1.0);
    vec4 data = u_pulses[i];
    float age = u_time - data.x;
    float alive = active * step(0.0, age) * step(age, 10.0);
    float ripple = sin((pos.x * 6.0 - age * 1.8 + data.w) * 6.283);
    float band = exp(-abs(pos.y - center) * 15.0) * (0.5 + 0.5 * ripple);
    pulse += pulseColor(data.y) * band * data.z * exp(-age * 0.35) * alive;
  }

  color += pulse * 0.2;

  float alpha = smoothstep(0.0, 0.85, body + glow) * (0.14 + 0.1 * activity);
  color *= u_exposure;
  gl_FragColor = vec4(color, alpha);
}
`;

// ─── TCP throughput tracker ────────────────────────────────────────────────────
// Maintains a 3-second rolling window of byte counts and converts to a
// normalised 0-1 intensity value.
// Scale reference:
//   ≈ 4 GB in 60s  =  ~67 MB/s  → intensity 1.0
//   streaming 4K   = ~20 MB/s   → intensity ~0.55
//   streaming 1080 =  ~5 MB/s   → intensity ~0.30
//   light browsing =  ~0.1 MB/s → intensity ~0.05

const TCP_SCALE_BPS = 70_000_000; // 70 MB/s → intensity 1.0

class TcpRateTracker {
  private samples: { ts: number; bytes: number }[] = [];
  private windowMs = 3000;

  addBytes(bytes: number) {
    this.samples.push({ ts: performance.now(), bytes });
  }

  /** Returns bytes-per-second over the rolling window */
  getBytesPerSecond(): number {
    const now = performance.now();
    this.samples = this.samples.filter((s) => now - s.ts < this.windowMs);
    const total = this.samples.reduce((acc, s) => acc + s.bytes, 0);
    return total / (this.windowMs / 1000);
  }

  getIntensity(): number {
    const bps = this.getBytesPerSecond();
    // Logarithmic so small traffic is visible, large traffic saturates cleanly
    const raw = Math.log1p(bps) / Math.log1p(TCP_SCALE_BPS);
    return Math.min(1, raw);
  }
}

export default function CosmicRiver() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const vaporRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isActive = true;
    let instance: p5 | null = null;
    let socket: WebSocket | null = null;

    const setup = async () => {
      const p5Module = await import("p5");
      if (!isActive || !containerRef.current) return;

      let pulses: Pulse[] = [];
      let symbols: SymbolEvent[] = [];
      let lastActivity = performance.now();
      let nextRippleAt = performance.now() + 60000;

      const tcpTracker = new TcpRateTracker();

      // ── public API ──────────────────────────────────────────────────────────
      // Called by tshark bridge: pass raw byte count of each captured TCP segment
      (
        window as Window & {
          pushTcpBytes?: (bytes: number) => void;
        }
      ).pushTcpBytes = (bytes: number) => {
        tcpTracker.addBytes(bytes);
      };

      // Debug helper — open browser console and call: riverDebug()
      // Shows live TCP intensity so you can confirm data is flowing.
      (window as Window & { riverDebug?: () => void }).riverDebug = () => {
        const bps = tcpTracker.getBytesPerSecond();
        const intensity = tcpTracker.getIntensity();
        console.log(
          "%c[River TCP Vapor]",
          "color: #40e8d0; font-weight: bold",
          "\n  Bytes/sec :",
          (bps / 1_000_000).toFixed(3),
          "MB/s",
          "\n  Intensity :",
          (intensity * 100).toFixed(1) + "%",
          "\n  Tip: window.pushTcpBytes(5_000_000) to inject 5 MB manually",
        );
      };

      // Continuous debug logging (optional - comment out if too noisy)
      setInterval(() => {
        const intensity = tcpTracker.getIntensity();
        if (intensity > 0.01) {
          console.log(
            "%c[TCP Vapor]",
            "color: #40e8d0",
            `Intensity: ${(intensity * 100).toFixed(1)}% | ${(tcpTracker.getBytesPerSecond() / 1_000_000).toFixed(2)} MB/s`,
          );
        }
      }, 2000);

      const addPulse = (input: RiverEventInput) => {
        const now = performance.now();
        const payload = typeof input === "string" ? { type: input } : input;
        const typeKey = (payload.type ?? "tcp").toLowerCase();
        const type = EVENT_TYPES[typeKey] ?? 0;
        const strength = Math.max(0.2, Math.min(payload.strength ?? 1, 2));

        // If the event carries byte info, feed the TCP tracker
        if (
          typeKey === "tcp" &&
          typeof (payload as { bytes?: number }).bytes === "number"
        ) {
          tcpTracker.addBytes((payload as { bytes: number }).bytes);
        }

        pulses.unshift({
          time: now / 1000,
          type,
          strength,
          seed: Math.random() * 10,
        });
        pulses = pulses.slice(0, MAX_PULSES);
        symbols.unshift({
          born: now / 1000,
          type,
          strength,
          x: (Math.random() - 0.5) * 0.9,
          y: (Math.random() - 0.5) * 0.45,
          spin: (Math.random() - 0.5) * 0.8,
          size: 10 + Math.random() * 16,
          drift: 0.012 + Math.random() * 0.02,
        });
        symbols = symbols.slice(0, 24);
        lastActivity = now;
      };

      (
        window as Window & {
          pushRiverEvent?: (input: RiverEventInput) => void;
        }
      ).pushRiverEvent = addPulse;

      const sketch = (p: p5) => {
        let riverShader: p5.Shader;

        const particles: {
          x: number;
          y: number;
          z: number;
          speed: number;
        }[] = [];

        const initParticles = () => {
          particles.length = 0;
          for (let i = 0; i < 120; i += 1) {
            particles.push({
              x: p.random(-0.6, 0.6),
              y: p.random(-0.35, 0.35),
              z: p.random(0.1, 0.6),
              speed: p.random(0.02, 0.08),
            });
          }
        };

        p.setup = () => {
          p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
          p.noStroke();

          if (SHOW_RIVER) {
            riverShader = p.createShader(VERTEX_SHADER, FRAGMENT_SHADER);
          }
          initParticles();
        };

        p.windowResized = () => {
          p.resizeCanvas(p.windowWidth, p.windowHeight);
          initParticles();
        };

        p.draw = () => {
          const now = performance.now();
          const idleSeconds = (now - lastActivity) / 1000;
          const activity =
            idleSeconds < 10 ? 1 : Math.max(0.5, 1 - (idleSeconds - 10) / 8);

          pulses = pulses.filter((pulse) => now / 1000 - pulse.time < 10);
          symbols = symbols.filter((symbol) => now / 1000 - symbol.born < 20);

          (
            window as Window & {
              riverCounts?: Record<string, number>;
            }
          ).riverCounts = {
            dns: symbols.filter((s) => s.type === EVENT_TYPES.dns).length,
            tcp: symbols.filter((s) => s.type === EVENT_TYPES.tcp).length,
            udp: symbols.filter((s) => s.type === EVENT_TYPES.udp).length,
            portscan: symbols.filter((s) => s.type === EVENT_TYPES.portscan)
              .length,
            malformed: symbols.filter((s) => s.type === EVENT_TYPES.malformed)
              .length,
            hierarchy: symbols.filter((s) => s.type === EVENT_TYPES.hierarchy)
              .length,
          };

          // Publish TCP intensity for vapor wave visualization
          (window as Window & { __tcpIntensity?: number }).__tcpIntensity =
            tcpTracker.getIntensity();

          if (now > nextRippleAt) {
            addPulse({ type: "udp", strength: 0.6 });
            nextRippleAt = now + p.random(60000, 90000);
          }

          p.clear();
          p.background(1, 2, 6);

          // ── River shader layers (unchanged) ────────────────────────────────
          if (SHOW_RIVER) {
            p.shader(riverShader);
            p.blendMode(p.BLEND);

            const layerColors = [
              [0.08, 0.16, 0.26],
              [0.1, 0.18, 0.3],
              [0.12, 0.2, 0.32],
              [0.14, 0.22, 0.34],
            ];

            for (let i = 0; i < 4; i += 1) {
              const depth = i / 4;
              const colorA = layerColors[i];
              const colorB = layerColors[(i + 1) % layerColors.length];
              const colorC = layerColors[(i + 2) % layerColors.length];

              riverShader.setUniform("u_resolution", [p.width, p.height]);
              riverShader.setUniform("u_time", now / 1000);
              riverShader.setUniform("u_activity", activity);
              riverShader.setUniform("u_layer", i * 0.7 + 0.2);
              riverShader.setUniform("u_depth", depth);
              riverShader.setUniform("u_speed", 0.25 + i * 0.08);
              riverShader.setUniform("u_colorA", colorA);
              riverShader.setUniform("u_colorB", colorB);
              riverShader.setUniform("u_colorC", colorC);
              riverShader.setUniform("u_exposure", 0.25);
              riverShader.setUniform("u_pulseCount", pulses.length);
              riverShader.setUniform(
                "u_pulses",
                pulses.flatMap((pulse) => [
                  pulse.time,
                  pulse.type,
                  pulse.strength,
                  pulse.seed,
                ]),
              );

              p.blendMode(p.BLEND);
              p.rect(-p.width / 2, -p.height / 2, p.width, p.height);
            }

            p.resetShader();
            p.blendMode(p.ADD);
            p.noStroke();
            p.fill(80, 140, 255, 7);
            p.ellipse(0, 0, p.width * 1.1, p.height * 0.55);
            p.fill(140, 90, 255, 4);
            p.ellipse(0, -p.height * 0.1, p.width * 0.8, p.height * 0.35);
          }

          // (TCP vapor rendered on overlay canvas — see vaporRef)

          // ── Particles ──────────────────────────────────────────────────────
          p.blendMode(p.ADD);
          p.stroke(160, 220, 255, 80);
          p.strokeWeight(2);
          p.beginShape(p.POINTS);
          particles.forEach((particle) => {
            const drift = p.noise(
              particle.x * 2 + now * 0.00008,
              particle.y * 2 + now * 0.00006,
            );
            const wobble = (drift - 0.5) * 0.006 * activity;
            particle.x += particle.speed * 0.0015 + wobble;
            particle.y += Math.sin(now * 0.0004 + particle.z * 5) * 0.0006;

            if (particle.x > 0.7) {
              particle.x = -0.7;
              particle.y = p.random(-0.35, 0.35);
            }
            const x = particle.x * p.width;
            const y = particle.y * p.height;
            p.vertex(x, y, particle.z * 120);
          });
          p.endShape();

          // ── Symbol overlay ─────────────────────────────────────────────────
          p.blendMode(p.ADD);
          p.strokeWeight(2);
          p.noFill();
          symbols.forEach((symbol) => {
            const age = now / 1000 - symbol.born;
            const fadeIn = p.constrain(age / 2.4, 0, 1);
            const fadeOut = p.constrain(1 - age / 20, 0, 1);
            const fade = Math.pow(fadeIn * fadeOut, 1.1);
            const pulse = 1 + 0.15 * Math.sin(age * 3 + symbol.type);
            const size = symbol.size * pulse * (0.7 + symbol.strength * 0.3);
            const flow = p.noise(symbol.y * 2 + age * 0.4, symbol.type * 0.7);
            const drift = symbol.drift * (0.4 + flow);
            symbol.x += drift * 0.0015;
            symbol.y += Math.sin(age * 0.6 + symbol.spin) * 0.0004;

            if (symbol.x > 0.62) {
              symbol.x = -0.62;
              symbol.y = (Math.random() - 0.5) * 0.45;
            }

            const x = symbol.x * p.width;
            const y = symbol.y * p.height;

            p.push();
            p.translate(x, y, 120);
            p.rotateZ(age * symbol.spin);

            switch (symbol.type) {
              case EVENT_TYPES.dns: {
                p.noStroke();
                p.fill(255, 120, 200, 120 * fade);
                p.beginShape();
                p.vertex(0, size * 0.6);
                p.vertex(-size * 0.6, -size * 0.4);
                p.vertex(size * 0.6, -size * 0.4);
                p.endShape(p.CLOSE);
                break;
              }
              case EVENT_TYPES.tcp: {
                p.noStroke();
                p.fill(120, 220, 255, 130 * fade);
                p.ellipse(0, 0, size * 1.05, size * 1.05);
                break;
              }
              case EVENT_TYPES.udp: {
                p.stroke(120, 180, 255, 100 * fade);
                p.ellipse(0, 0, size * 1.1, size * 1.1);
                break;
              }
              case EVENT_TYPES.portscan: {
                p.stroke(255, 90, 80, 140 * fade);
                p.beginShape();
                p.vertex(0, -size * 0.7);
                p.vertex(size * 0.7, 0);
                p.vertex(0, size * 0.7);
                p.vertex(-size * 0.7, 0);
                p.endShape(p.CLOSE);
                break;
              }
              case EVENT_TYPES.malformed: {
                p.stroke(255, 190, 100, 140 * fade);
                p.beginShape();
                for (let i = 0; i < 8; i += 1) {
                  const angle = (p.TWO_PI / 8) * i;
                  const radius = i % 2 === 0 ? size * 0.8 : size * 0.4;
                  p.vertex(Math.cos(angle) * radius, Math.sin(angle) * radius);
                }
                p.endShape(p.CLOSE);
                break;
              }
              case EVENT_TYPES.hierarchy: {
                p.stroke(190, 140, 255, 120 * fade);
                p.beginShape();
                p.vertex(-size * 0.7, -size * 0.3);
                p.vertex(0, size * 0.6);
                p.vertex(size * 0.7, -size * 0.3);
                p.endShape();
                break;
              }
              default: {
                p.stroke(200, 200, 255, 120 * fade);
                p.ellipse(0, 0, size, size);
              }
            }
            p.pop();
          });
        };
      };

      instance = new p5Module.default(sketch, containerRef.current);

      const wsUrl =
        process.env.NEXT_PUBLIC_RIVER_WS_URL ?? "ws://localhost:8787";
      socket = new WebSocket(wsUrl);
      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type) {
            addPulse({
              type: payload.type,
              strength: payload.strength,
              bytes: payload.bytes,
            });
          }
          // Bare byte-count messages from tshark bridge:
          //   { "tcpBytes": 65536 }
          if (typeof payload?.tcpBytes === "number") {
            tcpTracker.addBytes(payload.tcpBytes);
          }
        } catch (err) {
          // ignore malformed events
        }
      });
    };

    setup();

    return () => {
      isActive = false;
      if (socket) socket.close();
      if (instance) instance.remove();
    };
  }, []);

  // ── TCP Vapor Wave — plain 2D canvas overlay ──────────────────────────────
  // Completely independent of p5. Uses layered radial gradients with
  // time-offset noise to produce organic drifting smoke. Intensity drives
  // opacity, spread, and turbulence amplitude.
  useEffect(() => {
    const canvas = vaporRef.current;
    if (!canvas) return;

    let rafId: number;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Smooth value noise — deterministic, no imports needed
    const hash = (n: number) => {
      const x = Math.sin(n) * 43758.5453123;
      return x - Math.floor(x);
    };
    const noise1 = (x: number) => {
      const i = Math.floor(x);
      const f = x - i;
      const u = f * f * (3 - 2 * f);
      return hash(i) * (1 - u) + hash(i + 1) * u;
    };
    const noise2 = (x: number, y: number) => {
      const ix = Math.floor(x),
        iy = Math.floor(y);
      const fx = x - ix,
        fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      const a = hash(ix + iy * 127.1);
      const b = hash(ix + 1 + iy * 127.1);
      const c = hash(ix + (iy + 1) * 127.1);
      const d = hash(ix + 1 + (iy + 1) * 127.1);
      return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
    };
    // 4-octave fBm
    const fbm = (x: number, y: number) => {
      let v = 0,
        a = 0.5,
        freq = 1;
      for (let i = 0; i < 4; i++) {
        v += a * noise2(x * freq, y * freq);
        freq *= 2.1;
        a *= 0.5;
      }
      return v;
    };

    // ── Smooth intensity (gentle anti-jitter) ──────────────────────────
    let smoothIntensity = 0;
    const intensitySmoothness = 0.85; // Gentle smoothing

    const draw = (ts: number) => {
      const t = ts * 0.001;
      const w = canvas.width;
      const h = canvas.height;
      const targetIntensity =
        (window as Window & { __tcpIntensity?: number }).__tcpIntensity ?? 0;

      // Exponential smoothing for intensity (gentle anti-jitter)
      smoothIntensity =
        smoothIntensity * intensitySmoothness +
        targetIntensity * (1 - intensitySmoothness);
      const intensity = smoothIntensity;

      ctx.clearRect(0, 0, w, h);

      if (intensity < 0.01) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      // How many smoke layers and how tall the band is
      const layers = 6;
      const spread = h * (0.06 + intensity * 0.36);
      const scrollSpd = 0.04 + intensity * 0.22;
      const cy = h * 0.5 + h * 0.04 * Math.sin(t * 0.18 + 1.3);

      for (let li = 0; li < layers; li++) {
        const lf = li / layers;
        // Each layer has its own noise-driven x offset and vertical wander
        const tx = t * scrollSpd * (0.6 + lf * 0.8) + li * 3.7;
        const ty = t * 0.08 + li * 1.9;

        // Sample fBm to get this layer's centre y and horizontal position
        const warpY = (fbm(tx * 0.4, ty * 0.4) - 0.5) * spread * 1.4;
        const warpX = (fbm(tx * 0.3 + 5.2, ty * 0.3 + 9.1) - 0.5) * w * 0.25;

        // Horizontal strip of overlapping blobs
        const blobCount = 5 + Math.floor(intensity * 7);
        for (let bi = 0; bi < blobCount; bi++) {
          const bf = bi / blobCount;
          const bx =
            (bf * 1.3 -
              0.15 +
              noise1(li * 4.1 + bi * 0.7 + t * scrollSpd * 0.4) * 0.1) *
              w +
            warpX;
          const by =
            cy +
            warpY +
            (noise2(bi * 2.3 + t * 0.12, li * 1.7) - 0.5) * spread * 0.9;
          const brad =
            spread * (0.5 + noise1(bi * 3.1 + li * 0.9 + t * 0.07) * 0.8);

          // Density: stronger in centre layers, fade edges
          const layerDensity = 1 - Math.abs(lf - 0.5) * 1.6;
          const alpha =
            Math.max(0, layerDensity) *
            intensity *
            (0.06 + noise1(bi * 1.3 + t * 0.2) * 0.07);

          // Marine colour: deep teal → aqua → seafoam → electric cyan at high intensity
          const hue1 = `rgba(10,  180, 185, ${alpha})`; // mid aqua
          const hue2 = `rgba(30,  220, 200, ${alpha * 0.6})`; // seafoam
          const hue3 = `rgba(120, 255, 240, ${alpha * (0.3 + intensity * 0.5)})`; // bloom

          const grad = ctx.createRadialGradient(bx, by, 0, bx, by, brad);
          grad.addColorStop(0, hue3);
          grad.addColorStop(0.3, hue2);
          grad.addColorStop(0.7, hue1);
          grad.addColorStop(1, "rgba(0,0,0,0)");

          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(bx, by, brad, brad * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Bright core streak along centreline at high intensity
      if (intensity > 0.3) {
        const coreAlpha = ((intensity - 0.3) / 0.7) * 0.18;
        const coreGrad = ctx.createLinearGradient(0, cy - 4, 0, cy + 4);
        coreGrad.addColorStop(0, `rgba(180,255,245,0)`);
        coreGrad.addColorStop(0.5, `rgba(180,255,245,${coreAlpha})`);
        coreGrad.addColorStop(1, `rgba(180,255,245,0)`);
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = coreGrad;
        ctx.fillRect(0, cy - 4, w, 8);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <canvas
        ref={vaporRef}
        className="pointer-events-none absolute inset-0"
        style={{ mixBlendMode: "screen" }}
      />
    </div>
  );
}
