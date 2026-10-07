import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Thinking from './Thinking';
import { Panel, ModelTabs } from './ui';

export default function Stage1({ responses, streaming, activeModel, onSelectModel }) {
  const [localTab, setLocalTab] = useState(0);

  if (!responses?.length) return null;

  // Clicking a judge in the courtroom opens their tab here. Models that failed
  // get dropped when the stage ends, so the index can run past the list.
  const fromCourtroom = activeModel
    ? responses.findIndex((r) => r.model === activeModel)
    : -1;
  const index =
    fromCourtroom >= 0 ? fromCourtroom : Math.min(localTab, responses.length - 1);
  const active = responses[index];

  const select = (i) => {
    setLocalTab(i);
    onSelectModel?.(responses[i].model);
  };

  return (
    <Panel step="1" title="First opinions" hint="Every judge answers on their own">
      <ModelTabs
        items={responses}
        activeIndex={index}
        onSelect={select}
        pendingOf={(r) => streaming && !r.text && !r.error}
      />

      <div className="mt-3 border-t border-[var(--border)] pt-3">
        {active.error ? (
          <p className="rounded-[var(--radius)] bg-[var(--danger)]/10 px-3 py-2 text-[13px] text-[var(--danger)]">
            {active.model} could not answer: {active.error}
          </p>
        ) : !active.text ? (
          <Thinking text={active.reasoning} />
        ) : (
          <div className="prose-council">
            <ReactMarkdown>
              {streaming ? active.text + ' █' : active.text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </Panel>
  );
}
