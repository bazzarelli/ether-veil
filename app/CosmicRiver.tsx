"use client";

import { useEffect, useRef, useState } from "react";
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

// ─── Visual customization ───────────────────────────────────────────────────
// Tweak these to change the appearance without touching the core logic
/*
// Original cyan/teal palette:
const CORE_STREAK_COLOR = { r: 100, g: 100, b: 255 }; // Brighter blue for center line
const VAPOR_COLORS = {
  base: { r: 10, g: 180, b: 185 }, // Deep teal base
  mid: { r: 30, g: 220, b: 200 }, // Seafoam mid-tone
  bloom: { r: 120, g: 255, b: 240 }, // Electric cyan bloom
};
*/
// Adjusted colors for a more moody violet/crimson spectrum
const CORE_STREAK_COLOR = { r: 100, g: 100, b: 255 };
// Deep violet core (strong blue + red, minimal green)

const VAPOR_COLORS = {
  base: { r: 60, g: 10, b: 110 }, // Dark indigo base
  mid: { r: 110, g: 20, b: 160 }, // Rich purple mid-tone
  bloom: { r: 200, g: 40, b: 120 }, // Magenta-red bloom
};

// Decorative mote settings.
const ENABLE_TEXTURE_MOTES = false;
const TEXTURE_MOTE_COLOR = { r: 60, g: 0, b: 0 };
const TEXTURE_MOTE_ALPHA_BASE = 140;
const TEXTURE_MOTE_ALPHA_DEPTH = 90;

type VaporMotionPreset = "ambient" | "balanced" | "energetic";

type VaporMotionConfig = {
  riseTauSec: number;
  fallTauSec: number;
  maxDeltaPerSec: number;
  scrollBase: number;
  scrollByIntensity: number;
  yPhaseBase: number;
  yPhaseByIntensity: number;
  centerlineBobPct: number;
  centerlineBobFreq: number;
  layerWarpYScale: number;
  blobYJitterScale: number;
  blurPx: number;
  trailFadeAlpha: number;
  minBlobs: number;
  maxBlobBoost: number;
};

const VAPOR_PRESET: VaporMotionPreset = "balanced";
const VAPOR_MOTION: Record<VaporMotionPreset, VaporMotionConfig> = {
  ambient: {
    riseTauSec: 1.1,
    fallTauSec: 1.8,
    maxDeltaPerSec: 0.45,
    scrollBase: 0.03,
    scrollByIntensity: 0.08,
    yPhaseBase: 0.07,
    yPhaseByIntensity: 0.01,
    centerlineBobPct: 0.018,
    centerlineBobFreq: 0.14,
    layerWarpYScale: 0.75,
    blobYJitterScale: 0.55,
    blurPx: 3.6,
    trailFadeAlpha: 0.12,
    minBlobs: 5,
    maxBlobBoost: 6,
  },
  balanced: {
    riseTauSec: 0.7,
    fallTauSec: 1.25,
    maxDeltaPerSec: 0.75,
    scrollBase: 0.035,
    scrollByIntensity: 0.11,
    yPhaseBase: 0.075,
    yPhaseByIntensity: 0.015,
    centerlineBobPct: 0.018,
    centerlineBobFreq: 0.15,
    layerWarpYScale: 0.7,
    blobYJitterScale: 0.5,
    blurPx: 2.6,
    trailFadeAlpha: 0.16,
    minBlobs: 5,
    maxBlobBoost: 7,
  },
  energetic: {
    riseTauSec: 0.45,
    fallTauSec: 0.8,
    maxDeltaPerSec: 1.1,
    scrollBase: 0.045,
    scrollByIntensity: 0.16,
    yPhaseBase: 0.09,
    yPhaseByIntensity: 0.03,
    centerlineBobPct: 0.03,
    centerlineBobFreq: 0.18,
    layerWarpYScale: 1,
    blobYJitterScale: 0.72,
    blurPx: 1.6,
    trailFadeAlpha: 0.28,
    minBlobs: 6,
    maxBlobBoost: 8,
  },
};

