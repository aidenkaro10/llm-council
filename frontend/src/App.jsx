import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Settings from './components/Settings';
import { api } from './api';
import './App.css';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState(null);

  // Load conversations, settings and lifetime spend on mount
  useEffect(() => {
    loadConversations();
    api.getSettings().then(setSettings).catch(() => {});
    loadStats();
  }, []);

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadStats = async () => {
    try {
      setStats(await api.getStats());
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadConversation = async (id) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await api.createConversation();
      setConversations([
        { id: newConv.id, created_at: newConv.created_at, message_count: 0 },
        ...conversations,
      ]);
      setCurrentConversationId(newConv.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
  };

  // Replace the assistant message that is currently streaming.
  // We copy instead of mutating so React notices the change and re-renders.
  const updateStreamingMessage = (updater) => {
    setCurrentConversation((prev) => {
      const messages = [...prev.messages];
      const last = { ...messages[messages.length - 1] };
      updater(last);
      messages[messages.length - 1] = last;
      return { ...prev, messages };
    });
  };

  // Append a piece of streamed text to the right model's entry.
  // `field` is where the answer text lives ('response' for stages 1 and 3,
  // 'ranking' for stage 2). Thinking text always goes to 'reasoning'.
  const appendDelta = (list, field, event) => {
    const key = event.channel === 'reasoning' ? 'reasoning' : field;
    return (list || []).map((item) =>
      item.model === event.model
        ? { ...item, [key]: (item[key] || '') + event.text }
        : item
    );
  };

  // Attach what a model charged to its entry in the list
  const applyCost = (list, event) =>
    (list || []).map((item) =>
      item.model === event.model ? { ...item, cost: event.cost } : item
    );

  const markError = (list, event) =>
    (list || []).map((item) =>
      item.model === event.model ? { ...item, error: event.message } : item
    );

  const handleSendMessage = async (content) => {
    if (!currentConversationId) return;

    setIsLoading(true);
    try {
      // Optimistically add user message to UI
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // Create a partial assistant message that will be filled in as text streams
      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: null,
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      // Send message with streaming
      await api.sendMessageStream(currentConversationId, content, (eventType, event) => {
        switch (eventType) {
          // --- Stage 1: individual answers ---
          case 'stage1_start':
            updateStreamingMessage((msg) => {
              // Create an empty slot per model so the tabs appear right away
              msg.stage1 = event.models.map((model) => ({
                model,
                response: '',
                reasoning: '',
              }));
              msg.loading = { ...msg.loading, stage1: true };
            });
            break;

          case 'stage1_delta':
            updateStreamingMessage((msg) => {
              msg.stage1 = appendDelta(msg.stage1, 'response', event);
            });
            break;

          case 'stage1_error':
            updateStreamingMessage((msg) => {
              msg.stage1 = markError(msg.stage1, event);
            });
            break;

          case 'stage1_cost':
            updateStreamingMessage((msg) => {
              msg.stage1 = applyCost(msg.stage1, event);
            });
            break;

          case 'stage1_complete':
            updateStreamingMessage((msg) => {
              msg.stage1 = event.data;
              msg.loading = { ...msg.loading, stage1: false };
            });
            break;

          // --- Stage 2: peer rankings ---
          case 'stage2_start':
            updateStreamingMessage((msg) => {
              msg.loading = { ...msg.loading, stage2: true };
            });
            break;

          case 'stage2_models':
            updateStreamingMessage((msg) => {
              msg.stage2 = event.models.map((model) => ({
                model,
                ranking: '',
                reasoning: '',
              }));
              msg.metadata = {
                ...(msg.metadata || {}),
                label_to_model: event.label_to_model,
              };
            });
            break;

          case 'stage2_delta':
            updateStreamingMessage((msg) => {
              msg.stage2 = appendDelta(msg.stage2, 'ranking', event);
            });
            break;

          case 'stage2_error':
            updateStreamingMessage((msg) => {
              msg.stage2 = markError(msg.stage2, event);
            });
            break;

          case 'stage2_cost':
            updateStreamingMessage((msg) => {
              msg.stage2 = applyCost(msg.stage2, event);
            });
            break;

          case 'stage2_complete':
            updateStreamingMessage((msg) => {
              msg.stage2 = event.data;
              msg.metadata = event.metadata;
              msg.loading = { ...msg.loading, stage2: false };
            });
            break;

          // --- Stage 3: chairman's final answer ---
          case 'stage3_start':
            updateStreamingMessage((msg) => {
              msg.stage3 = { model: event.model, response: '', reasoning: '' };
              msg.loading = { ...msg.loading, stage3: true };
            });
            break;

          case 'stage3_delta':
            updateStreamingMessage((msg) => {
              const key = event.channel === 'reasoning' ? 'reasoning' : 'response';
              msg.stage3 = {
                ...msg.stage3,
                [key]: (msg.stage3?.[key] || '') + event.text,
              };
            });
            break;

          case 'stage3_error':
            updateStreamingMessage((msg) => {
              msg.stage3 = { ...msg.stage3, error: event.message };
            });
            break;

          case 'stage3_cost':
            updateStreamingMessage((msg) => {
              msg.stage3 = { ...msg.stage3, cost: event.cost };
            });
            break;

          case 'cost_total':
            updateStreamingMessage((msg) => {
              msg.cost = event.cost;
            });
            break;

          case 'stage3_complete':
            updateStreamingMessage((msg) => {
              msg.stage3 = event.data;
              msg.loading = { ...msg.loading, stage3: false };
            });
            break;

          case 'title_complete':
            // Reload conversations to get updated title
            loadConversations();
            break;

          case 'complete':
            // Stream complete, refresh the sidebar and the lifetime total
            loadConversations();
            loadStats();
            setIsLoading(false);
            break;

          case 'error':
            console.error('Stream error:', event.message);
            updateStreamingMessage((msg) => {
              msg.error = event.message;
              msg.loading = { stage1: false, stage2: false, stage3: false };
            });
            setIsLoading(false);
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic messages on error
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2),
      }));
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        stats={stats}
        onOpenSettings={() => setShowSettings(true)}
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        settings={settings}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showSettings && (
        <Settings
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSaved={setSettings}
        />
      )}
    </div>
  );
}

export default App;
