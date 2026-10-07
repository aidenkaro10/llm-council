import { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, KeyRound, Sparkles, Menu, Plus, Scale } from 'lucide-react';
import Courtroom from './Courtroom';
import CouncilStrip from './CouncilStrip';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import { Button, cn } from './ui';
import { estimateCost, money } from '../lib/cost';

const STARTERS = [
  'Is a hot dog a sandwich? Settle this.',
  'What is the single best habit for learning faster?',
  'Explain how a transformer works to a 12 year old.',
  'Should a small business start with Google Ads or SEO?',
];

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
  settings,
  models,
  onOpenSettings,
  onNewConversation,
  onOpenSidebar,
}) {
  const [input, setInput] = useState('');
  // Which judge's full opinion is open below the courtroom
  const [selectedJudge, setSelectedJudge] = useState(null);
  // Which answers have "How they got there" expanded, by message position
  const [openDetails, setOpenDetails] = useState({});

  useEffect(() => {
    setOpenDetails({});
  }, [conversation?.id]);

  const toggleDetails = (index) =>
    setOpenDetails((prev) => ({ ...prev, [index]: !prev[index] }));
  const containerRef = useRef(null);
  const textareaRef = useRef(null);

  // Follow the text down as it streams, until the user scrolls up themselves
  const stickToBottom = useRef(true);
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  };
  useEffect(() => {
    const el = containerRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [conversation]);

  // Grow the box with what's typed, up to a limit
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [input]);

  // Roughly what the next question will cost, from the judges you picked
  const estimate = useMemo(() => {
    if (!models?.length || !settings?.councilModels?.length) return null;
    return estimateCost(settings.councilModels, settings.chairmanModel, models).estimate || null;
  }, [models, settings]);

  const submit = (text) => {
    const question = (text ?? input).trim();
    if (!question || isLoading) return;
    stickToBottom.current = true;
    onSendMessage(question);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };


  // Phones only: menu, title, new conversation
  const mobileBar = (
    <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2 md:hidden">
      <Button variant="ghost" size="icon" onClick={onOpenSidebar} title="Conversations">
        <Menu className="h-4 w-4" />
      </Button>
      <div className="flex flex-1 items-center gap-1.5 truncate text-[14px] font-semibold">
        <Scale className="h-4 w-4 shrink-0" />
        <span className="truncate">{conversation?.title && conversation.title !== 'New Conversation' ? conversation.title : 'LLM Council'}</span>
      </div>
      <Button variant="ghost" size="icon" onClick={onNewConversation} title="New conversation">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );

  // --- nothing selected yet ---------------------------------------------------
  if (!conversation) {
    return (
      <main className="flex min-w-0 flex-1 flex-col">
        {mobileBar}
        <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--muted)]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Convene the council</h1>
          <p className="mt-2 text-[14px] text-[var(--muted-foreground)]">
            Ask once. Four models argue it out. You get one answer.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            {settings && !settings.apiKey ? (
              <Button variant="primary" onClick={onOpenSettings}>
                <KeyRound className="h-4 w-4" />
                Add your OpenRouter key
              </Button>
            ) : (
              <Button variant="primary" onClick={onNewConversation}>
                Start a conversation
              </Button>
            )}
          </div>
          {settings && !settings.apiKey && (
            <p className="mt-3 text-[12px] text-[var(--muted-foreground)]">
              Your key stays in this browser and goes straight to OpenRouter.
            </p>
          )}
        </div>
        </div>
      </main>
    );
  }

  const empty = conversation.messages.length === 0;

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      {mobileBar}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
          {empty ? (
            <div className="pt-[12vh] text-center">
              <h2 className="text-xl font-semibold tracking-tight">What should the council decide?</h2>
              <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    disabled={!settings?.apiKey}
                    className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left text-[13px] leading-snug transition hover:bg-[var(--muted)] disabled:opacity-50 cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {conversation.messages.map((msg, index) =>
                msg.role === 'user' ? (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--foreground)] px-4 py-2.5 text-[14.5px] text-[var(--background)]">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <AssistantMessage
                    key={index}
                    msg={msg}
                    detailsOpen={Boolean(openDetails[index])}
                    onToggleDetails={() => toggleDetails(index)}
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
      <div className="border-t border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-3 py-3 sm:px-6 sm:py-4">
          <div
            className={cn(
              'flex items-end gap-2 rounded-2xl border border-[var(--input)] bg-[var(--card)] p-2 shadow-sm transition',
              'focus-within:ring-2 focus-within:ring-[var(--ring)]'
            )}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || !settings?.apiKey}
              placeholder={
                !settings?.apiKey
                  ? 'Add your OpenRouter key in Settings first'
                  : empty
                  ? 'Ask the council anything'
                  : 'Ask a follow-up'
              }
              className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14.5px] outline-none placeholder:text-[var(--muted-foreground)] disabled:opacity-60"
            />
            <Button
              variant="primary"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl"
              onClick={() => submit()}
              disabled={!input.trim() || isLoading}
              title="Send (Enter)"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between px-1 text-[11.5px] text-[var(--muted-foreground)]">
            <span>
              {isLoading
                ? 'The council is in session...'
                : `${settings?.councilModels?.length || 0} judges`}
            </span>
            {estimate !== null && (
              <span
                className="cursor-help font-mono"
                title="A rough guess from typical answer lengths and your judges' prices. The real cost depends on how much each model writes."
              >
                ~{money(estimate)} per question
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * One answer from the council.
 *
 * While the council is working, the arena is the show. Once the verdict is in,
 * the verdict is all you see, and the deliberation folds into one line you can
 * open if you want to know how they got there.
 */
function AssistantMessage({
  msg,
  detailsOpen,
  onToggleDetails,
  selectedJudge,
  onSelectJudge,
}) {
  const loading = msg.loading || {};
  const working = loading.stage1 || loading.stage2 || loading.stage3;
  const finished = Boolean(msg.stage3) && !working;

  const details = (
    <div className="space-y-4">
      <Courtroom message={msg} selectedModel={selectedJudge} onSelectJudge={onSelectJudge} />
      <Stage1
        responses={msg.stage1}
        streaming={loading.stage1}
        activeModel={selectedJudge}
        onSelectModel={onSelectJudge}
      />
      <Stage2
        rankings={msg.stage2}
        labelToModel={msg.metadata?.label_to_model}
        aggregateRankings={msg.metadata?.aggregate_rankings}
        streaming={loading.stage2}
      />
    </div>
  );

  return (
    <div className="space-y-2">
      {msg.error && (
        <div className="rounded-[var(--radius)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-[13px] text-[var(--danger)]">
          {msg.error}
        </div>
      )}

      {msg.stage3 && <Stage3 finalResponse={msg.stage3} streaming={loading.stage3} />}

      {finished ? (
        <>
          <CouncilStrip message={msg} open={detailsOpen} onToggle={onToggleDetails} />
          {detailsOpen && <div className="pt-2">{details}</div>}
        </>
      ) : (
        msg.stage1 && (
          <Courtroom message={msg} selectedModel={selectedJudge} onSelectJudge={onSelectJudge} />
        )
      )}
    </div>
  );
}
