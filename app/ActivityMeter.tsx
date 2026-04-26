"use client";

import { useEffect, useState } from "react";

const LOAD_LABELS = ["Idle", "Ambient", "Active", "Heavy", "Saturated"];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getLoadLabel = (intensity: number) => {
  if (intensity < 0.12) return LOAD_LABELS[0];
  if (intensity < 0.32) return LOAD_LABELS[1];
  if (intensity < 0.56) return LOAD_LABELS[2];
  if (intensity < 0.8) return LOAD_LABELS[3];
  return LOAD_LABELS[4];
};

export default function ActivityMeter() {
  const [intensity, setIntensity] = useState(0);
  const [mbps, setMbps] = useState(0);

  useEffect(() => {
    const update = () => {
      const nextIntensity =
        typeof window.__trafficIntensity === "number"
          ? window.__trafficIntensity
          : 0;
      const nextBps =
        typeof window.__trafficBytesPerSecond === "number"
          ? window.__trafficBytesPerSecond
          : 0;

      setIntensity(clamp(nextIntensity, 0, 1));
      setMbps(nextBps / 1_000_000);
    };

    update();
    const intervalId = window.setInterval(update, 180);
    return () => window.clearInterval(intervalId);
  }, []);

  const fillHeight = `${Math.max(intensity * 100, 2)}%`;

  return (
    <aside
      aria-label="Traffic activity meter"
      className="activity-meter pointer-events-none absolute left-4 top-1/2 z-30 -translate-y-1/2 select-none md:left-6"
    >
      <div className="activity-meter__rail">
        <div className="activity-meter__track">
          <div className="activity-meter__well" aria-hidden="true">
            <div
              className="activity-meter__fill"
              style={{ height: fillHeight }}
            />
          </div>
        </div>
      </div>

      <div className="activity-meter__readout">
        <span className="activity-meter__eyebrow">Density</span>
        <strong className="activity-meter__state">{getLoadLabel(intensity)}</strong>
        <span className="activity-meter__value">{mbps.toFixed(2)} MB/s</span>
      </div>
    </aside>
  );
}
