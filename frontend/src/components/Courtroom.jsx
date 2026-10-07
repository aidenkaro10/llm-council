import Judge from './Judge';
import './Courtroom.css';

// Brand-ish colours so each judge is recognisable at a glance. Anything not
// listed falls back to a colour picked from the model name, so custom judges
// still look deliberate.
const BRAND_COLORS = {
  openai: '#10a37f',
  google: '#4285f4',
  anthropic: '#d97757',
  'x-ai': '#2b3440',
  'meta-llama': '#0668e1',
  mistralai: '#ff7000',
  deepseek: '#4d6bfe',
  qwen: '#6151e0',
  cohere: '#39594d',
  perplexity: '#20808d',
};

const FALLBACK_COLORS = ['#7b5ea7', '#c2185b', '#00897b', '#ef6c00', '#3949ab'];

function colorFor(model) {
  const vendor = model.split('/')[0];
  if (BRAND_COLORS[vendor]) return BRAND_COLORS[vendor];
  let hash = 0;
  for (const ch of model) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function shortName(model) {
  return model.split('/')[1] || model;
}

function money(amount) {
  if (!amount) return '$0.000';
  // fractions of a cent still deserve to be visible
  return amount < 0.001 ? `$${amount.toFixed(5)}` : `$${amount.toFixed(3)}`;
}

/** The last few words a judge has written, for their speech bubble. */
function lastWords(text, limit = 70) {
  if (!text) return '';
  const clean = text.replace(/[#*`>_]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length <= limit ? clean : '...' + clean.slice(-limit);
}

export default function Courtroom({ message, selectedModel, onSelectJudge }) {
  const loading = message.loading || {};

  // Which part of the trial we are in right now
  const phase = loading.stage1
    ? 'opinions'
    : loading.stage2
    ? 'review'
    : loading.stage3
    ? 'verdict'
    : 'done';

  const BANNERS = {
    opinions: 'The council hears the question',
    review: 'Cross-examination: the judges read each other',
    verdict: 'The chairman is writing the verdict',
    done: 'Verdict delivered',
  };

  // Judges come from stage 1. During cross-examination they are speaking their
  // stage 2 review instead, so that is the text we show in the bubble.
  const stage1 = message.stage1 || [];
  const stage2 = message.stage2 || [];

  const judges = stage1.map((entry) => {
    const review = stage2.find((r) => r.model === entry.model);
    const speaking = phase === 'review' ? review : entry;
    const text = phase === 'review' ? review?.ranking : entry.response;
    const failed = Boolean(entry.error || (phase === 'review' && review?.error));

    let state;
    if (failed) state = 'failed';
    else if (phase === 'opinions' || phase === 'review') {
      if (!speaking) state = 'waiting';
      else state = text ? 'speaking' : 'thinking';
    } else state = 'done';

    return {
      model: entry.model,
      state,
      text,
      cost: (entry.cost || 0) + (review?.cost || 0),
    };
  });

  const chairman = message.stage3;
  const chairmanState = chairman
    ? chairman.error
      ? 'failed'
      : loading.stage3
      ? chairman.response
        ? 'speaking'
        : 'thinking'
      : 'done'
    : 'waiting';

  const totalCost =
    judges.reduce((sum, j) => sum + j.cost, 0) + (chairman?.cost || 0);

  return (
    <div className={`courtroom phase-${phase}`}>
      <div className="courtroom-banner">
        <span className="gavel-icon" role="img" aria-label="gavel">
          {phase === 'done' ? '🔨' : '⚖️'}
        </span>
        <span className="banner-text">{BANNERS[phase]}</span>
        {totalCost > 0 && (
          <span className="banner-cost" title="What this question has cost so far">
            {money(totalCost)}
          </span>
        )}
      </div>

      <div className="courtroom-scene">
        <div className="wall-crest">⚖</div>

        <div className="bench-row">
          {judges.map((judge, i) => (
            <button
              key={judge.model}
              className={`judge-seat ${selectedModel === judge.model ? 'selected' : ''}`}
              onClick={() => onSelectJudge?.(judge.model)}
              title={`${judge.model} - click to read the full opinion`}
            >
              <div className="bubble-slot">
                {judge.state === 'thinking' && (
                  <div className="speech-bubble thinking-bubble">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </div>
                )}
                {judge.state === 'speaking' && judge.text && (
                  <div className="speech-bubble">{lastWords(judge.text)}</div>
                )}
                {judge.state === 'failed' && (
                  <div className="speech-bubble failed-bubble">recused</div>
                )}
              </div>

              <Judge
                color={colorFor(judge.model)}
                state={judge.state}
                variant={i % 4}
              />

              <div className="judge-plate">
                <span className="judge-name">{shortName(judge.model)}</span>
                <span className="judge-cost">{money(judge.cost)}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="bench" />

        {chairman && (
          <div className="chairman-stand">
            <div className="bubble-slot">
              {chairmanState === 'thinking' && (
                <div className="speech-bubble thinking-bubble">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              )}
              {chairmanState === 'speaking' && chairman.response && (
                <div className="speech-bubble">{lastWords(chairman.response, 90)}</div>
              )}
            </div>

            <div className={`chairman-figure ${chairmanState === 'done' ? 'bang' : ''}`}>
              <Judge
                color={colorFor(chairman.model)}
                state={chairmanState}
                variant={1}
                size={110}
              />
              <span className="chairman-gavel" role="img" aria-label="gavel">
                🔨
              </span>
            </div>

            <div className="judge-plate chairman-plate">
              <span className="judge-name">
                Chairman - {shortName(chairman.model)}
              </span>
              <span className="judge-cost">{money(chairman.cost || 0)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
