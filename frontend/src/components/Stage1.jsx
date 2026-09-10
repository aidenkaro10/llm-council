import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Thinking from './Thinking';
import './Stage1.css';

export default function Stage1({ responses, streaming }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!responses || responses.length === 0) {
    return null;
  }

  // Models that failed get dropped when the stage finishes, so the selected
  // tab index can end up past the end of the list.
  const index = Math.min(activeTab, responses.length - 1);
  const active = responses[index];

  return (
    <div className="stage stage1">
      <h3 className="stage-title">Stage 1: Individual Responses</h3>

      <div className="tabs">
        {responses.map((resp, i) => (
          <button
            key={i}
            className={`tab ${index === i ? 'active' : ''} ${
              streaming && !resp.response && !resp.error ? 'pending' : ''
            }`}
            onClick={() => setActiveTab(i)}
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

        {!active.response && !active.error && <Thinking text={active.reasoning} />}

        {active.response && (
          <div className="response-text markdown-content">
            <ReactMarkdown>
              {streaming ? active.response + ' █' : active.response}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
