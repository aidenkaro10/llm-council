/**
 * Which colour each maker's mech is painted, shared by the arena and the
 * collapsed council summary.
 */

// xAI's brand is black, which would vanish on the dark arena, so it gets chrome
const BRAND_COLORS = {
  openai: '#12d18e',
  google: '#4b8bff',
  anthropic: '#ff6b35',
  'x-ai': '#dfe3e8',
  'meta-llama': '#1f7bff',
  mistralai: '#ff8a00',
  deepseek: '#5b7cff',
  qwen: '#8b5cff',
  cohere: '#39c48a',
  perplexity: '#22b8c8',
};

const FALLBACK_COLORS = ['#ff4fa3', '#ffd23f', '#00d1c1', '#b15cff', '#ff5d5d'];

export function vendorOf(model) {
  return model.split('/')[0];
}

export function shortName(model) {
  return model.split('/')[1] || model;
}

/** A maker's colour, or a stable pick from the model name for anyone else. */
export function colorFor(model) {
  const vendor = vendorOf(model);
  if (BRAND_COLORS[vendor]) return BRAND_COLORS[vendor];
  let hash = 0;
  for (const ch of model) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}
