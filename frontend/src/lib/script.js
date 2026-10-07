/**
 * The episode's script: once the judges have answered, a fast, cheap model
 * turns their real disagreement into a short comedy scene for them to act.
 *
 * It runs alongside the review and the verdict, so it never makes you wait,
 * and if it fails the show simply carries on without it.
 */

import { askOnce } from './openrouter.js';
import { personaFor } from './personas.js';

// fast and cheap; writing ten short lines costs about a third of a cent
export const SCRIPT_MODEL = 'google/gemini-3.7-flash';

export const EMOTIONS = ['smug', 'angry', 'shocked', 'happy', 'annoyed', 'laughing', 'sad', 'neutral'];
export const ACTIONS = ['point', 'slam', 'facepalm', 'shrug', 'laugh', 'objection', 'none'];
export const CROWD = ['laugh', 'ooh', 'gasp', 'applause', 'none'];

const MAX_LINE = 110;

export function buildScriptPrompt(question, answers) {
  const cast = answers
    .map((a) => {
      const p = personaFor(a.model);
      const said = (a.text || '').replace(/\s+/g, ' ').slice(0, 550);
      return `- ${a.model} plays "${p.nickname}": ${p.trait}.\n  What they actually answered: "${said}"`;
    })
    .join('\n');

  return `You write a short, funny sitcom scene. Several AI judges just answered the same question and are about to argue about who got it right. Turn their real disagreement into a quick comedic exchange.

The question: "${question}"

The cast (keep everyone in character):
${cast}

Write 8 to 10 lines of dialogue.
- Every joke comes from what they really said. The disagreement is the comedy.
- Short and punchy: every line under 85 characters.
- Playful roasting only. Nothing mean-spirited, nothing offensive.
- Mix it up: comebacks, interruptions, someone switching sides, a callback near the end.
- Nobody announces the final verdict; the chairman does that later.

Reply with JSON only, no other text:
{"lines":[{"who":"<judge id>","say":"<line>","to":"<judge id or null>","emotion":"${EMOTIONS.join('|')}","action":"${ACTIONS.join('|')}","crowd":"${CROWD.join('|')}"}]}`;
}

/**
 * Turn the writer's reply into lines we can trust: known speakers only,
 * known emotions and actions only, lines a sensible length.
 */
export function parseScript(text, models) {
  if (!text) return [];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return [];

  let data;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }

  // writers sometimes say "gpt-5.6-terra" instead of "openai/gpt-5.6-terra"
  const resolve = (name) => {
    if (!name || typeof name !== 'string') return null;
    const n = name.toLowerCase().trim();
    return (
      models.find((m) => m.toLowerCase() === n) ||
      models.find((m) => m.toLowerCase().endsWith('/' + n)) ||
      models.find((m) => m.toLowerCase().includes(n)) ||
      null
    );
  };

  const pickFrom = (value, allowed, fallback) =>
    allowed.includes(String(value).toLowerCase()) ? String(value).toLowerCase() : fallback;

  return (Array.isArray(data.lines) ? data.lines : [])
    .map((line) => {
      const who = resolve(line?.who);
      let say = typeof line?.say === 'string' ? line.say.replace(/\s+/g, ' ').trim() : '';
      if (!who || !say) return null;
      if (say.length > MAX_LINE) say = say.slice(0, MAX_LINE - 3).trimEnd() + '...';
      const to = resolve(line.to);
      return {
        who,
        say,
        to: to && to !== who ? to : null,
        emotion: pickFrom(line.emotion, EMOTIONS, 'neutral'),
        action: pickFrom(line.action, ACTIONS, 'none'),
        crowd: pickFrom(line.crowd, CROWD, 'none'),
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

/** Ask the writer for the scene. Never throws; an empty script just means no scene. */
export async function writeScript(apiKey, question, answers) {
  try {
    const { text, cost } = await askOnce(
      apiKey,
      SCRIPT_MODEL,
      [{ role: 'user', content: buildScriptPrompt(question, answers) }],
      { response_format: { type: 'json_object' }, max_tokens: 900, temperature: 1 }
    );
    return { lines: parseScript(text, answers.map((a) => a.model)), cost };
  } catch {
    return { lines: [], cost: 0 };
  }
}
