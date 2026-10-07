import { useState, useEffect } from 'react';
import { X, Search, Check, KeyRound, ExternalLink } from 'lucide-react';
import * as storage from '../lib/storage';
import { getCredits } from '../lib/openrouter';
import { estimateCost, money } from '../lib/cost';
import { Button, Input, cn } from './ui';

/**
 * Paste your OpenRouter key and pick who sits on the council.
 * The key is stored in this browser only and sent straight to OpenRouter.
 */
export default function Settings({ settings, models, onClose, onSaved }) {
  const [search, setSearch] = useState('');
  const [council, setCouncil] = useState(settings.councilModels);
  const [chairman, setChairman] = useState(settings.chairmanModel);
  const [apiKey, setApiKey] = useState('');
  const [credits, setCredits] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (settings.apiKey) getCredits(settings.apiKey).then(setCredits).catch(() => {});
  }, [settings.apiKey]);

  // Close on Escape, like any dialog should
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (id) =>
    setCouncil((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const save = () => {
    setStatus(null);
    const key = apiKey.trim();
    if (key && !key.startsWith('sk-or-')) {
      setStatus({ ok: false, text: "That doesn't look like an OpenRouter key. They start with sk-or-" });
      return;
    }
    const saved = storage.saveSettings({
      ...(key ? { apiKey: key } : {}),
      councilModels: council,
      chairmanModel: council.includes(chairman) ? chairman : council[0],
    });
    setApiKey('');
    onSaved(saved);
    setStatus({ ok: true, text: 'Saved' });
    getCredits(saved.apiKey).then(setCredits).catch(() => {});
  };

  const query = search.trim().toLowerCase();
  const all = models || [];
  const chosen = council.map((id) => all.find((m) => m.id === id) || { id, promptPrice: 0, completionPrice: 0 });
  const others = all
    .filter((m) => !council.includes(m.id))
    .filter((m) => !query || m.id.toLowerCase().includes(query))
    .slice(0, 80);

  const preview = estimateCost(council, council.includes(chairman) ? chairman : council[0], all);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Settings</h2>
            <p className="text-[12px] text-[var(--muted-foreground)]">Your key and your council</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close (Esc)">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6 overflow-y-auto px-5 py-5">
          {/* --- key --- */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[13px] font-medium">OpenRouter API key</label>
              {credits && (
                <span className="font-mono text-[11.5px] text-[var(--success)]">
                  ${credits.remaining.toFixed(2)} left
                </span>
              )}
            </div>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Input
                type="password"
                className="pl-9 font-mono"
                placeholder={settings.apiKey ? storage.keyPreview() : 'sk-or-v1-...'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted-foreground)]">
              Stored in this browser only and sent straight to OpenRouter. There is no
              server in between.{' '}
              <a
                href="https://openrouter.ai/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 underline underline-offset-2"
              >
                Get a key <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </section>

          {/* --- council --- */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="text-[13px] font-medium">
                The council{' '}
                <span className="text-[var(--muted-foreground)]">· {council.length} judges</span>
              </label>
              {preview.estimate > 0 && (
                <span className="font-mono text-[11.5px] text-[var(--muted-foreground)]">
                  ~{money(preview.estimate)} per question
                </span>
              )}
            </div>

            {/* chosen judges as removable chips */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {chosen.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)] py-1 pr-2 pl-3 font-mono text-[11.5px] transition hover:border-[var(--danger)]/40 cursor-pointer"
                  title="Remove from the council"
                >
                  {m.id}
                  <X className="h-3 w-3 text-[var(--muted-foreground)] group-hover:text-[var(--danger)]" />
                </button>
              ))}
              {council.length === 0 && (
                <span className="text-[12px] text-[var(--danger)]">Pick at least one judge</span>
              )}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Input
                className="pl-9"
                placeholder="Add a judge: search claude, gemini, llama, free..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="mt-2 max-h-56 overflow-y-auto rounded-[var(--radius)] border border-[var(--border)]">
              {others.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12px] text-[var(--muted-foreground)]">
                  {all.length ? 'No models match that' : 'Loading models...'}
                </p>
              ) : (
                others.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className="flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-left last:border-0 hover:bg-[var(--muted)] cursor-pointer"
                  >
                    <span className="flex-1 truncate font-mono text-[12px]">{m.id}</span>
                    <span className="shrink-0 font-mono text-[10.5px] text-[var(--muted-foreground)]">
                      {m.promptPrice === 0 && m.completionPrice === 0
                        ? 'free'
                        : `$${m.promptPrice.toFixed(2)} / $${m.completionPrice.toFixed(2)}`}
                    </span>
                  </button>
                ))
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
              Prices are per million tokens, in / out.
            </p>
          </section>

          {/* --- chairman --- */}
          <section>
            <label className="mb-2 block text-[13px] font-medium">Chairman</label>
            <div className="grid gap-1.5">
              {council.map((id) => (
                <button
                  key={id}
                  onClick={() => setChairman(id)}
                  className={cn(
                    'flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-left font-mono text-[12px] transition cursor-pointer',
                    chairman === id
                      ? 'border-[var(--foreground)]/30 bg-[var(--muted)]'
                      : 'border-[var(--border)] hover:bg-[var(--muted)]'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full border',
                      chairman === id
                        ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]'
                        : 'border-[var(--border)]'
                    )}
                  >
                    {chairman === id && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </span>
                  {id}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-[var(--muted-foreground)]">
              Reads every answer and every review, then writes the verdict. Usually your
              strongest judge.
            </p>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-5 py-3.5">
          {status && (
            <span
              className={cn(
                'mr-auto text-[12.5px]',
                status.ok ? 'text-[var(--success)]' : 'text-[var(--danger)]'
              )}
            >
              {status.text}
            </span>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={save} disabled={council.length === 0}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