// ─── TCP throughput tracker ────────────────────────────────────────────────────
// Maintains a 3-second rolling window of byte counts and converts to a
// normalised 0-1 intensity value.
// Scale reference:
//   ≈ 4 GB in 60s  =  ~67 MB/s  → intensity 1.0
//   streaming 4K   = ~20 MB/s   → intensity ~0.55
//   streaming 1080 =  ~5 MB/s   → intensity ~0.30
//   light browsing =  ~0.1 MB/s → intensity ~0.05

const TCP_SCALE_BPS = 70_000_000; // 70 MB/s → intensity 1.0

type VisualControls = {
  tcpScaleBps: number;
  intensityGain: number;
  intensityMin: number;
  intensityMax: number;
  riseTauSec: number;
  fallTauSec: number;
  maxDeltaPerSec: number;
  layers: number;
  spreadBase: number;
  spreadByIntensity: number;
  blurPx: number;
  trailFadeAlpha: number;
  minBlobs: number;
  maxBlobBoost: number;
  scrollBase: number;
  scrollByIntensity: number;
  yPhaseBase: number;
  yPhaseByIntensity: number;
  centerlineBobPct: number;
  centerlineBobFreq: number;
  layerWarpYScale: number;
  blobYJitterScale: number;
  enableTextureMotes: boolean;
  textureMoteCount: number;
  textureMoteSpeedMul: number;
  textureMoteSizeMul: number;
  textureMoteAlphaMul: number;
};

const DEFAULT_VISUAL_CONTROLS: VisualControls = {
  tcpScaleBps: TCP_SCALE_BPS,
  intensityGain: 1,
  intensityMin: 0,
  intensityMax: 1,
  riseTauSec: VAPOR_MOTION[VAPOR_PRESET].riseTauSec,
  fallTauSec: VAPOR_MOTION[VAPOR_PRESET].fallTauSec,
  maxDeltaPerSec: VAPOR_MOTION[VAPOR_PRESET].maxDeltaPerSec,
  layers: 6,
  spreadBase: 0.06,
  spreadByIntensity: 0.36,
  blurPx: VAPOR_MOTION[VAPOR_PRESET].blurPx,
  trailFadeAlpha: VAPOR_MOTION[VAPOR_PRESET].trailFadeAlpha,
  minBlobs: VAPOR_MOTION[VAPOR_PRESET].minBlobs,
  maxBlobBoost: VAPOR_MOTION[VAPOR_PRESET].maxBlobBoost,
  scrollBase: VAPOR_MOTION[VAPOR_PRESET].scrollBase,
  scrollByIntensity: VAPOR_MOTION[VAPOR_PRESET].scrollByIntensity,
  yPhaseBase: VAPOR_MOTION[VAPOR_PRESET].yPhaseBase,
  yPhaseByIntensity: VAPOR_MOTION[VAPOR_PRESET].yPhaseByIntensity,
  centerlineBobPct: VAPOR_MOTION[VAPOR_PRESET].centerlineBobPct,
  centerlineBobFreq: VAPOR_MOTION[VAPOR_PRESET].centerlineBobFreq,
  layerWarpYScale: VAPOR_MOTION[VAPOR_PRESET].layerWarpYScale,
  blobYJitterScale: VAPOR_MOTION[VAPOR_PRESET].blobYJitterScale,
  enableTextureMotes: ENABLE_TEXTURE_MOTES,
  textureMoteCount: 180,
  textureMoteSpeedMul: 1,
  textureMoteSizeMul: 1,
  textureMoteAlphaMul: 1,
};

const PERFORMANCE_VISUAL_OVERRIDES: Partial<VisualControls> = {
  riseTauSec: 0.85,
  fallTauSec: 1.4,
  layers: 4,
  blurPx: 1.2,
  trailFadeAlpha: 0.22,
  minBlobs: 3,
  maxBlobBoost: 4,
  spreadByIntensity: 0.3,
  scrollByIntensity: 0.08,
  blobYJitterScale: 0.35,
  enableTextureMotes: false,
  textureMoteCount: 0,
};

