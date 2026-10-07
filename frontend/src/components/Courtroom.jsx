import { Crown, Gavel, Scale } from 'lucide-react';
import Judge from './Judge';
import { money } from '../lib/cost';
import { cn } from './ui';
import { colorFor, vendorOf, shortName } from './brand';
import './Courtroom.css';

/** The last few words a mech has said, for its speech bubble. */
function lastWords(text, limit = 60) {
  if (!text) return '';
  // The ballot at the end of a review is noise in a bubble, so stop before it.
  // Split on the capitalised word alone, because it streams in before "RANKING".
  const body = text.split(/\bFINAL\b/)[0];
  const clean = body.replace(/[#*`>_]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length <= limit ? clean : '...' + clean.slice(-limit);
}

const PHASES = {
  opinions: { label: 'Hearing the question', step: 1 },
  review: { label: 'Cross-examination', step: 2 },
  verdict: { label: 'The chairman deliberates', step: 3 },
  done: { label: 'Verdict delivered', step: 3 },
};

function Bubble({ state, text, color }) {
  const words = state === 'speaking' ? lastWords(text) : '';

  // A model that has only written its ballot so far still looks busy
  if (state === 'thinking' || (state === 'speaking' && !words)) {
    return (
      <div className="bubble" style={{ '--c': color }}>
        <span className="flex gap-1 py-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="bubble-dot" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </span>
      </div>
    );
  }
  if (state === 'speaking') {
    return (
      <div className="bubble" style={{ '--c': color }}>
        <span className="bubble-text">{words}</span>
      </div>
    );
  }
  if (state === 'failed') {
    return <div className="bubble bubble-failed">offline</div>;
  }
  return null;
}

export default function Courtroom({ message, selectedModel, onSelectJudge }) {
  const loading = message.loading || {};

  const phase = loading.stage1
    ? 'opinions'
    : loading.stage2
    ? 'review'
    : loading.stage3
    ? 'verdict'
    : 'done';

  const stage1 = message.stage1 || [];
  const stage2 = message.stage2 || [];

  // Whoever the blind peer review put in first place
  const winner = message.metadata?.aggregate_rankings?.[0]?.model;

  const judges = stage1.map((entry) => {
    const review = stage2.find((r) => r.model === entry.model);
    const speaking = phase === 'review' ? review : entry;
    const text = phase === 'review' ? review?.text : entry.text;
    const failed = Boolean(entry.error || (phase === 'review' && review?.error));

    let state;
    if (failed) state = 'failed';
    else if (phase === 'opinions' || phase === 'review') {
      state = !speaking ? 'waiting' : text ? 'speaking' : 'thinking';
    } else state = 'done';

    return {
      model: entry.model,
      color: colorFor(entry.model),
      state,
      text,
      cost: (entry.cost || 0) + (review?.cost || 0),
      won: phase === 'done' && entry.model === winner,
    };
  });

  const chairman = message.stage3;
  const chairmanState = !chairman
    ? 'waiting'
    : chairman.error
    ? 'failed'
    : loading.stage3
    ? chairman.text
      ? 'speaking'
      : 'thinking'
    : 'done';

  const total = judges.reduce((s, j) => s + j.cost, 0) + (chairman?.cost || 0);

  return (
    <section className="arena">
      {/* --- header: which stage we're in, and the running bill --- */}
      <header className="relative z-10 flex items-center gap-3 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white">
          {phase === 'done' ? <Gavel className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
        </span>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-white">
            {PHASES[phase].label}
          </div>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                className={cn(
                  'h-1 w-8 rounded-full transition-colors duration-500',
                  step < PHASES[phase].step || phase === 'done'
                    ? 'bg-white/80'
                    : step === PHASES[phase].step
                    ? 'bg-white/50 animate-pulse'
                    : 'bg-white/15'
                )}
              />
            ))}
          </div>
        </div>
        {total > 0 && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11.5px] text-emerald-300">
            {money(total)}
          </span>
        )}
      </header>

      {/* --- the bench --- */}
      <div className="bench-row relative z-10 flex flex-wrap items-end justify-center gap-x-2 px-3">
        {judges.map((judge, i) => (
          <button
            key={judge.model}
            onClick={() => onSelectJudge?.(judge.model)}
            className={cn('seat', selectedModel === judge.model && 'seat-selected')}
            style={{ '--c': judge.color }}
            title={`${judge.model}: click to read the full opinion`}
          >
            <div className="flex h-[52px] items-end justify-center">
              <Bubble state={judge.state} text={judge.text} color={judge.color} />
            </div>

            <div className="relative">
              {judge.won && (
                <span className="crown" title="Ranked first by the other judges, blind">
                  <Crown className="h-5 w-5" fill="currentColor" strokeWidth={1.5} />
                </span>
              )}
              <div className="spotlight" />
              <Judge
                color={judge.color}
                vendor={vendorOf(judge.model)}
                state={judge.state}
                variant={i}
              />
            </div>

            <div className="plate">
              <span className="truncate font-mono text-[10.5px] font-semibold text-white">
                {shortName(judge.model)}
              </span>
              <span className="font-mono text-[10px] text-emerald-300/90">
                {money(judge.cost)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="bench" />

      {/* --- the chairman, on the dais --- */}
      {chairman && (
        <div className="dais">
          <div className="flex h-[52px] items-end justify-center">
            <Bubble
              state={chairmanState}
              text={chairman.text}
              color={colorFor(chairman.model)}
            />
          </div>
          <div className={cn('relative', chairmanState === 'done' && 'gavel-strike')}>
            <div className="spotlight spotlight-lg" style={{ '--c': colorFor(chairman.model) }} />
            <Judge
              color={colorFor(chairman.model)}
              vendor={vendorOf(chairman.model)}
              state={chairmanState}
              variant={1}
              size={124}
            />
          </div>
          <div className="plate" style={{ '--c': colorFor(chairman.model) }}>
            <span className="font-mono text-[10.5px] font-semibold text-white">
              Chairman · {shortName(chairman.model)}
            </span>
            <span className="font-mono text-[10px] text-emerald-300/90">
              {money(chairman.cost || 0)}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
