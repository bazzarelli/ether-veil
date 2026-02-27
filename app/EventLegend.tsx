"use client";

import { useEffect, useState } from "react";

type Counts = Record<string, number>;
type LegendKey = "hierarchy" | "tcp" | "dns" | "udp" | "portscan" | "malformed";

type LegendItem = {
  key: LegendKey;
  label: string;
  title: string;
  paragraphs: string[];
};

const initialCounts: Counts = {
  dns: 0,
  tcp: 0,
  udp: 0,
  portscan: 0,
  malformed: 0,
  hierarchy: 0,
};

const legendItems: LegendItem[] = [
  {
    key: "tcp",
    label: "TCP flow",
    title: "TCP (Transport layer)",
    paragraphs: [
      "TCP is connection-oriented and verifies ordered delivery, similar to registered mail.",
      "Why it matters: Large bursts of TCP sessions from one source can indicate flood-style behavior such as SYN abuse.",
    ],
  },
  {
    key: "dns",
    label: "DNS queries",
    title: "DNS (Domain Name System)",
    paragraphs: [
      "DNS is the internet's phonebook. It translates names like google.com into IP addresses.",
      "Why it matters: Unusual DNS volume can suggest DNS tunneling or botnet command-and-control discovery.",
    ],
  },
  {
    key: "udp",
    label: "UDP burst",
    title: "UDP (Transport layer)",
    paragraphs: [
      "UDP is connectionless and prioritizes speed over guaranteed delivery, which is why it is common in streaming and gaming.",
      "Why it matters: Sudden UDP spikes can be a DDoS signal or another high-volume abuse pattern.",
    ],
  },
  {
    key: "hierarchy",
    label: "Protocol depth",
    title: "Hierarchy (Protocol depth)",
    paragraphs: [
      "Protocol hierarchy describes how traffic is nested, such as a VPN tunnel inside a standard connection.",
      "Why it matters: Tracking depth helps reveal hidden traffic paths and unauthorized tunnels leaving your network.",
    ],
  },
  {
    key: "portscan",
    label: "Port scan",
    title: "Portscan",
    paragraphs: [
      "A port scan probes many ports to discover which services and entry points are exposed.",
      "Why it matters: It is often the reconnaissance stage before exploitation. A red X indicates active probing for weaknesses.",
    ],
  },
  {
    key: "malformed",
    label: "Malformed packet",
    title: "Malformed packets",
    paragraphs: [
      "Malformed packets violate protocol rules, such as invalid headers or impossible field values.",
      "Why it matters: Attackers use malformed traffic in fuzzing and overflow attempts to crash software or trigger unsafe behavior.",
    ],
  },
];

function LegendIcon({ type }: { type: LegendKey }) {
  if (type === "hierarchy") {
    return (
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5">
        <polyline
          points="2,6 10,16 18,6"
          fill="none"
          stroke="rgb(190,140,255)"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (type === "tcp") {
    return (
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5">
        <circle cx="10" cy="10" r="8" fill="rgb(120,220,255)" />
      </svg>
    );
  }

  if (type === "dns") {
    return (
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5">
        <polygon points="10,16 2,4 18,4" fill="rgb(255,120,200)" />
      </svg>
    );
  }

  if (type === "udp") {
    return (
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5">
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="rgb(120,180,255)"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (type === "portscan") {
    return (
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5">
        <line
          x1="4"
          y1="4"
          x2="16"
          y2="16"
          stroke="rgb(255,40,40)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="16"
          y1="4"
          x2="4"
          y2="16"
          stroke="rgb(255,40,40)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5">
      <polygon
        points="10,1 12,7 19,7 13.5,11 16,18 10,14 4,18 6.5,11 1,7 8,7"
        fill="rgb(255,220,90)"
      />
    </svg>
  );
}

export default function EventLegend() {
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [activeItem, setActiveItem] = useState<LegendItem | null>(null);

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
    <div className="font-inter grid gap-4 md:grid-cols-3">
      <ul
        className="space-y-1 text-sm leading-relaxed text-slate-200/85 md:col-span-1"
        onMouseLeave={() => setActiveItem(null)}
      >
        {legendItems.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-slate-800/50 focus-visible:bg-slate-800/60 focus-visible:outline-none"
              onMouseEnter={() => setActiveItem(item)}
              onFocus={() => setActiveItem(item)}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">
                <LegendIcon type={item.key} />
              </span>
              <span>{item.label}</span>
              <span className="ml-auto text-cyan-100/85">
                {counts[item.key] ?? 0}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {activeItem ? (
        <aside className="rounded-lg border border-slate-700/70 bg-slate-900/55 px-4 py-3 text-base leading-relaxed text-slate-100/90 md:col-span-2">
          <h3 className="mb-2 text-base font-semibold text-cyan-100/95">
            {activeItem.title}
          </h3>
          <div className="space-y-2">
            {activeItem.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
