import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Thinking from './Thinking';
import './Stage1.css';

export default function Stage1({ responses, streaming, activeModel, onSelectModel }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!responses || responses.length === 0) {
    return null;
  }

  // Clicking a judge in the courtroom opens their tab here. Otherwise we fall
  // back to whichever tab was clicked directly. Models that failed get dropped
  // when the stage finishes, so the index can end up past the end of the list.
  const fromCourtroom = activeModel
    ? responses.findIndex((r) => r.model === activeModel)
    : -1;
  const index =
    fromCourtroom >= 0 ? fromCourtroom : Math.min(activeTab, responses.length - 1);
  const active = responses[index];

  const select = (i) => {
    setActiveTab(i);
    onSelectModel?.(responses[i].model);
  };

  return (
    <div className="stage stage1">
      <h3 className="stage-title">Stage 1: Individual Responses</h3>

      <div className="tabs">
        {responses.map((resp, i) => (
          <button
            key={i}
            className={`tab ${index === i ? 'active' : ''} ${
              streaming && !resp.text && !resp.error ? 'pending' : ''
            }`}
            onClick={() => select(i)}
          >
            {resp.model.split('/')[1] || resp.model}
          </button>
        ))}
      </div>

      <div className="tab-content">
        <div className="model-name">{active.model}</div>

        {active.error && (
          <div className="stage-error">This model failed: {active.error}</div>
        )}

        {!active.text && !active.error && <Thinking text={active.reasoning} />}

        {active.text && (
          <div className="response-text markdown-content">
            <ReactMarkdown>
              {streaming ? active.text + ' █' : active.text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
