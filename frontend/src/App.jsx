import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Settings from './components/Settings';
import TopBar from './components/TopBar';
import IntroLoader from './components/IntroLoader';
import ShowOverlay from './components/ShowOverlay';
import SoundNudge from './components/SoundNudge';
import useShow from './scene/useShow';
import { setSoundEnabled } from './scene/sound';
import { unlockVoice, stopVoice } from './scene/voice';
import * as storage from './lib/storage';
import { listModels } from './lib/openrouter';
import { runCouncil, generateTitle } from './lib/council';

// The 3D chamber is the heaviest part of the app, so it loads separately and
// the rest of the page works before it arrives.
const Chamber = lazy(() => import('./scene/Chamber'));

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The intro plays once per browser session, not on every visit. */
function shouldPlayIntro() {
  if (reducedMotion) return false;
  try {
    return !sessionStorage.getItem('llmcouncil.intro');
  } catch {
    return true;
  }
}

/** Screen size, so the chamber can frame itself around the panel. */
function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/**
 * Work out what the chamber should show from the latest answer: who's on the
 * council, what each judge is doing, and which stage we're in.
 */
function sceneFrom(conversation, settings) {
  const last = [...(conversation?.messages || [])].reverse().find((m) => m.role === 'assistant');

  const messages = conversation?.messages || [];
  const lastQuestion = [...messages].reverse().find((m) => m.role === 'user')?.content || null;

  if (!last?.stage1) {
    return {
      phase: 'idle',
      question: lastQuestion,
      rankings: [],
      council: settings.councilModels.map((model) => ({ model, state: 'waiting' })),
      chairman: { model: settings.chairmanModel, state: 'waiting' },
    };
  }

  const loading = last.loading || {};
  const phase = loading.stage1 ? 'opinions' : loading.stage2 ? 'review' : loading.stage3 ? 'verdict' : 'done';
  const winner = last.metadata?.aggregate_rankings?.[0]?.model;
  const reviews = last.stage2 || [];

  const council = last.stage1.map((entry) => {
    const review = reviews.find((r) => r.model === entry.model);
    const current = phase === 'review' ? review : entry;
    const text = phase === 'review' ? review?.text : entry.text;
    const failed = Boolean(entry.error || (phase === 'review' && review?.error));

    let state = 'done';
    if (failed) state = 'failed';
    else if (phase === 'opinions' || phase === 'review') {
      state = !current ? 'waiting' : text ? 'speaking' : 'thinking';
    }

    return {
      model: entry.model,
      state,
      text,
      cost: (entry.cost || 0) + (review?.cost || 0),
      won: (phase === 'verdict' || phase === 'done') && entry.model === winner,
    };
  });

  const v = last.stage3;
  const chairman = {
    model: v?.model || settings.chairmanModel,
    state: !v ? 'waiting' : v.error ? 'failed' : loading.stage3 ? (v.text ? 'speaking' : 'thinking') : 'done',
    text: v?.text,
    cost: v?.cost || 0,
  };

  return {
    phase,
    council,
    chairman,
    question: lastQuestion,
    rankings: last.metadata?.aggregate_rankings || [],
    // "Response A" -> the real model, so the arguing on screen names names
    labels: last.metadata?.label_to_model || null,
    // the comedy scene written from the real debate, once it's back
    script: last.script || null,
  };
}

