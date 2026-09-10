/**
 * Shown while a model is still working and hasn't written any answer yet.
 * If the model exposes its reasoning, we show the tail end of it so you can
 * see something is happening instead of staring at a blank box.
 */
export default function Thinking({ text }) {
  const tail = text ? text.slice(-400) : '';

  return (
    <div className="thinking">
      <div className="thinking-label">
        <span className="spinner small"></span>
        <span>thinking...</span>
      </div>
      {tail && <div className="thinking-text">...{tail}</div>}
    </div>
  );
}
