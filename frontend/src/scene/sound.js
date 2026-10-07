/**
 * The courtroom's sound, synthesised live with the Web Audio API. No audio
 * files, so nothing to download and nothing to license.
 *
 * Off by default. Browsers only allow sound after someone clicks, so the
 * engine starts the first time sound is switched on.
 */

let ctx = null;
let master = null;
let reverb = null;
let ambient = null;
let enabled = false;

function setup() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // a big hall: a burst of decaying noise as the room's echo
  reverb = ctx.createConvolver();
  const length = ctx.sampleRate * 2.4;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
    }
  }
  reverb.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  reverb.connect(wet).connect(master);
}

function noiseBuffer(seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Send a sound to the speakers, and some of it into the hall. */
function out(node, wet = 0.5) {
  node.connect(master);
  const send = ctx.createGain();
  send.gain.value = wet;
  node.connect(send).connect(reverb);
}

function envelope(gain, at, peak, attack, decay) {
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

// --- the sounds ---------------------------------------------------------------

/** A gavel on wood: a low thump and a sharp knock. Big is the final slam. */
function gavel(big = false) {
  const t = ctx.currentTime;

  const thump = ctx.createOscillator();
  thump.frequency.setValueAtTime(big ? 120 : 160, t);
  thump.frequency.exponentialRampToValueAtTime(big ? 38 : 55, t + 0.18);
  const thumpGain = ctx.createGain();
  envelope(thumpGain, t, big ? 1.4 : 0.8, 0.004, big ? 0.6 : 0.25);
  thump.connect(thumpGain);
  out(thumpGain, big ? 0.9 : 0.35);
  thump.start(t);
  thump.stop(t + 1);

  const knock = ctx.createBufferSource();
  knock.buffer = noiseBuffer(0.2);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = big ? 900 : 1400;
  band.Q.value = 3;
  const knockGain = ctx.createGain();
  envelope(knockGain, t, big ? 1.2 : 0.7, 0.002, big ? 0.12 : 0.07);
  knock.connect(band).connect(knockGain);
  out(knockGain, big ? 0.8 : 0.3);
  knock.start(t);

  if (big) {
    // the room shakes a little on the last one
    const boom = ctx.createBufferSource();
    boom.buffer = noiseBuffer(1.5);
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 180;
    const boomGain = ctx.createGain();
    envelope(boomGain, t, 0.9, 0.01, 1.2);
    boom.connect(low).connect(boomGain);
    out(boomGain, 1);
    boom.start(t);
  }
}

/** A brassy stab with a whoosh in front, for OBJECTION! and friends. */
function objection() {
  const t = ctx.currentTime;

  const whoosh = ctx.createBufferSource();
  whoosh.buffer = noiseBuffer(0.3);
  const sweep = ctx.createBiquadFilter();
  sweep.type = 'bandpass';
  sweep.Q.value = 1.2;
  sweep.frequency.setValueAtTime(400, t);
  sweep.frequency.exponentialRampToValueAtTime(3200, t + 0.18);
  const whooshGain = ctx.createGain();
  envelope(whooshGain, t, 0.35, 0.05, 0.15);
  whoosh.connect(sweep).connect(whooshGain);
  out(whooshGain, 0.3);
  whoosh.start(t);

  const stab = ctx.createGain();
  envelope(stab, t + 0.12, 0.32, 0.01, 0.35);
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2200;
  tone.connect(stab);
  out(stab, 0.6);
  [220, 330, 440, 554].forEach((f) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    osc.connect(tone);
    osc.start(t + 0.12);
    osc.stop(t + 0.6);
  });
}

// each judge gets their own register, so they sound like different characters
const VOICES = [392, 523, 330, 440, 587, 294];

/** Robot chatter: a burst of little bleeps, pitched per judge. */
function chatter(voice = 0, seconds = 2.4, low = false) {
  const base = low ? 196 : VOICES[voice % VOICES.length];
  const scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
  let t = ctx.currentTime + 0.02;
  const end = t + seconds;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2600;
  const level = ctx.createGain();
  level.gain.value = 0.09;
  filter.connect(level);
  out(level, 0.25);

  while (t < end) {
    const length = 0.04 + Math.random() * 0.07;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(base * scale[Math.floor(Math.random() * scale.length)], t);
    if (Math.random() < 0.3) {
      osc.frequency.exponentialRampToValueAtTime(base * 2, t + length);
    }
    const g = ctx.createGain();
    envelope(g, t, 1, 0.005, length);
    osc.connect(g).connect(filter);
    osc.start(t);
    osc.stop(t + length + 0.02);
    // pause like speech, now and then a longer one between "words"
    t += length + 0.03 + Math.random() * (Math.random() < 0.2 ? 0.25 : 0.06);
  }
}

/** A crackle of electricity, for the beams between arguing judges. */
function zap() {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.4);
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 2500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < 8; i++) {
    g.gain.setValueAtTime(Math.random() * 0.18, t + i * 0.04);
  }
  g.gain.setValueAtTime(0.0001, t + 0.34);
  src.connect(high).connect(g);
  out(g, 0.3);
  src.start(t);
}

