import { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import Courtroom from './Courtroom';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import { estimateCost, money } from '../lib/cost';
import './ChatInterface.css';

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
  settings,
  models,
  onOpenSettings,
}) {
  const [input, setInput] = useState('');
  // Which judge's full opinion is open below the courtroom
  const [selectedJudge, setSelectedJudge] = useState(null);
  const containerRef = useRef(null);

  // Text streams in constantly. We follow it down the page until the user
  // scrolls up themselves, then we leave them alone so they can read.
  const stickToBottom = useRef(true);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el && stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [conversation]);

  // Roughly what the next question will cost, from the judges you picked
  const estimate = useMemo(() => {
    if (!models?.length || !settings?.councilModels?.length) return null;
    const { estimate } = estimateCost(
      settings.councilModels,
      settings.chairmanModel,
      models
    );
    return estimate || null;
  }, [models, settings]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="empty-state">
          <h2>Welcome to LLM Council</h2>
          {settings && !settings.apiKey ? (
            <>
              <p>You need an OpenRouter key before the council can sit.</p>
              <button className="send-button" onClick={onOpenSettings}>
                Add your key
              </button>
            </>
          ) : (
            <p>Create a new conversation to get started</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="messages-container" ref={containerRef} onScroll={handleScroll}>
        {conversation.messages.length === 0 ? (
          <div className="empty-state">
            <h2>Start a conversation</h2>
            <p>Ask a question to consult the LLM Council</p>
          </div>
        ) : (
          conversation.messages.map((msg, index) => (
            <div key={index} className="message-group">
              {msg.role === 'user' ? (
                <div className="user-message">
                  <div className="message-label">You</div>
                  <div className="message-content">
                    <div className="markdown-content">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="assistant-message">
                  <div className="message-label">LLM Council</div>

                  {msg.error && (
                    <div className="stage-error">{msg.error}</div>
                  )}

                  {/* The courtroom: who is talking, and what they cost */}
                  {msg.stage1 && (
                    <Courtroom
                      message={msg}
                      selectedModel={selectedJudge}
                      onSelectJudge={setSelectedJudge}
                    />
                  )}

                  {/* Stage 1 - the spinner only shows before the tabs exist */}
                  {msg.loading?.stage1 && !msg.stage1 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 1: Collecting individual responses...</span>
                    </div>
                  )}
                  {msg.stage1 && (
                    <Stage1
                      responses={msg.stage1}
                      streaming={msg.loading?.stage1}
                      activeModel={selectedJudge}
                      onSelectModel={setSelectedJudge}
                    />
                  )}

                  {/* Stage 2 */}
                  {msg.loading?.stage2 && !msg.stage2 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 2: Peer rankings...</span>
                    </div>
                  )}
                  {msg.stage2 && (
                    <Stage2
                      rankings={msg.stage2}
                      labelToModel={msg.metadata?.label_to_model}
                      aggregateRankings={msg.metadata?.aggregate_rankings}
                      streaming={msg.loading?.stage2}
                    />
                  )}

                  {/* Stage 3 */}
                  {msg.loading?.stage3 && !msg.stage3 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 3: Final synthesis...</span>
                    </div>
                  )}
                  {msg.stage3 && (
                    <Stage3 finalResponse={msg.stage3} streaming={msg.loading?.stage3} />
                  )}

                  {msg.cost > 0 && (
                    <div className="question-cost">
                      This question cost <strong>${msg.cost.toFixed(4)}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
        <textarea
          className="message-input"
          placeholder={
            conversation.messages.length === 0
              ? 'Ask your question... (Shift+Enter for new line, Enter to send)'
              : 'Ask a follow-up. The council sees everything above.'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={3}
        />
        <div className="input-side">
          <button
            type="submit"
            className="send-button"
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? 'In session' : 'Send'}
          </button>
          {estimate !== null && (
            <span
              className="cost-estimate"
              title={
                'A rough guess based on typical answer lengths and your judges. ' +
                'The real price depends on how much each model writes.'
              }
            >
              ~{money(estimate)} a question
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
