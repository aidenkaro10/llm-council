import { Crown } from 'lucide-react';
import { Mark } from './Mark';
import { colorFor, vendorOf, shortName } from './brand';
import { cn } from './ui';
import './ShowOverlay.css';

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function Badge({ model }) {
  return (
    <svg viewBox="-16 -16 32 32" width="26" height="26" className="shrink-0 rounded-[7px]">
      <rect x="-16" y="-16" width="32" height="32" rx="7" fill={colorFor(model)} />
      <g transform="scale(0.85)">
        <Mark vendor={vendorOf(model)} color="#ffffff" />
      </g>
    </svg>
  );
}

/**
 * Big moments of the show, laid over the courtroom: the case being called,
 * the scorecard when the votes are in, and the flash of the final gavel.
 * They sit over the scene, never over the panel with the answer.
 */
export default function ShowOverlay({ show, wide }) {
  const { caseCard, scoreCard, flashAt } = show || {};
  const worst = scoreCard?.rankings?.length || 1;

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[15] flex items-center justify-center',
        wide ? 'inset-y-0 right-0 left-[456px]' : 'inset-x-0 top-0 h-[42dvh]'
      )}
    >
      {caseCard && (
        // high up, over the back wall, so it doesn't sit on the judges
        <div key={caseCard.at} className="case-card text-center absolute top-[13%] left-1/2 -translate-x-1/2">
          <div className="case-card-kicker">ORDER IN THE COURT</div>
          <div className="case-card-label">THE CASE</div>
          <div className="case-card-question">
            {caseCard.question?.length > 110 ? caseCard.question.slice(0, 108) + '...' : caseCard.question}
          </div>
        </div>
      )}

      {scoreCard && scoreCard.rankings.length > 0 && (
        // in the corner, so it never covers the chairman as the camera moves in
        <div key={scoreCard.at} className="score-card glass absolute right-4 bottom-4 md:right-8 md:bottom-8">
          <div className="score-card-title">THE VOTES ARE IN</div>
          <ol className="mt-4 space-y-2">
            {scoreCard.rankings.map((row, i) => {
              const width = Math.max(14, ((worst - row.average_rank + 1) / worst) * 100);
              return (
                <li key={row.model} className="score-row" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
                  <span className="w-5 text-right font-mono text-[12px] text-white/50">{i + 1}</span>
                  <Badge model={row.model} />
                  <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-white/[0.06]">
                    <div
                      className="score-bar"
                      style={{
                        width: `${width}%`,
                        background: i === 0 ? 'linear-gradient(90deg, #ffcf3f55, #ffcf3f22)' : 'oklch(1 0 0 / 8%)',
                        animationDelay: `${0.4 + i * 0.12}s`,
                      }}
                    />
                    <span className="relative flex h-full items-center gap-1.5 px-3 font-mono text-[12.5px] text-white">
                      {i === 0 && <Crown className="h-3.5 w-3.5 text-amber-300" fill="currentColor" />}
                      {shortName(row.model)}
                    </span>
                  </div>
                  <span className="w-14 text-right font-mono text-[11px] text-white/45">
                    {row.average_rank.toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ol>
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
