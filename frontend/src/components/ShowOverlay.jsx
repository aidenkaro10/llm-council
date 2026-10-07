import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { Mark } from './Mark';
import { colorFor, vendorOf, shortName } from './brand';
import { personaFor } from '../lib/personas';
import { cn } from './ui';
import './ShowOverlay.css';

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Badge({ model, size = 28 }) {
  return (
    <svg viewBox="-16 -16 32 32" width={size} height={size} className="shrink-0 rounded-[7px]">
      <rect x="-16" y="-16" width="32" height="32" rx="7" fill={colorFor(model)} />
      <g transform="scale(0.85)">
        <Mark vendor={vendorOf(model)} color="#ffffff" />
      </g>
    </svg>
  );
}

/** A number that counts up from zero, like a game-show scoreboard. */
function CountUp({ value, delay = 0 }) {
  const [shown, setShown] = useState(reducedMotion ? value : 0);
  useEffect(() => {
    if (reducedMotion) return;
    let frame;
    const start = performance.now() + delay;
    const tick = () => {
      const u = Math.min(1, Math.max(0, (performance.now() - start) / 900));
      setShown(Math.round(value * (1 - Math.pow(1 - u, 3))));
      if (u < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, delay]);
  return shown;
}

/**
 * The broadcast graphics over the courtroom: the case being called, round
 * banners, a name strip for whoever is talking, the game-show scoreboard, and
 * the flash of the final gavel. They sit over the stage, never over the panel
 * with the answer.
 */
export default function ShowOverlay({ show, wide, chairModel }) {
  const { caseCard, scoreCard, flashAt, round, voice, lines } = show || {};
  const ranks = scoreCard?.rankings || [];
  const n = ranks.length;
  // a rank turned into points out of 100, because game shows have points
  const points = (avg) => (n > 1 ? Math.round(((n - avg) / (n - 1)) * 90 + 10) : 100);

  const speaking = voice && lines?.[voice] ? voice : null;
  const speakerModel = speaking === 'chair' ? chairModel : speaking;

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[15]',
        wide ? 'inset-y-0 right-0 left-[456px]' : 'inset-x-0 top-0 h-[42dvh]'
      )}
    >
      {caseCard && (
        // high up, over the back wall, so it doesn't sit on the judges
        <div key={caseCard.at} className="case-card absolute top-[13%] left-1/2 -translate-x-1/2 text-center">
          <div className="case-card-kicker">ORDER IN THE COURT</div>
          <div className="case-card-label">THE CASE</div>
          <div className="case-card-question">
            {caseCard.question?.length > 110 ? caseCard.question.slice(0, 108) + '...' : caseCard.question}
          </div>
        </div>
      )}

      {round && !caseCard && (
        <div key={round.at} className="round-banner absolute left-1/2" style={{ top: wide ? 84 : 70 }}>
          <span className="round-kicker">{round.kicker}</span>
          <span className="round-title">{round.title}</span>
        </div>
      )}

      {speakerModel && wide && (
        // the name strip, like a TV lower third
        <div
          key={speaking}
          className="lower-third absolute bottom-8 left-8"
          style={{ '--c': colorFor(speakerModel) }}
        >
          <Badge model={speakerModel} size={30} />
          <div className="min-w-0">
            <div className="lower-third-name">{shortName(speakerModel)}</div>
            <div className="lower-third-tag">
              {speaking === 'chair' ? 'The Chairman' : personaFor(speakerModel).nickname}
            </div>
          </div>
        </div>
      )}

      {scoreCard && n > 0 && (
        // in the corner, so it never covers the chairman as the camera moves in
        <div key={scoreCard.at} className="scoreboard absolute right-4 bottom-4 md:right-8 md:bottom-8">
          <div className="scoreboard-inner">
            <div className="scoreboard-title">THE VOTES ARE IN</div>
            <ol className="mt-3 space-y-1.5">
              {ranks.map((row, i) => (
                <li key={row.model} className="score-row" style={{ animationDelay: `${0.25 + i * 0.14}s` }}>
                  <span className={cn('score-rank', i === 0 && 'score-rank-first')}>{i + 1}</span>
                  <Badge model={row.model} size={24} />
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate font-mono text-[12.5px] text-white">
                    {i === 0 && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" fill="currentColor" />}
                    {shortName(row.model)}
                  </span>
                  <span className={cn('score-points', i === 0 && 'text-amber-300')}>
                    <CountUp value={points(row.average_rank)} delay={350 + i * 140} />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {flashAt > 0 && !reducedMotion && (
        <div
          key={flashAt}
          className="gavel-flash"
          style={{ animationDelay: `${Math.max(0, flashAt - performance.now())}ms` }}
        />
      )}
    </div>
  );
}
