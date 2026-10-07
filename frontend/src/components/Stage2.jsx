import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Crown } from 'lucide-react';
import Thinking from './Thinking';
import { Panel, ModelTabs, cn } from './ui';

/**
 * Judges reviewed "Response A", "Response B" and so on. Swap the real names
 * back in for display, in bold so it's clear they weren't in the original.
 */
function deAnonymize(text, labelToModel) {
  if (!labelToModel || !text) return text;
  let result = text;
  for (const [label, model] of Object.entries(labelToModel)) {
    result = result.replace(new RegExp(label, 'g'), `**${model.split('/')[1] || model}**`);
  }
  return result;
}

function shortName(model) {
  return model.split('/')[1] || model;
}

export default function Stage2({ rankings, labelToModel, aggregateRankings, streaming }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!rankings?.length) return null;

  const index = Math.min(activeTab, rankings.length - 1);
  const active = rankings[index];
  const best = aggregateRankings?.[0]?.average_rank;

  return (
    <Panel
      step="2"
      title="Cross-examination"
      hint="Each judge ranked the others without knowing who wrote what"
    >
      {/* the scoreboard comes first, since it's the result people care about */}
      {aggregateRankings?.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Combined ranking
          </div>
          <ol className="space-y-1.5">
            {aggregateRankings.map((row, i) => {
              // bar length: best average fills the bar, worst is shortest
              const worst = aggregateRankings.length;
              const width = Math.max(
                12,
                ((worst - row.average_rank + 1) / worst) * 100
              );
              return (
                <li key={row.model} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right font-mono text-[12px] text-[var(--muted-foreground)]">
                    {i + 1}
                  </span>
                  <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-[var(--muted)]">
                    <div
                      className={cn(
                        'absolute inset-y-0 left-0 rounded-md transition-all duration-700',
                        row.average_rank === best
                          ? 'bg-amber-400/25'
                          : 'bg-[var(--foreground)]/[0.07]'
                      )}
                      style={{ width: `${width}%` }}
                    />
                    <div className="relative flex h-full items-center gap-2 px-3">
                      {row.average_rank === best && (
                        <Crown className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />
                      )}
                      <span className="truncate font-mono text-[12.5px] font-medium">
                        {shortName(row.model)}
                      </span>
                    </div>
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-[11px] text-[var(--muted-foreground)]">
                    avg {row.average_rank.toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-[11.5px] text-[var(--muted-foreground)]">
            Average position across {aggregateRankings[0].rankings_count} blind
            reviews. Lower is better.
          </p>
        </div>
      )}

      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
        Each judge's review
      </div>
      <ModelTabs
        items={rankings}
        activeIndex={index}
        onSelect={setActiveTab}
        pendingOf={(r) => streaming && !r.text && !r.error}
      />

      <div className="mt-3 border-t border-[var(--border)] pt-3">
        {active.error ? (
          <p className="rounded-[var(--radius)] bg-[var(--danger)]/10 px-3 py-2 text-[13px] text-[var(--danger)]">
            {active.model} could not review: {active.error}
          </p>
        ) : !active.text ? (
          <Thinking text={active.reasoning} />
        ) : (
          <>
            <div className="prose-council">
              <ReactMarkdown>
                {deAnonymize(active.text, labelToModel) + (streaming ? ' █' : '')}
              </ReactMarkdown>
            </div>

            {active.parsed_ranking?.length > 0 && (
              <div className="mt-4 rounded-[var(--radius)] bg-[var(--muted)] px-3 py-2.5">
                <div className="mb-1.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                  What we read as their ranking
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {active.parsed_ranking.map((label, i) => (
                    <span
                      key={label}
                      className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 font-mono text-[11.5px]"
                    >
                      {i + 1}. {labelToModel?.[label] ? shortName(labelToModel[label]) : label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
