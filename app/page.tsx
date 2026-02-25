import EventLegend from "./EventLegend";
import CosmicRiver from "./CosmicRiver";
import FullscreenButton from "./FullscreenButton";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0">
        <CosmicRiver />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col justify-between px-8 py-10 text-slate-100">
        <div className="absolute right-8 top-10 z-20">
          <FullscreenButton />
        </div>

        <header className="flex max-w-4xl flex-col gap-4">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-200/70">
            Network Activity
          </p>
        </header>

        <section className="mt-10 grid max-w-4xl gap-6 text-sm text-slate-200/80 sm:grid-cols-2">
          <div className="space-y-3">
            <EventLegend />
          </div>
        </section>
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div className="planet-orb planet-orb-top" />
        <div className="planet-orb planet-orb-bottom" />
      </div>
    </div>
  );
}
