import { useEffect, useState } from 'react';

/**
 * The opening: a counter climbs while the 3D chamber loads, then the curtain
 * lifts and the camera flies in. Shown once per browser session.
 */
export default function IntroLoader({ ready, onDone }) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const started = performance.now();
    let frame;

    const tick = () => {
      const elapsed = performance.now() - started;
      // climb quickly to 90, then wait for the scene, with a short minimum so
      // the intro never flashes past
      const eased = 90 * (1 - Math.pow(1 - Math.min(elapsed / 1300, 1), 3));
      const next = ready && elapsed > 1100 ? 100 : eased;
      setProgress((p) => Math.max(p, next));
      if (next < 100) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  useEffect(() => {
    if (progress < 100) return;
    const lift = setTimeout(() => setLeaving(true), 250);
    const done = setTimeout(onDone, 1250);
    return () => {
      clearTimeout(lift);
      clearTimeout(done);
    };
  }, [progress, onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--background)] transition-opacity duration-1000"
      style={{ opacity: leaving ? 0 : 1, pointerEvents: leaving ? 'none' : 'auto' }}
      aria-hidden="true"
    >
      <div className="text-[11px] font-medium tracking-[0.5em] text-white/60">LLM COUNCIL</div>
      <div className="mt-6 font-[family-name:var(--font-display)] text-[clamp(64px,12vw,140px)] leading-none tabular-nums text-white">
        {String(Math.floor(progress)).padStart(2, '0')}
      </div>
      <div className="mt-8 h-px w-48 overflow-hidden bg-white/10">
        <div className="h-full bg-white/70 transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 text-[11px] tracking-[0.35em] text-white/40 transition-colors duration-500" style={{ color: progress >= 100 ? 'oklch(0.85 0.1 85)' : undefined }}>
        {progress >= 100 ? 'ALL RISE' : 'CONVENING'}
      </div>
    </div>
  );
}
