import RiverSketch from "./RiverSketch";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <RiverSketch />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col justify-between px-8 py-10 text-slate-100">
        <header className="flex max-w-2xl flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">
            Shark Cosmic River
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Hypnotic network flow, translated into living light.
          </h1>
          <p className="text-base leading-relaxed text-slate-200/80 sm:text-lg">
            Built for a college lab LAN: packet events become slow-moving ribbons, drifting
            mist, and luminous ripples. The stream rests when activity fades, then breathes
            back to life with every burst of traffic.
          </p>
        </header>

        <section className="mt-10 grid max-w-4xl gap-6 text-sm text-slate-200/80 sm:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">
              Live Controls
            </h2>
            <p>
              Trigger pulses in the console:
              <span className="mt-2 block font-mono text-cyan-100">
                window.pushRiverEvent("tcp")
              </span>
              <span className="block font-mono text-cyan-100">
                {"window.pushRiverEvent({ type: \"dns\", strength: 1.5 })"}
              </span>
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">
              Event Palette
            </h2>
            <p className="leading-relaxed">
              Map `tcp`, `udp`, `dns`, `portscan`, `malformed`, and `hierarchy` to flashes,
              streaks, or enlargements. Idle fades after 10 seconds without activity; subtle
              ripples appear every 60–90 seconds.
            </p>
            <ul className="space-y-1 text-xs uppercase tracking-[0.2em] text-slate-300/70">
              <li>Inverted pink triangle: DNS queries</li>
              <li>Cyan square: TCP flow</li>
              <li>Blue circle: UDP burst</li>
              <li>Red diamond: Port scan</li>
              <li>Amber burst: Malformed packet</li>
              <li>Violet chevron: Deep protocol stack / control plane</li>
            </ul>
          </div>
        </section>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,70,100,0.35),_transparent_55%),radial-gradient(circle_at_30%_80%,_rgba(60,20,90,0.35),_transparent_50%)]" />
    </div>
  );
}
