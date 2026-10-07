/**
 * Small text fixes for what's on screen while answers stream in.
 */

/**
 * Bold or italic markers can arrive before their closing partner, which shows
 * raw asterisks for a moment. Close any that are still open.
 */
export function balanceMarkdown(text) {
  let out = text || '';
  if ((out.match(/\*\*/g) || []).length % 2) out += '**';
  const singles = out.replace(/\*\*/g, '').match(/\*/g) || [];
  if (singles.length % 2) out += '*';
  return out;
}

/**
 * Judges review "Response A", "Response B" and so on, because the review is
 * blind. For display only, swap in the model each label stands for.
 */
export function nameNames(text, labels) {
  if (!text || !labels) return text || '';
  let out = text;
  // longest labels first, so "Response A" never clips part of a longer one
  for (const [label, model] of Object.entries(labels).sort((a, b) => b[0].length - a[0].length)) {
    out = out.replaceAll(label, model.split('/')[1] || model);
  }
  return out;
}