export default function App() {
  const [conversations, setConversations] = useState(storage.listConversations());
  const [currentId, setCurrentId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState(storage.getSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stats, setStats] = useState(storage.getStats());
  const [models, setModels] = useState([]);
  const [focus, setFocus] = useState(null);

  // Sound is off until someone turns it on. The choice is remembered.
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem('llmcouncil.sound') === 'on';
    } catch {
      return false;
    }
  });
  const [nudge, setNudge] = useState(false);

  const toggleSound = useCallback((on) => {
    setSoundOn(on);
    // browsers only allow audio and speech to start from a click, which this is
    setSoundEnabled(on);
    if (on) unlockVoice();
    else stopVoice();
    try {
      localStorage.setItem('llmcouncil.sound', on ? 'on' : 'off');
    } catch {
      // nothing to do
    }
  }, []);

  const [introPlaying, setIntroPlaying] = useState(shouldPlayIntro);
  const [chamberReady, setChamberReady] = useState(false);
  const introOnce = useRef(introPlaying);

  const { w, h } = useViewport();
  const wide = w >= 768;

  // Keeps the latest conversation available inside the streaming callbacks
  const liveRef = useRef(null);

  useEffect(() => {
    // The model list powers the judge picker and the price estimate
    listModels().then(setModels).catch(() => {});
  }, []);

  const finishIntro = useCallback(() => {
    setIntroPlaying(false);
    try {
      sessionStorage.setItem('llmcouncil.intro', '1');
    } catch {
      // storage blocked; the intro will just play again next time
    }
  }, []);

  const scene = useMemo(() => sceneFrom(conversation, settings), [conversation, settings]);
  const show = useShow(scene, scene.question, currentId);

  useEffect(() => {
    if (!soundOn) return;
    const arm = () => {
      setSoundEnabled(true);
      unlockVoice();
    };
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A new stage pulls the camera back from whoever you clicked on
  useEffect(() => setFocus(null), [scene.phase]);

  // Frame the council in the space the panel leaves free
  const offset = wide ? { x: (440 + 16) / 2, y: 0 } : { x: 0, y: Math.round(h * 0.23) };
  // the space the chamber actually gets once the panel is in place
  const freeAspect = wide ? (w - 456) / h : w / h;
  const freeHeight = wide ? 1 : 0.4;

  const refresh = () => {
    setConversations(storage.listConversations());
    setStats(storage.getStats());
  };

  const openConversation = (id) => {
    setCurrentId(id);
    setConversation(storage.getConversation(id));
    setDrawerOpen(false);
  };

  const handleNewConversation = () => {
    // A fresh empty screen; the conversation is only saved once you ask something
    setCurrentId(null);
    setConversation(null);
    setDrawerOpen(false);
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

      case 'script':
        // the episode's script arrived; the director picks it up from here
        updateLive((msg) => {
          msg.script = event.lines;
        });
        break;

      default:
        break;
    }
  };

  const handleSendMessage = async (question) => {
    // Asking from the empty screen starts a new conversation
    let id = currentId;
    if (!id) {
      id = storage.createConversation().id;
      setCurrentId(id);
      setConversations(storage.listConversations());
    }

    const current = storage.getConversation(id);
    const history = storage.conversationHistory(current);
    const isFirstMessage = current.messages.length === 0;

    setIsLoading(true);
    // the send click counts as permission for the cast to speak later
    if (soundOn) unlockVoice();

    if (!soundOn) {
      try {
        if (!localStorage.getItem('llmcouncil.soundNudge')) {
          localStorage.setItem('llmcouncil.soundNudge', '1');
          setNudge(true);
        }
      } catch {
        // nothing to do
      }
    }

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

      // Persist the finished exchange, including judges that failed, so the
      // record is honest about who took part
      const finished = {
        ...liveRef.current,
        title,
        messages: [
          ...liveRef.current.messages.slice(0, -1),
          {
            role: 'assistant',
            stage1: result.opinions,
            stage2: result.allReviews,
            stage3: result.verdict,
            metadata: result.metadata,
            script: result.script,
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
    <div className="relative h-full">
      <Suspense fallback={null}>
        <Chamber
          council={scene.council}
          chairman={scene.chairman}
          phase={scene.phase}
          show={show}
          focus={focus}
          onFocus={setFocus}
          offset={offset}
          freeAspect={freeAspect}
          freeHeight={freeHeight}
          intro={introOnce.current}
          lite={!wide}
          onReady={() => setChamberReady(true)}
        />
      </Suspense>

      <ShowOverlay show={show} wide={wide} chairModel={scene.chairman?.model} />

      <TopBar
        stats={stats}
        soundOn={soundOn}
        onToggleSound={() => toggleSound(!soundOn)}
        live={isLoading}
        onOpenMenu={() => setDrawerOpen(true)}
        onNewConversation={handleNewConversation}
        onOpenSettings={() => setShowSettings(true)}
      />

      <Sidebar
        conversations={conversations}
        currentConversationId={currentId}
        onSelectConversation={openConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
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

      {nudge && !soundOn && (
        <SoundNudge
          onEnable={() => {
            toggleSound(true);
            setNudge(false);
          }}
          onDismiss={() => setNudge(false)}
        />
      )}

      {introPlaying && <IntroLoader ready={chamberReady} onDone={finishIntro} />}
    </div>
  );
}
