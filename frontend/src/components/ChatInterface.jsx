import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowUp, KeyRound } from 'lucide-react';
import CouncilStrip from './CouncilStrip';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import { cn } from './ui';
import { estimateCost, money } from '../lib/cost';

const STARTERS = [
  'Is a hot dog a sandwich?',
  'Best habit for learning faster?',
  'Google Ads or SEO for a new local business?',
];

const STAGE_LABELS = {
  opinions: 'Hearing the question',
  review: 'Judges reviewing each other, blind',
  verdict: 'The chairman is deciding',
};

/** Big serif lines that arrive one word at a time. */
function Reveal({ lines }) {
  let index = 0;
  return lines.map((line, l) => (
    <span key={l} className="block">
      {line.split(' ').map((word, w) => {
        const delay = 0.15 + index++ * 0.09;
        return (
          <span key={w} className="reveal-word" style={{ animationDelay: `${delay}s` }}>
            {word}&nbsp;
          </span>
        );
      })}
    </span>
  ));
}

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
  settings,
  models,
  onOpenSettings,
}) {
  const [input, setInput] = useState('');
  const [selectedJudge, setSelectedJudge] = useState(null);
  const [openDetails, setOpenDetails] = useState({});
  const containerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setOpenDetails({});
  }, [conversation?.id]);

  // Follow new text down until the user scrolls up themselves
  const stickToBottom = useRef(true);
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  useEffect(() => {
    const el = containerRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [conversation]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);

  const estimate = useMemo(() => {
    if (!models?.length || !settings?.councilModels?.length) return null;
    return estimateCost(settings.councilModels, settings.chairmanModel, models).estimate || null;
  }, [models, settings]);

  const submit = (text) => {
    const question = (text ?? input).trim();
    if (!question || isLoading || !settings?.apiKey) return;
    stickToBottom.current = true;
    onSendMessage(question);
    setInput('');
  };

  const messages = conversation?.messages || [];
  const empty = messages.length === 0;
  const hasKey = Boolean(settings?.apiKey);

  return (
    <main
      className={cn(
        'glass fixed z-20 flex flex-col overflow-hidden',
        // phones: a sheet across the bottom, the chamber shows above it
        'inset-x-2 bottom-2 h-[58dvh] rounded-3xl',
        // wider screens: a column on the left, the chamber fills the rest
        'md:inset-x-auto md:top-[76px] md:bottom-4 md:left-4 md:h-auto md:w-[440px]'
      )}
    >
      <div ref={containerRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 py-6 sm:px-6">
          {empty ? (
            <div className="flex min-h-[36dvh] flex-col justify-end md:min-h-[52dvh]">
              <h1 className="font-[family-name:var(--font-display)] text-[clamp(38px,5.2vw,58px)] leading-[0.98] tracking-[-0.01em] text-white">
                <Reveal lines={['Ask once.', 'The council decides.']} />
              </h1>
              <p className="fade-up mt-4 max-w-[30ch] text-[13.5px] leading-relaxed text-white/55" style={{ animationDelay: '0.7s' }}>
                Four AI models answer, judge each other blind, and hand you one verdict.
              </p>

              {hasKey ? (
                <div className="fade-up mt-6 flex flex-wrap gap-2" style={{ animationDelay: '0.9s' }}>
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="glass-soft rounded-full px-3.5 py-1.5 text-[12.5px] text-white/80 transition hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={onOpenSettings}
                  className="fade-up mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-medium text-black transition hover:bg-white/90 cursor-pointer"
                  style={{ animationDelay: '0.9s' }}
                >
                  <KeyRound className="h-4 w-4" />
                  Add your OpenRouter key
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-7">
              {messages.map((msg, index) =>
                msg.role === 'user' ? (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-[14px] text-black">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <AssistantMessage
                    key={index}
                    msg={msg}
                    detailsOpen={Boolean(openDetails[index])}
                    onToggleDetails={() =>
                      setOpenDetails((prev) => ({ ...prev, [index]: !prev[index] }))
                    }
                    selectedJudge={selectedJudge}
                    onSelectJudge={setSelectedJudge}
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- the composer --- */}
      <div className="border-t border-white/[0.07] p-3">
        <div className="glass-soft flex items-end gap-2 rounded-2xl p-1.5 transition focus-within:border-white/25">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={isLoading || !hasKey}
            placeholder={!hasKey ? 'Add your key in Settings first' : empty ? 'Ask the council' : 'Ask a follow-up'}
            className="max-h-[160px] min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[14.5px] text-white outline-none placeholder:text-white/35 disabled:opacity-60"
          />
          <button
            onClick={() => submit()}
            disabled={!input.trim() || isLoading || !hasKey}
            title="Send (Enter)"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:bg-white/15 disabled:text-white/40 cursor-pointer disabled:cursor-default"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex justify-between px-2 font-mono text-[10.5px] text-white/35">
          <span>{isLoading ? 'In session' : `${settings?.councilModels?.length || 0} judges`}</span>
          {estimate !== null && (
            <span title="A rough guess from typical answer lengths and your judges' prices">
              ~{money(estimate)} a question
            </span>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * One answer. While the council works, a short status line (the show is the
 * chamber behind). Once the verdict is in, the verdict, plus one line that
 * opens the full deliberation.
 */
function AssistantMessage({ msg, detailsOpen, onToggleDetails, selectedJudge, onSelectJudge }) {
  const loading = msg.loading || {};
  const working = loading.stage1 || loading.stage2 || loading.stage3;
  const finished = Boolean(msg.stage3) && !working;
  const phase = loading.stage1 ? 'opinions' : loading.stage2 ? 'review' : loading.stage3 ? 'verdict' : null;
  const step = { opinions: 1, review: 2, verdict: 3 }[phase] || 0;

  return (
    <div className="space-y-2.5">
      {msg.error && (
        <div className="rounded-2xl bg-[var(--danger)]/10 px-4 py-3 text-[13px] text-[var(--danger)]">
          {msg.error}
        </div>
      )}

      {phase && phase !== 'verdict' && (
        <div className="fade-up flex items-center gap-3 py-1">
          <div className="flex gap-1">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={cn(
                  'h-1 w-6 rounded-full transition-colors duration-500',
                  s < step ? 'bg-white/80' : s === step ? 'animate-pulse bg-white/60' : 'bg-white/15'
                )}
              />
            ))}
          </div>
          <span className="text-[12.5px] text-white/60">{STAGE_LABELS[phase]}</span>
        </div>
      )}

      {msg.stage3 && <Stage3 finalResponse={msg.stage3} streaming={loading.stage3} />}

      {finished && (
        <>
          <CouncilStrip message={msg} open={detailsOpen} onToggle={onToggleDetails} />
          {detailsOpen && (
            <div className="space-y-3 pt-1">
              <Stage1
                responses={msg.stage1}
                streaming={false}
                activeModel={selectedJudge}
                onSelectModel={onSelectJudge}
              />
              <Stage2
                rankings={msg.stage2}
                labelToModel={msg.metadata?.label_to_model}
                aggregateRankings={msg.metadata?.aggregate_rankings}
                streaming={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
