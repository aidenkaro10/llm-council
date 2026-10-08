/**
 * The cast's voices, using the browser's built-in text-to-speech. Free, no
 * downloads, nothing sent anywhere. Each character gets their own voice and
 * delivery, and lines wait for the speaker to finish.
 *
 * Voices only play while sound is on. Without them, lines still show as
 * captions, held long enough to read.
 */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

// How each character sounds: pitch and pace, and which system voices suit
// them best, in order of preference. Whatever the device has, we pick the
// closest match and avoid giving two characters the same voice.
const PROFILES = {
  openai: { pitch: 1.0, rate: 1.06, prefer: ['Alex', 'Aaron', 'Tom', 'Evan', 'Nathan', 'Google US English'] },
  anthropic: { pitch: 1.06, rate: 0.97, prefer: ['Samantha', 'Ava', 'Allison', 'Susan', 'Zoe', 'Google US English'] },
  google: { pitch: 1.18, rate: 1.12, prefer: ['Karen', 'Tessa', 'Moira', 'Fiona', 'Serena', 'Google UK English Female'] },
  'x-ai': { pitch: 0.9, rate: 1.04, prefer: ['Rishi', 'Tom', 'Evan', 'Nathan', 'Aaron', 'Google UK English Male'] },
  'meta-llama': { pitch: 1.08, rate: 1.06, prefer: ['Moira', 'Fiona', 'Veena', 'Victoria'] },
  mistralai: { pitch: 0.96, rate: 0.98, prefer: ['Thomas', 'Oliver', 'Arthur'] },
  deepseek: { pitch: 1.0, rate: 1.1, prefer: ['Rishi', 'Lekha', 'Aaron'] },
  chair: { pitch: 0.82, rate: 0.92, prefer: ['Daniel', 'Arthur', 'Oliver', 'Google UK English Male'] },
  default: { pitch: 1.0, rate: 1.0, prefer: ['Allison', 'Tom', 'Victoria'] },
};

// Novelty voices (singing, bells, whispering) and the more robotic system
// voices would wreck the realism, so they're never chosen
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|junior|kathy|ralph|fred/i;
const ROBOTIC = /eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley/i;

// voices that sound noticeably better than the basic ones, where available
const QUALITY = /natural|neural|premium|enhanced|siri|google/i;

let voices = [];
const assigned = new Map();

function loadVoices() {
  if (!synth) return;
  const english = synth.getVoices().filter((v) => /^en/i.test(v.lang) && !NOVELTY.test(v.name));
  // natural voices first, the robotic ones only as a last resort
  voices = [...english.filter((v) => !ROBOTIC.test(v.name)), ...english.filter((v) => ROBOTIC.test(v.name))];
}

if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', () => {
    loadVoices();
    assigned.clear();
  });
}

function profileFor(key) {
  return PROFILES[key] || PROFILES.default;
}

/** Pick a voice for a character, different from everyone else's if we can. */
function voiceFor(key) {
  if (assigned.has(key)) return assigned.get(key);
  if (!voices.length) return null;

  const taken = new Set(assigned.values());
  const { prefer } = profileFor(key);
  const free = voices.filter((v) => !taken.has(v));
  const pool = free.length ? free : voices;

  // the preferred name, in its best installed version if there is one
  const byName = prefer
    .map((name) => {
      const matches = pool.filter((v) => v.name.split(' (')[0] === name || v.name.startsWith(name + ' '));
      return matches.find((v) => QUALITY.test(v.name)) || matches[0];
    })
    .find(Boolean);
  const good = pool.filter((v) => QUALITY.test(v.name));
  const chosen = byName || good[assigned.size % (good.length || 1)] || pool[0];

  assigned.set(key, chosen);
  return chosen;
}

export function voiceSupported() {
  return Boolean(synth);
}

/**
 * Browsers only allow speech that starts from a click. Speaking a silent
 * word during one unlocks it for the rest of the session.
 */
export function unlockVoice() {
  if (!synth) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  synth.speak(u);
}

export function stopVoice() {
  synth?.cancel();
}

/**
 * Say a line in a character's voice. Resolves when they've finished, or after
 * a sensible maximum in case the browser never reports the end.
 */
export function speak(text, key) {
  return new Promise((resolve) => {
    if (!synth) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const { pitch, rate } = profileFor(key);
    u.voice = voiceFor(key);
    u.pitch = pitch;
    u.rate = rate;
    u.volume = 1;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    // some browsers drop the end event; never hang the show waiting for it
    setTimeout(finish, 1500 + text.length * 95);
    synth.speak(u);
  });
}
