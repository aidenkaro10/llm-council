import ReactMarkdown from 'react-markdown';
import Thinking from './Thinking';
import './Stage3.css';

export default function Stage3({ finalResponse, streaming }) {
  if (!finalResponse) {
    return null;
  }

  return (
    <div className="stage stage3">
      <h3 className="stage-title">Stage 3: Final Council Answer</h3>
      <div className="final-response">
        <div className="chairman-label">
          Chairman: {finalResponse.model.split('/')[1] || finalResponse.model}
        </div>

        {finalResponse.error && (
          <div className="stage-error">The chairman failed: {finalResponse.error}</div>
        )}

        {!finalResponse.response && !finalResponse.error && (
          <Thinking text={finalResponse.reasoning} />
        )}

        {finalResponse.response && (
          <div className="final-text markdown-content">
            <ReactMarkdown>
              {streaming ? finalResponse.response + ' █' : finalResponse.response}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
