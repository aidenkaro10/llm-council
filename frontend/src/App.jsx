import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Settings from './components/Settings';
import * as storage from './lib/storage';
import { listModels } from './lib/openrouter';
import { runCouncil, generateTitle } from './lib/council';
import './App.css';

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState(storage.getSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState(storage.getStats());
  const [models, setModels] = useState([]);

  // Keeps the latest conversation available inside the streaming callbacks
  const liveRef = useRef(null);

  useEffect(() => {
    setConversations(storage.listConversations());
    // The model list powers the judge picker and the price estimate
    listModels().then(setModels).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentId) setConversation(storage.getConversation(currentId));
  }, [currentId]);

  const refresh = () => {
    setConversations(storage.listConversations());
    setStats(storage.getStats());
  };

  const handleNewConversation = () => {
    const created = storage.createConversation();
    setConversations(storage.listConversations());
    setCurrentId(created.id);
    setConversation(created);
  };

  const handleDeleteConversation = (id) => {
    storage.deleteConversation(id);
    if (id === currentId) {
      setCurrentId(null);
      setConversation(null);
    }
    refresh();
  };

  // Rewrite the assistant message that is currently streaming. We copy rather
  // than mutate so React notices and re-renders.
  const updateLive = (updater) => {
    setConversation((prev) => {
      if (!prev) return prev;
      const messages = [...prev.messages];
      const last = { ...messages[messages.length - 1] };
      updater(last);
      messages[messages.length - 1] = last;
      const next = { ...prev, messages };
      liveRef.current = next;
      return next;
    });
  };

  const appendDelta = (list, event) =>
    (list || []).map((item) =>
      item.model === event.model
        ? {
            ...item,
            [event.channel === 'reasoning' ? 'reasoning' : 'text']:
              (item[event.channel === 'reasoning' ? 'reasoning' : 'text'] || '') + event.text,
          }
        : item
    );

  const applyCost = (list, event) =>
    (list || []).map((item) =>
      item.model === event.model ? { ...item, cost: event.cost } : item
    );

  const markError = (list, event) =>
    (list || []).map((item) =>
      item.model === event.model ? { ...item, error: event.message } : item
    );

  const handleEvent = (event) => {
    switch (event.type) {
      case 'stage1_start':
        updateLive((msg) => {
          // one empty slot per judge, so the courtroom fills immediately
          msg.stage1 = event.models.map((model) => ({ model, text: '', reasoning: '' }));
          msg.loading = { ...msg.loading, stage1: true };
        });
        break;
      case 'stage1_delta':
        updateLive((msg) => { msg.stage1 = appendDelta(msg.stage1, event); });
        break;
      case 'stage1_cost':
        updateLive((msg) => { msg.stage1 = applyCost(msg.stage1, event); });
        break;
      case 'stage1_error':
        updateLive((msg) => { msg.stage1 = markError(msg.stage1, event); });
        break;
      case 'stage1_complete':
        updateLive((msg) => {
          msg.stage1 = event.data;
          msg.loading = { ...msg.loading, stage1: false };
        });
        break;

      case 'stage2_start':
        updateLive((msg) => { msg.loading = { ...msg.loading, stage2: true }; });
        break;
      case 'stage2_models':
        updateLive((msg) => {
          msg.stage2 = event.models.map((model) => ({ model, text: '', reasoning: '' }));
          msg.metadata = { ...(msg.metadata || {}), label_to_model: event.label_to_model };
        });
        break;
      case 'stage2_delta':
        updateLive((msg) => { msg.stage2 = appendDelta(msg.stage2, event); });
        break;
      case 'stage2_cost':
        updateLive((msg) => { msg.stage2 = applyCost(msg.stage2, event); });
        break;
      case 'stage2_error':
        updateLive((msg) => { msg.stage2 = markError(msg.stage2, event); });
        break;
      case 'stage2_complete':
        updateLive((msg) => {
          msg.stage2 = event.data;
          msg.metadata = event.metadata;
          msg.loading = { ...msg.loading, stage2: false };
        });
        break;

      case 'stage3_start':
        updateLive((msg) => {
          msg.stage3 = { model: event.model, text: '', reasoning: '' };
          msg.loading = { ...msg.loading, stage3: true };
        });
        break;
      case 'stage3_delta':
        updateLive((msg) => {
          const key = event.channel === 'reasoning' ? 'reasoning' : 'text';
          msg.stage3 = { ...msg.stage3, [key]: (msg.stage3?.[key] || '') + event.text };
        });
        break;
      case 'stage3_cost':
        updateLive((msg) => { msg.stage3 = { ...msg.stage3, cost: event.cost }; });
        break;
      case 'stage3_error':
        updateLive((msg) => { msg.stage3 = { ...msg.stage3, error: event.message }; });
        break;
      case 'stage3_complete':
        updateLive((msg) => {
          msg.stage3 = event.data;
          msg.loading = { ...msg.loading, stage3: false };
        });
        break;

      default:
        break;
    }
  };

  const handleSendMessage = async (question) => {
    if (!currentId || !conversation) return;

    const current = storage.getConversation(currentId);
    const history = storage.conversationHistory(current);
    const isFirstMessage = current.messages.length === 0;

    setIsLoading(true);

    const withUser = {
      ...current,
      messages: [
        ...current.messages,
        { role: 'user', content: question },
        {
          role: 'assistant',
          stage1: null,
          stage2: null,
          stage3: null,
          metadata: null,
          cost: 0,
          loading: { stage1: false, stage2: false, stage3: false },
        },
      ],
    };
    liveRef.current = withUser;
    setConversation(withUser);

    // The title is cheap and slow, so start it now and collect it at the end
    const titlePromise = isFirstMessage
      ? generateTitle(settings.apiKey, settings.chairmanModel, question)
      : null;

    try {
      const result = await runCouncil({
        apiKey: settings.apiKey,
        councilModels: settings.councilModels,
        chairmanModel: settings.chairmanModel,
        question,
        history,
        emit: handleEvent,
      });

      let cost = result.cost;
      let title = current.title;
      if (titlePromise) {
        const titleResult = await titlePromise;
        title = titleResult.title;
        cost += titleResult.cost;
      }

      updateLive((msg) => { msg.cost = cost; });

      // Persist the finished exchange
      const finished = {
        ...liveRef.current,
        title,
        messages: [
          ...liveRef.current.messages.slice(0, -1),
          {
            role: 'assistant',
            stage1: result.answers,
            stage2: result.reviews,
            stage3: result.verdict,
            metadata: result.metadata,
            cost,
          },
        ],
      };
      storage.saveConversation(finished);
      setConversation(finished);
      refresh();
    } catch (error) {
      updateLive((msg) => {
        msg.error = error.message;
        msg.loading = { stage1: false, stage2: false, stage3: false };
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentId}
        onSelectConversation={setCurrentId}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        stats={stats}
        onOpenSettings={() => setShowSettings(true)}
      />
      <ChatInterface
        conversation={conversation}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        settings={settings}
        models={models}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showSettings && (
        <Settings
          settings={settings}
          models={models}
          onClose={() => setShowSettings(false)}
          onSaved={setSettings}
        />
      )}
    </div>
  );
}
