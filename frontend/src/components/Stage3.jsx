import ReactMarkdown from 'react-markdown';

/** The verdict. Set large, like a statement, because it is the answer. */
export default function Stage3({ finalResponse, streaming }) {
  if (!finalResponse) return null;

  if (finalResponse.error) {
    return (
      <p className="rounded-2xl bg-[var(--danger)]/10 px-4 py-3 text-[13px] text-[var(--danger)]">
        The council couldn't reach a verdict: {finalResponse.error}
      </p>
    );
  }

  if (!finalResponse.text) {
    return (
      <div className="flex items-center gap-3 py-2 text-[13px] text-white/55">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        The chairman is writing the verdict
      </div>
    );
  }

  return (
    <div className="brackets fade-up rounded-2xl px-5 py-5">
      <div className="mb-3 text-[10px] font-semibold tracking-[0.4em] text-white/40">VERDICT</div>
      <div className="verdict prose-council text-white">
        <ReactMarkdown>{streaming ? finalResponse.text + ' ▍' : finalResponse.text}</ReactMarkdown>
      </div>
    </div>
  );
}