/** The winner is crowned: a rising arpeggio into a held chord. */
function fanfare() {
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = ctx.createGain();
    const at = t + i * 0.11;
    const last = i === notes.length - 1;
    envelope(g, at, 0.3, 0.01, last ? 1.4 : 0.22);
    osc.connect(g);
    out(g, 0.6);
    osc.start(at);
    osc.stop(at + (last ? 1.6 : 0.3));
  });
  // a soft chord underneath the last note
  [523.25, 659.25, 783.99].forEach((f) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f / 2;
    const g = ctx.createGain();
    envelope(g, t + 0.33, 0.12, 0.08, 1.5);
    osc.connect(g);
    out(g, 0.7);
    osc.start(t + 0.33);
    osc.stop(t + 2);
  });
}

// --- the studio audience ----------------------------------------------------

/** A crowd of voices through vowel filters: the building block for reactions. */
function crowd({ voices = 10, vowel, length, pitch = [150, 280], chop = 0, glide = 0.85, level = 0.05 }) {
  const t = ctx.currentTime;
  // formant frequencies give the vowel its shape: "oo" or "ah"
  const formants = vowel === 'oo' ? [320, 800] : [760, 1150];
  const bus = ctx.createGain();
  envelope(bus, t, level, 0.12, length);
  out(bus, 0.5);
  const filters = formants.map((f) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 5;
    bp.connect(bus);
    return bp;
  });

  for (let v = 0; v < voices; v++) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const start = pitch[0] + Math.random() * (pitch[1] - pitch[0]);
    const at = t + Math.random() * 0.12;
    osc.frequency.setValueAtTime(start, at);
    osc.frequency.exponentialRampToValueAtTime(start * glide, at + length);
    const g = ctx.createGain();
    g.gain.value = 0.5 + Math.random() * 0.5;
    // laughing is the vowel chopped into "ha-ha-ha"
    if (chop) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = chop * (0.8 + Math.random() * 0.4);
      const depth = ctx.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth).connect(g.gain);
      lfo.start(at);
      lfo.stop(at + length + 0.2);
    }
    osc.connect(g);
    filters.forEach((f) => g.connect(f));
    osc.start(at);
    osc.stop(at + length + 0.3);
  }
}

function laugh() {
  crowd({ vowel: 'ah', length: 1.5, chop: 6, glide: 0.75, level: 0.06 });
}

function ooh() {
  crowd({ vowel: 'oo', length: 1.1, pitch: [170, 300], glide: 0.8, level: 0.07 });
}

/** A sharp intake of breath from the crowd. */
function gasp() {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.6);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.linearRampToValueAtTime(1800, t + 0.3);
  bp.Q.value = 1.5;
  const g = ctx.createGain();
  envelope(g, t, 0.25, 0.08, 0.35);
  src.connect(bp).connect(g);
  out(g, 0.6);
  src.start(t);
}

/** Applause: lots of tiny claps, building and fading. */
function applause(seconds = 2.6) {
  const t = ctx.currentTime;
  const clap = noiseBuffer(0.03);
  const bus = ctx.createGain();
  bus.gain.value = 0.35;
  out(bus, 0.7);
  const claps = Math.floor(seconds * 70);
  for (let i = 0; i < claps; i++) {
    // denser in the middle, like a real round of applause
    const u = Math.random();
    const at = t + seconds * (u < 0.5 ? Math.sqrt(u / 2) : 1 - Math.sqrt((1 - u) / 2));
    const src = ctx.createBufferSource();
    src.buffer = clap;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 2200;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    envelope(g, at, 0.2 + Math.random() * 0.5, 0.002, 0.04);
    src.connect(bp).connect(g).connect(bus);
    src.start(at);
  }
}

/** The low hum of a big quiet room, under everything while sound is on. */
function startAmbient() {
  if (ambient) return;
  const t = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.exponentialRampToValueAtTime(0.05, t + 2.5);
  bus.connect(master);

  const nodes = [55, 82.4, 110.3].map((f, i) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    osc.detune.value = i * 4;
    const g = ctx.createGain();
    g.gain.value = i === 0 ? 0.6 : 0.25;
    osc.connect(g).connect(bus);
    osc.start();
    return osc;
  });

  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(4);
  air.loop = true;
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 420;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.5;
  air.connect(soft).connect(airGain).connect(bus);
  air.start();

  ambient = { bus, nodes: [...nodes, air] };
}

function stopAmbient() {
  if (!ambient) return;
  const { bus, nodes } = ambient;
  const t = ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  nodes.forEach((n) => n.stop(t + 0.7));
  ambient = null;
}

// --- the controls the app uses ----------------------------------------------

const SOUNDS = { gavel, objection, chatter, zap, fanfare, laugh, ooh, gasp, applause };

export function setSoundEnabled(on) {
  enabled = on;
  if (on) {
    setup();
    ctx.resume();
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
    master.gain.exponentialRampToValueAtTime(0.7, t + 0.3);
    startAmbient();
  } else if (ctx) {
    stopAmbient();
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  }
}

export function soundEnabled() {
  return enabled;
}

/** Play a named sound if sound is on. Does nothing otherwise. */
export function sfx(name, ...args) {
  if (!enabled || !ctx || !SOUNDS[name]) return;
  try {
    SOUNDS[name](...args);
  } catch {
    // a sound failing should never break the show
  }
}
