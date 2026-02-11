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

  float storm = 0.0;

  float alpha = smoothstep(0.0, 0.85, body + glow) * (0.14 + 0.1 * activity);
  color *= u_exposure;
  gl_FragColor = vec4(color, alpha);
}
`;

export default function RiverSketch() {
  const containerRef = useRef<HTMLDivElement | null>(null);

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

      const addPulse = (input: RiverEventInput) => {
        const now = performance.now();
        const payload = typeof input === "string" ? { type: input } : input;
        const typeKey = (payload.type ?? "tcp").toLowerCase();
        const type = EVENT_TYPES[typeKey] ?? 0;
        const strength = Math.max(0.2, Math.min(payload.strength ?? 1, 2));

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

      (window as Window & { pushRiverEvent?: (input: RiverEventInput) => void })
        .pushRiverEvent = addPulse;

      const sketch = (p: p5) => {
        let shader: p5.Shader;
        const particles: { x: number; y: number; z: number; speed: number }[] = [];

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
            shader = p.createShader(VERTEX_SHADER, FRAGMENT_SHADER);
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
          (window as Window & { riverCounts?: Record<string, number> }).riverCounts = {
            dns: symbols.filter((symbol) => symbol.type === EVENT_TYPES.dns).length,
            tcp: symbols.filter((symbol) => symbol.type === EVENT_TYPES.tcp).length,
            udp: symbols.filter((symbol) => symbol.type === EVENT_TYPES.udp).length,
            portscan: symbols.filter((symbol) => symbol.type === EVENT_TYPES.portscan).length,
            malformed: symbols.filter((symbol) => symbol.type === EVENT_TYPES.malformed).length,
            hierarchy: symbols.filter((symbol) => symbol.type === EVENT_TYPES.hierarchy).length,
          };
          if (now > nextRippleAt) {
            addPulse({ type: "udp", strength: 0.6 });
            nextRippleAt = now + p.random(60000, 90000);
          }

          p.clear();
          p.background(1, 2, 6);
          if (SHOW_RIVER) {
            p.shader(shader);
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

              shader.setUniform("u_resolution", [p.width, p.height]);
              shader.setUniform("u_time", now / 1000);
              shader.setUniform("u_activity", activity);
              shader.setUniform("u_layer", i * 0.7 + 0.2);
              shader.setUniform("u_depth", depth);
              shader.setUniform("u_speed", 0.25 + i * 0.08);
              shader.setUniform("u_colorA", colorA);
              shader.setUniform("u_colorB", colorB);
              shader.setUniform("u_colorC", colorC);
              shader.setUniform("u_exposure", 0.25);
              shader.setUniform("u_pulseCount", pulses.length);
              shader.setUniform(
                "u_pulses",
                pulses.flatMap((pulse) => [pulse.time, pulse.type, pulse.strength, pulse.seed])
              );

              p.blendMode(p.BLEND);
              p.rect(-p.width / 2, -p.height / 2, p.width, p.height);
            }

            p.resetShader();
            // Reinforce bloom / god rays (soft, not a hard band)
            p.blendMode(p.ADD);
            p.noStroke();
            p.fill(80, 140, 255, 7);
            p.ellipse(0, 0, p.width * 1.1, p.height * 0.55);
            p.fill(140, 90, 255, 4);
            p.ellipse(0, -p.height * 0.1, p.width * 0.8, p.height * 0.35);
          }
          p.blendMode(p.ADD);
          p.stroke(160, 220, 255, 80);
          p.strokeWeight(2);
          p.beginShape(p.POINTS);
          particles.forEach((particle) => {
            const drift = p.noise(
              particle.x * 2 + now * 0.00008,
              particle.y * 2 + now * 0.00006
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

          // Symbol overlay (ghostly fade in/out)
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
                // Inverted pink triangle (solid)
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
                // Solid cyan circle (stable flow)
                p.noStroke();
                p.fill(120, 220, 255, 130 * fade);
                p.ellipse(0, 0, size * 1.05, size * 1.05);
                break;
              }
              case EVENT_TYPES.udp: {
                // Blue circle (bursty)
                p.stroke(120, 180, 255, 100 * fade);
                p.ellipse(0, 0, size * 1.1, size * 1.1);
                break;
              }
              case EVENT_TYPES.portscan: {
                // Hollow red diamond
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
                // Jagged amber burst
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
                // Violet chevron (deep protocol stack)
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

      const wsUrl = process.env.NEXT_PUBLIC_RIVER_WS_URL ?? "ws://localhost:8787";
      socket = new WebSocket(wsUrl);
      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type) {
            addPulse({ type: payload.type, strength: payload.strength });
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

  return <div ref={containerRef} className="h-full w-full" />;
}
