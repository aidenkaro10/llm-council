/**
 * Conversations and settings, kept in this browser's localStorage.
 *
 * Nothing is uploaded anywhere. Clearing your browser data clears these.
 */

const CONVERSATIONS_KEY = 'llmcouncil.conversations';
const CONVERSATION_PREFIX = 'llmcouncil.conversation.';
const SETTINGS_KEY = 'llmcouncil.settings';

const DEFAULT_SETTINGS = {
  apiKey: '',
  councilModels: [
    'openai/gpt-5.6-terra',
    'google/gemini-3.1-pro-preview',
    'anthropic/claude-sonnet-5',
    'x-ai/grok-4.6',
  ],
  chairmanModel: 'anthropic/claude-sonnet-5',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    // private browsing, or someone cleared storage mid-session
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // out of space or storage blocked; nothing useful to do about it
  }
}

// --- settings --------------------------------------------------------------

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write(SETTINGS_KEY, next);
  return next;
}

export function hasApiKey() {
  return Boolean(getSettings().apiKey);
}

/** A safe-to-show version of the key, e.g. sk-or-v1-abc...7f9x */
export function keyPreview() {
  const key = getSettings().apiKey;
  if (!key) return null;
  return key.length > 20 ? `${key.slice(0, 12)}...${key.slice(-4)}` : 'set';
}

// --- conversations ---------------------------------------------------------

export function listConversations() {
  return read(CONVERSATIONS_KEY, []);
}

export function getConversation(id) {
  return read(CONVERSATION_PREFIX + id, null);
}

export function createConversation() {
  const conversation = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    title: 'New Conversation',
    messages: [],
  };

  write(CONVERSATION_PREFIX + conversation.id, conversation);
  write(CONVERSATIONS_KEY, [
    { id: conversation.id, created_at: conversation.created_at, title: conversation.title, message_count: 0 },
    ...listConversations(),
  ]);

  return conversation;
}

export function saveConversation(conversation) {
  write(CONVERSATION_PREFIX + conversation.id, conversation);
  write(
    CONVERSATIONS_KEY,
    listConversations().map((c) =>
      c.id === conversation.id
        ? { ...c, title: conversation.title, message_count: conversation.messages.length }
        : c
    )
  );
}

export function deleteConversation(id) {
  try {
    localStorage.removeItem(CONVERSATION_PREFIX + id);
  } catch {
    // nothing to do
  }
  write(CONVERSATIONS_KEY, listConversations().filter((c) => c.id !== id));
}

/** Total spent and questions asked, across everything stored here. */
export function getStats() {
  let total_cost = 0;
  let question_count = 0;

  for (const meta of listConversations()) {
    const conversation = getConversation(meta.id);
    if (!conversation) continue;
    for (const message of conversation.messages) {
      if (message.role === 'assistant') {
        total_cost += message.cost || 0;
        question_count += 1;
      }
    }
  }

  return { total_cost, question_count };
}

/** Earlier question/answer pairs, so follow-ups have context. */
export function conversationHistory(conversation) {
  const history = [];
  let question = null;

  for (const message of conversation.messages) {
    if (message.role === 'user') {
      question = message.content;
    } else if (question) {
      history.push({ question, answer: message.stage3?.text || message.stage3?.response || '' });
      question = null;
    }
  }

  return history;
}