const VISUAL_CONTROLS_STORAGE_KEY = "cosmic-river-visual-controls-v1";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

type SliderControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  format?: (value: number) => string;
};

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: SliderControlProps) {
  return (
    <label className="block text-xs text-slate-200">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-slate-400">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer accent-fuchsia-400"
      />
    </label>
  );
}

type ToggleControlProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

function ToggleControl({ label, checked, onChange }: ToggleControlProps) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-slate-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 cursor-pointer accent-fuchsia-400"
      />
    </label>
  );
}

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

  getIntensity(scaleBps = TCP_SCALE_BPS): number {
    const bps = this.getBytesPerSecond();
    // Logarithmic so small traffic is visible, large traffic saturates cleanly
    const raw = Math.log1p(bps) / Math.log1p(scaleBps);
    return Math.min(1, raw);
  }
}

export default function CosmicRiver() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const vaporRef = useRef<HTMLCanvasElement | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [visualControls, setVisualControls] = useState<VisualControls>(
    DEFAULT_VISUAL_CONTROLS,
  );
  const controlsRef = useRef(visualControls);

  const setControls = (
    updater: (current: VisualControls) => VisualControls,
  ) => {
    setVisualControls((current) => {
      const next = updater(current);
      controlsRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISUAL_CONTROLS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<VisualControls>;
      const merged = { ...DEFAULT_VISUAL_CONTROLS, ...parsed };
      setControls(() => merged);
    } catch {
      // ignore invalid persisted controls
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      VISUAL_CONTROLS_STORAGE_KEY,
      JSON.stringify(visualControls),
    );
  }, [visualControls]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key.toLowerCase() === "c") {
        setControlsOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const updateControl = <K extends keyof VisualControls>(
    key: K,
    value: VisualControls[K],
  ) => {
    setControls((current) => ({ ...current, [key]: value }));
  };

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
        const c = controlsRef.current;
        const bps = tcpTracker.getBytesPerSecond();
        const intensity = clamp(
          tcpTracker.getIntensity(c.tcpScaleBps) * c.intensityGain,
          c.intensityMin,
          c.intensityMax,
        );
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
        const c = controlsRef.current;
        const intensity = clamp(
          tcpTracker.getIntensity(c.tcpScaleBps) * c.intensityGain,
          c.intensityMin,
          c.intensityMax,
        );
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
        const particles: {
          x: number;
          y: number;
          z: number;
          speed: number;
        }[] = [];
        const darkMotes: {
          x: number;
          y: number;
          z: number;
          speed: number;
          driftSeed: number;
          phase: number;
          size: number;
        }[] = [];

        const spawnDarkMote = () => ({
          x: p.random(-0.7, 0.7),
          y: p.random(-0.45, 0.45),
          z: p.random(0.06, 0.6),
          speed: p.random(0.02, 0.04),
          driftSeed: p.random(0, 1000),
          phase: p.random(0, p.TWO_PI),
          size: p.random(3.8, 8.6),
        });

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

          darkMotes.length = 0;
          const c = controlsRef.current;
          if (!c.enableTextureMotes) return;
          for (let i = 0; i < c.textureMoteCount; i += 1) {
            darkMotes.push(spawnDarkMote());
          }
        };

        const drawDarkMotes = (now: number) => {
          const c = controlsRef.current;
          if (!c.enableTextureMotes) return;
          while (darkMotes.length < c.textureMoteCount) {
            darkMotes.push(spawnDarkMote());
          }
          if (darkMotes.length > c.textureMoteCount) {
            darkMotes.length = c.textureMoteCount;
          }
          if (darkMotes.length === 0) return;
          const gl = p.drawingContext as WebGLRenderingContext;
          gl.disable(gl.DEPTH_TEST);
          p.blendMode(p.ADD);
          p.noStroke();
          darkMotes.forEach((mote) => {
            const nx = p.noise(
              mote.driftSeed + now * 0.00004,
              mote.y * 1.8 + now * 0.00002,
            );
            const ny = p.noise(
              mote.driftSeed + 37.1 + now * 0.00003,
              mote.x * 2.1 + now * 0.00002,
            );
            const driftX = (nx - 0.5) * 0.0022;
            const driftY = (ny - 0.5) * 0.0017;
            mote.x += mote.speed * 0.0013 * c.textureMoteSpeedMul + driftX;
            mote.y +=
              Math.sin(now * 0.0003 + mote.phase + mote.z * 8) *
                0.00065 *
                c.textureMoteSpeedMul +
              driftY;

            if (mote.x > 0.72) mote.x = -0.72;
            if (mote.x < -0.72) mote.x = 0.72;
            if (mote.y > 0.5) mote.y = -0.5;
            if (mote.y < -0.5) mote.y = 0.5;

            const mx = mote.x * p.width;
            const my = mote.y * p.height;
            const alpha =
              (TEXTURE_MOTE_ALPHA_BASE + mote.z * TEXTURE_MOTE_ALPHA_DEPTH) *
              c.textureMoteAlphaMul;
            p.fill(
              TEXTURE_MOTE_COLOR.r,
              TEXTURE_MOTE_COLOR.g,
              TEXTURE_MOTE_COLOR.b,
              alpha,
            );
            p.push();
            p.translate(mx, my, 0);
            p.circle(0, 0, (mote.size + mote.z * 2.4) * c.textureMoteSizeMul);
            p.pop();
          });
          p.blendMode(p.BLEND);
          gl.enable(gl.DEPTH_TEST);
        };

        p.setup = () => {
          p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
          p.noStroke();
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
          const c = controlsRef.current;
          (window as Window & { __tcpIntensity?: number }).__tcpIntensity =
            clamp(
              tcpTracker.getIntensity(c.tcpScaleBps) * c.intensityGain,
              c.intensityMin,
              c.intensityMax,
            );

          if (now > nextRippleAt) {
            addPulse({ type: "udp", strength: 0.6 });
            nextRippleAt = now + p.random(60000, 90000);
          }

          p.clear();
          p.background(1, 2, 6);

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
            const isAlertSymbol =
              symbol.type === EVENT_TYPES.portscan ||
              symbol.type === EVENT_TYPES.malformed;
            // Alert symbols (portscan/malformed) get a fast "arrival pulse"
            // that decays over the first seconds.
            const alertEnvelope = isAlertSymbol ? Math.exp(-age * 2.6) : 0;
            const alertPulse = isAlertSymbol
              ? 1 + (0.35 + 0.65 * Math.abs(Math.sin(age * 14))) * alertEnvelope
              : 1;
            const alertFadeBoost = isAlertSymbol
              ? p.constrain(
                  fade *
                    (1 +
                      0.7 * alertEnvelope +
                      0.5 * Math.abs(Math.sin(age * 16))),
                  0,
                  1,
                )
              : fade;
            const size =
              symbol.size * pulse * alertPulse * (0.7 + symbol.strength * 0.3);
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
                // Pink filled triangle pointing up
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
                // Cyan filled circle with soft glow
                p.noStroke();
                p.fill(120, 220, 255, 130 * fade);
                p.ellipse(0, 0, size * 1.05, size * 1.05);
                break;
              }
              case EVENT_TYPES.udp: {
                // Lighter cyan hollow circle
                p.stroke(120, 180, 255, 100 * fade);
                p.ellipse(0, 0, size * 1.1, size * 1.1);
                break;
              }
              case EVENT_TYPES.portscan: {
                // Bright red bold X
                p.stroke(255, 40, 40, 220 * alertFadeBoost);
                p.strokeWeight(3.5 + 2 * alertEnvelope);
                // Draw X as two diagonal lines
                p.line(-size * 0.7, -size * 0.7, size * 0.7, size * 0.7);
                p.line(size * 0.7, -size * 0.7, -size * 0.7, size * 0.7);
                p.strokeWeight(2); // Reset stroke weight
                break;
              }
              case EVENT_TYPES.malformed: {
                // Solid yellow spiky star
                p.noStroke();
                p.fill(255, 220, 90, 210 * alertFadeBoost);
                p.beginShape();
                for (let i = 0; i < 8; i += 1) {
                  const angle = (p.TWO_PI / 8) * i;
                  const radius = i % 2 === 0 ? size * 0.8 : size * 0.4;
                  p.vertex(Math.cos(angle) * radius, Math.sin(angle) * radius);
                }
                p.endShape(p.CLOSE);
                p.strokeWeight(2);
                break;
              }
              case EVENT_TYPES.hierarchy: {
                // Violet triangle pointing down
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

          // ── Subtle texture motes (always-on, traffic independent) ─────────
          // Drawn last and at a closer z so they are visible over bright layers.
          drawDarkMotes(now);
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

    // ── Smooth intensity and ramp limiting (anti-jitter) ───────────────
    let smoothIntensity = 0;
    let lastTs = 0;

    const draw = (ts: number) => {
      const c = controlsRef.current;
      const t = ts * 0.001;
      const w = canvas.width;
      const h = canvas.height;
      const dt = lastTs > 0 ? Math.min(0.12, (ts - lastTs) / 1000) : 1 / 60;
      lastTs = ts;
      const targetIntensity =
        (window as Window & { __tcpIntensity?: number }).__tcpIntensity ?? 0;

      // Faster rise / slower fall makes spikes feel fluid instead of twitchy.
      const tau =
        targetIntensity > smoothIntensity ? c.riseTauSec : c.fallTauSec;
      const smoothingAlpha = 1 - Math.exp(-dt / Math.max(0.001, tau));
      const smoothedTarget =
        smoothIntensity + (targetIntensity - smoothIntensity) * smoothingAlpha;
      const maxDelta = c.maxDeltaPerSec * dt;
      const delta = smoothedTarget - smoothIntensity;
      smoothIntensity += Math.max(-maxDelta, Math.min(maxDelta, delta));
      const intensity = smoothIntensity;

      // Soft trail decay keeps motion cohesive and lava-like.
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      ctx.fillStyle = `rgba(0, 0, 0, ${c.trailFadeAlpha})`;
      ctx.fillRect(0, 0, w, h);

      if (intensity < 0.01) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      // How many smoke layers and how tall the band is
      const layers = c.layers;
      const spread = h * (c.spreadBase + intensity * c.spreadByIntensity);
      const scrollSpd = c.scrollBase + intensity * c.scrollByIntensity;
      const yPhaseSpd = c.yPhaseBase + intensity * c.yPhaseByIntensity;
      const cy =
        h * 0.5 +
        h * c.centerlineBobPct * Math.sin(t * c.centerlineBobFreq + 1.3);

      for (let li = 0; li < layers; li++) {
        const lf = li / layers;
        // Each layer has its own noise-driven x offset and vertical wander
        const tx = t * scrollSpd * (0.6 + lf * 0.8) + li * 3.7;
        const ty = t * 0.08 + li * 1.9;

        // Sample fBm to get this layer's centre y and horizontal position
        const warpY =
          (fbm(tx * 0.4, ty * 0.4) - 0.5) * spread * c.layerWarpYScale;
        const warpX = (fbm(tx * 0.3 + 5.2, ty * 0.3 + 9.1) - 0.5) * w * 0.25;

        // Horizontal strip of overlapping blobs with continuous density.
        const rawBlobCount = c.minBlobs + intensity * c.maxBlobBoost;
        const blobCount =
          Math.floor(rawBlobCount) + (Math.random() < rawBlobCount % 1 ? 1 : 0);
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
            (noise2(bi * 2.3 + t * yPhaseSpd, li * 1.7) - 0.5) *
              spread *
              c.blobYJitterScale;
          const brad =
            spread * (0.5 + noise1(bi * 3.1 + li * 0.9 + t * 0.07) * 0.8);

          // Density: stronger in centre layers, fade edges
          const layerDensity = 1 - Math.abs(lf - 0.5) * 1.6;
          const alpha =
            Math.max(0, layerDensity) *
            intensity *
            (0.06 + noise1(bi * 1.3 + t * 0.2) * 0.07);

          // Marine colour: deep teal → aqua → seafoam → electric cyan at high intensity
          const { r: r1, g: g1, b: b1 } = VAPOR_COLORS.base;
          const { r: r2, g: g2, b: b2 } = VAPOR_COLORS.mid;
          const { r: r3, g: g3, b: b3 } = VAPOR_COLORS.bloom;
          const hue1 = `rgba(${r1}, ${g1}, ${b1}, ${alpha})`;
          const hue2 = `rgba(${r2}, ${g2}, ${b2}, ${alpha * 0.6})`;
          const hue3 = `rgba(${r3}, ${g3}, ${b3}, ${alpha * (0.3 + intensity * 0.5)})`;

          const grad = ctx.createRadialGradient(bx, by, 0, bx, by, brad);
          grad.addColorStop(0, hue3);
          grad.addColorStop(0.3, hue2);
          grad.addColorStop(0.7, hue1);
          grad.addColorStop(1, "rgba(0,0,0,0)");

          ctx.globalCompositeOperation = "lighter";
          ctx.filter = `blur(${c.blurPx}px)`;
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
        const { r, g, b } = CORE_STREAK_COLOR;
        coreGrad.addColorStop(0, `rgba(${r},${g},${b},0)`);
        coreGrad.addColorStop(0.5, `rgba(${r},${g},${b},${coreAlpha})`);
        coreGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.globalCompositeOperation = "lighter";
        ctx.filter = "none";
        ctx.fillStyle = coreGrad;
        ctx.fillRect(0, cy - 4, w, 8);
      }

      ctx.filter = "none";

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
      <button
        type="button"
        onClick={() => setControlsOpen((open) => !open)}
        className="absolute bottom-4 right-4 z-50 rounded-md border border-fuchsia-400/40 bg-slate-950/70 px-3 py-1 text-xs text-slate-100 backdrop-blur"
      >
        Controls (C)
      </button>
      {controlsOpen ? (
        <div className="absolute right-4 top-14 z-50 max-h-[80vh] w-85 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/90 p-4 shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Vapor Controls
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setControls((current) => ({
                    ...current,
                    ...PERFORMANCE_VISUAL_OVERRIDES,
                  }))
                }
                className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200"
              >
                Lean
              </button>
              <button
                type="button"
                onClick={() => setControls(() => DEFAULT_VISUAL_CONTROLS)}
                className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200"
              >
                Heavy
              </button>
            </div>
          </div>
          <p className="mb-4 text-[12px] text-slate-400">
            Use this to tune smoothness, density, and traffic mapping in real
            time.
          </p>
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-slate-800 p-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300">
                Download Mapping
              </h4>
              <SliderControl
                label="TCP Scale (MB/s)"
                value={visualControls.tcpScaleBps / 1_000_000}
                min={10}
                max={300}
                step={1}
                format={(value) => `${value.toFixed(0)} MB/s`}
                onChange={(value) =>
                  updateControl("tcpScaleBps", value * 1_000_000)
                }
              />
              <SliderControl
                label="Intensity Gain"
                value={visualControls.intensityGain}
                min={0.4}
                max={2.5}
                step={0.01}
                onChange={(value) => updateControl("intensityGain", value)}
              />
              <SliderControl
                label="Intensity Min"
                value={visualControls.intensityMin}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) =>
                  setControls((current) => ({
                    ...current,
                    intensityMin: value,
                    intensityMax: Math.max(current.intensityMax, value),
                  }))
                }
              />
              <SliderControl
                label="Intensity Max"
                value={visualControls.intensityMax}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) =>
                  setControls((current) => ({
                    ...current,
                    intensityMax: value,
                    intensityMin: Math.min(current.intensityMin, value),
                  }))
                }
              />
            </div>

            <div className="space-y-2 rounded-lg border border-slate-800 p-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300">
                Smoothness
              </h4>
              <SliderControl
                label="Rise Smoothing"
                value={visualControls.riseTauSec}
                min={0.1}
                max={2.5}
                step={0.01}
                format={(value) => `${value.toFixed(2)}s`}
                onChange={(value) => updateControl("riseTauSec", value)}
              />
              <SliderControl
                label="Fall Smoothing"
                value={visualControls.fallTauSec}
                min={0.1}
                max={3}
                step={0.01}
                format={(value) => `${value.toFixed(2)}s`}
                onChange={(value) => updateControl("fallTauSec", value)}
              />
              <SliderControl
                label="Max Intensity Delta/s"
                value={visualControls.maxDeltaPerSec}
                min={0.1}
                max={2}
                step={0.01}
                onChange={(value) => updateControl("maxDeltaPerSec", value)}
              />
              <SliderControl
                label="Trail Blend"
                value={visualControls.trailFadeAlpha}
                min={0.02}
                max={0.5}
                step={0.01}
                onChange={(value) => updateControl("trailFadeAlpha", value)}
              />
              <SliderControl
                label="Blur"
                value={visualControls.blurPx}
                min={0}
                max={8}
                step={0.1}
                format={(value) => `${value.toFixed(1)}px`}
                onChange={(value) => updateControl("blurPx", value)}
              />
            </div>

            <div className="space-y-2 rounded-lg border border-slate-800 p-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300">
                Vapor Shape
              </h4>
              <SliderControl
                label="Layers"
                value={visualControls.layers}
                min={2}
                max={12}
                step={1}
                format={(value) => `${value.toFixed(0)}`}
                onChange={(value) => updateControl("layers", Math.round(value))}
              />
              <SliderControl
                label="Density Floor"
                value={visualControls.minBlobs}
                min={2}
                max={12}
                step={1}
                format={(value) => `${value.toFixed(0)}`}
                onChange={(value) =>
                  updateControl("minBlobs", Math.round(value))
                }
              />
              <SliderControl
                label="Density Boost"
                value={visualControls.maxBlobBoost}
                min={1}
                max={14}
                step={0.25}
                onChange={(value) => updateControl("maxBlobBoost", value)}
              />
              <SliderControl
                label="Spread Base"
                value={visualControls.spreadBase}
                min={0.01}
                max={0.2}
                step={0.005}
                onChange={(value) => updateControl("spreadBase", value)}
              />
              <SliderControl
                label="Spread by Intensity"
                value={visualControls.spreadByIntensity}
                min={0.05}
                max={0.8}
                step={0.01}
                onChange={(value) => updateControl("spreadByIntensity", value)}
              />
              <SliderControl
                label="Flow Speed"
                value={visualControls.scrollByIntensity}
                min={0}
                max={0.35}
                step={0.005}
                onChange={(value) => updateControl("scrollByIntensity", value)}
              />
              <SliderControl
                label="Vertical Jitter"
                value={visualControls.blobYJitterScale}
                min={0}
                max={1.5}
                step={0.01}
                onChange={(value) => updateControl("blobYJitterScale", value)}
              />
            </div>

            <div className="space-y-2 rounded-lg border border-slate-800 p-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300">
                Decorative Particles
              </h4>
              <ToggleControl
                label="Enable Texture Motes"
                checked={visualControls.enableTextureMotes}
                onChange={(value) => updateControl("enableTextureMotes", value)}
              />
              <SliderControl
                label="Mote Count"
                value={visualControls.textureMoteCount}
                min={0}
                max={260}
                step={1}
                format={(value) => `${value.toFixed(0)}`}
                onChange={(value) =>
                  updateControl("textureMoteCount", Math.round(value))
                }
              />
              <SliderControl
                label="Mote Speed"
                value={visualControls.textureMoteSpeedMul}
                min={0.1}
                max={2.5}
                step={0.01}
                onChange={(value) =>
                  updateControl("textureMoteSpeedMul", value)
                }
              />
              <SliderControl
                label="Mote Size"
                value={visualControls.textureMoteSizeMul}
                min={0.2}
                max={2.5}
                step={0.01}
                onChange={(value) => updateControl("textureMoteSizeMul", value)}
              />
              <SliderControl
                label="Mote Opacity"
                value={visualControls.textureMoteAlphaMul}
                min={0}
                max={2}
                step={0.01}
                onChange={(value) =>
                  updateControl("textureMoteAlphaMul", value)
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
