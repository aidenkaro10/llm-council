import { useEffect, useState } from 'react';
import './IntroLoader.css';

/**
 * The opening: you're standing outside the courtroom's double doors, with a
 * line of light coming through the gap. Once the 3D room has loaded, the
 * doors swing open onto it. Shown once per browser session.
 */
export default function IntroLoader({ ready, onDone }) {
  // 'closed' while loading, 'open' while the doors swing, then gone
  const [stage, setStage] = useState('closed');
  const [minTimePassed, setMinTimePassed] = useState(false);

  // stay closed for a moment at least, so the doors never just flash past
  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), 900);
    return () => clearTimeout(t);
  }, []);

  // the room is ready: open up, then get out of the way
  useEffect(() => {
    if (!ready || !minTimePassed) return;
    setStage('open');
    const done = setTimeout(onDone, 1900);
    return () => clearTimeout(done);
  }, [ready, minTimePassed, onDone]);

  return (
    <div className={`intro intro-${stage}`} aria-hidden="true">
      {/* the light from inside, seen through the gap and then the open doors */}
      <div className="intro-light" />

      {/* light leaking through the gap between the doors, and under them */}
      <div className="intro-seam" />
      <div className="intro-spill" />

      <div className="intro-doors">
        {['left', 'right'].map((side) => (
          <div key={side} className={`door door-${side}`}>
            {/* two raised panels, like a real wooden door */}
            <div className="door-panel door-panel-top" />
            <div className="door-panel door-panel-bottom" />
            {/* the brass push plate by the seam */}
            <div className="door-plate" />
          </div>
        ))}
      </div>

      {/* the brass sign on the doors */}
      <div className="intro-sign">
        <span className="intro-sign-small">COURTROOM 1</span>
        <span className="intro-sign-name">LLM Council</span>
      </div>
    </div>
  );
}
