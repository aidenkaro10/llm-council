import ReactMarkdown from 'react-markdown';
import { Gavel } from 'lucide-react';
import Thinking from './Thinking';
import { Card } from './ui';

export default function Stage3({ finalResponse, streaming }) {
  if (!finalResponse) return null;

  return (
    <Card className="overflow-hidden ring-1 ring-[var(--foreground)]/10">
      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--muted)]/60 px-4 py-3">
        <Gavel className="h-4 w-4" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold tracking-tight">The verdict</h3>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--muted-foreground)]">
            {finalResponse.model}
          </p>
        </div>
      </div>

      <div className="p-4">
        {finalResponse.error ? (
          <p className="rounded-[var(--radius)] bg-[var(--danger)]/10 px-3 py-2 text-[13px] text-[var(--danger)]">
            The chairman could not deliver a verdict: {finalResponse.error}
          </p>
        ) : !finalResponse.text ? (
          <Thinking text={finalResponse.reasoning} />
        ) : (
          <div className="prose-council">
            <ReactMarkdown>
              {streaming ? finalResponse.text + ' █' : finalResponse.text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </Card>
  );
}
