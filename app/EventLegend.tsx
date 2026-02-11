"use client";

import { useEffect, useState } from "react";

type Counts = Record<string, number>;

const initialCounts: Counts = {
  dns: 0,
  tcp: 0,
  udp: 0,
  portscan: 0,
  malformed: 0,
  hierarchy: 0,
};

export default function EventLegend() {
  const [counts, setCounts] = useState<Counts>(initialCounts);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = (window as Window & { riverCounts?: Counts }).riverCounts;
      if (next) {
        setCounts((prev) => ({ ...prev, ...next }));
      }
      raf = window.setTimeout(tick, 250);
    };
    tick();
    return () => {
      window.clearTimeout(raf);
    };
  }, []);

  return (
    <ul className="space-y-1 text-xs uppercase tracking-[0.2em] text-slate-300/70">
      <li className="flex items-center gap-3">
        <span className="inline-flex h-3 w-3 items-center justify-center">
          <svg viewBox="0 0 20 20" className="h-3 w-3">
            <polygon points="10,16 2,4 18,4" fill="rgb(255,120,200)" />
          </svg>
        </span>
        <span>DNS queries</span>
        <span className="ml-auto text-cyan-100/80">{counts.dns}</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="inline-flex h-3 w-3 items-center justify-center">
          <svg viewBox="0 0 20 20" className="h-3 w-3">
            <circle cx="10" cy="10" r="8" fill="rgb(120,220,255)" />
          </svg>
        </span>
        <span>TCP flow</span>
        <span className="ml-auto text-cyan-100/80">{counts.tcp}</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="inline-flex h-3 w-3 items-center justify-center">
          <svg viewBox="0 0 20 20" className="h-3 w-3">
            <circle cx="10" cy="10" r="8" fill="none" stroke="rgb(120,180,255)" strokeWidth="2" />
          </svg>
        </span>
        <span>UDP burst</span>
        <span className="ml-auto text-cyan-100/80">{counts.udp}</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="inline-flex h-3 w-3 items-center justify-center">
          <svg viewBox="0 0 20 20" className="h-3 w-3">
            <polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="rgb(255,90,80)" strokeWidth="2" />
          </svg>
        </span>
        <span>Port scan</span>
        <span className="ml-auto text-cyan-100/80">{counts.portscan}</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="inline-flex h-3 w-3 items-center justify-center">
          <svg viewBox="0 0 20 20" className="h-3 w-3">
            <polygon
              points="10,1 12,7 19,7 13.5,11 16,18 10,14 4,18 6.5,11 1,7 8,7"
              fill="none"
              stroke="rgb(255,190,100)"
              strokeWidth="1.6"
            />
          </svg>
        </span>
        <span>Malformed packet</span>
        <span className="ml-auto text-cyan-100/80">{counts.malformed}</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="inline-flex h-3 w-3 items-center justify-center">
          <svg viewBox="0 0 20 20" className="h-3 w-3">
            <polyline
              points="2,6 10,16 18,6"
              fill="none"
              stroke="rgb(190,140,255)"
              strokeWidth="2"
            />
          </svg>
        </span>
        <span>Protocol depth</span>
        <span className="ml-auto text-cyan-100/80">{counts.hierarchy}</span>
      </li>
    </ul>
  );
}
