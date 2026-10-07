/**
 * Shown while a model is working but hasn't written anything yet. If it exposes
 * its reasoning we show the tail of that, so there is something to look at.
 */
export default function Thinking({ text }) {
  const tail = text ? text.slice(-300) : '';

  return (
    <div className="text-[13px] text-[var(--muted-foreground)]">
      <div className="flex items-center gap-2">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <span>{text === undefined ? 'Reaching a verdict' : 'thinking'}</span>
      </div>
      {tail && (
        <p className="mt-2 max-h-24 overflow-hidden border-l-2 border-[var(--border)] pl-3 text-[12px] italic opacity-70">
          ...{tail}
        </p>
      )}
    </div>
  );
}
