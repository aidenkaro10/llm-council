/**
 * Talks to OpenRouter straight from the browser.
 *
 * Your API key never leaves your machine. It is kept in this browser's
 * localStorage and sent only to openrouter.ai, never to any server of ours,
 * because there is no server of ours.
 */

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CREDITS_URL = 'https://openrouter.ai/api/v1/credits';

// How often buffered text is handed to the UI. Updating on every single token
// would be wasteful; this still looks instant.
const FLUSH_MS = 100;
const FLUSH_CHARS = 60;

function headers(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    // OpenRouter uses these to credit the app on their leaderboard
    'HTTP-Referer':
      typeof window !== 'undefined' ? window.location.origin : 'https://llm-council.app',
    'X-Title': 'LLM Council',
  };
}

/** Every model OpenRouter offers, with prices converted to per-million-tokens. */
export async function listModels() {
  const response = await fetch(MODELS_URL);
  if (!response.ok) throw new Error('Could not reach OpenRouter');
  const { data } = await response.json();

  return data
    .filter((m) => !m.id.endsWith(':batch'))
    .map((m) => ({
      id: m.id,
      name: m.name || m.id,
      promptPrice: Number(m.pricing?.prompt || 0) * 1e6,
      completionPrice: Number(m.pricing?.completion || 0) * 1e6,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Your OpenRouter balance. */
export async function getCredits(apiKey) {
  const response = await fetch(CREDITS_URL, { headers: headers(apiKey) });
  if (!response.ok) throw new Error('Could not read your balance');
  const { data } = await response.json();
  const total = data.total_credits || 0;
  const used = data.total_usage || 0;
  return { total, used, remaining: total - used };
}

/**
 * One non-streaming call. Used for the conversation title and the episode's
 * script. Extra request options (like response_format) go in `options`.
 */
export async function askOnce(apiKey, model, messages, options = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ model, messages, ...options }),
  });
  if (!response.ok) {
    throw new Error(`${model}: ${await describeError(response)}`);
  }
  const data = await response.json();
  return {
    text: data.choices?.[0]?.message?.content || '',
    cost: data.usage?.cost || 0,
  };
}

/**
 * Stream one model's answer.
 *
 * onDelta(channel, text) fires as text arrives, where channel is 'content'
 * (the answer) or 'reasoning' (the model thinking out loud).
 *
 * Returns { text, cost }. Throws if the call fails.
 */
export async function streamModel(apiKey, model, messages, onDelta, signal) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`${model}: ${await describeError(response)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let sseBuffer = '';      // half-received network chunks live here
  let pending = { content: '', reasoning: '' };
  let lastFlush = Date.now();
  let full = '';
  let cost = 0;

  const flush = (force) => {
    const waiting = pending.content.length + pending.reasoning.length;
    if (!waiting) return;
    if (!force && Date.now() - lastFlush < FLUSH_MS && waiting < FLUSH_CHARS) return;
    for (const channel of ['reasoning', 'content']) {
      if (pending[channel]) {
        onDelta(channel, pending[channel]);
        pending[channel] = '';
      }
    }
    lastFlush = Date.now();
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line; keep any partial tail for later
    const events = sseBuffer.split('\n\n');
    sseBuffer = events.pop();

    for (const raw of events) {
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload.trim() === '[DONE]') continue;

        let chunk;
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }

        // The last message carries what the whole call cost
        if (chunk.usage) cost = chunk.usage.cost || cost;

        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.reasoning) pending.reasoning += delta.reasoning;
        if (delta.content) {
          pending.content += delta.content;
          full += delta.content;
        }
        flush(false);
      }
    }
  }

  flush(true);
  return { text: full, cost };
}

/** Turn an error response into something a person can act on. */
async function describeError(response) {
  let detail = '';
  try {
    const body = await response.json();
    detail = body.error?.message || '';
  } catch {
    // no JSON body, the status alone will have to do
  }

  if (response.status === 401) return 'your API key was rejected';
  if (response.status === 402) return 'you are out of OpenRouter credits';
  if (response.status === 404) return 'that model does not exist on OpenRouter';
  if (response.status === 429) return 'rate limited, slow down';
  return detail || `HTTP ${response.status}`;
}
