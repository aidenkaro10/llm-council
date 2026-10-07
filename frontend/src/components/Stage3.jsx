import ReactMarkdown from 'react-markdown';
import Thinking from './Thinking';

/** The verdict. This is the answer, so it is the one thing shown plainly. */
export default function Stage3({ finalResponse, streaming }) {
  if (!finalResponse) return null;

  if (finalResponse.error) {
    return (
      <p className="rounded-[var(--radius)] bg-[var(--danger)]/10 px-4 py-3 text-[13px] text-[var(--danger)]">
        The council couldn't reach a verdict: {finalResponse.error}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4">
      {!finalResponse.text ? (
        <Thinking />
      ) : (
        <div className="prose-council text-[15.5px]">
          <ReactMarkdown>
            {streaming ? finalResponse.text + ' █' : finalResponse.text}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
