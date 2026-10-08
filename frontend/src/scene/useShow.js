import { useEffect, useRef, useState } from 'react';
import { sfx, soundEnabled } from './sound';
import { speak, stopVoice, voiceSupported } from './voice';
import { personaFor, CHAIR_LINES, pick } from '../lib/personas';

/**
 * The director. Runs the proceedings on top of the council's real progress:
 *
 *   1. The judge opens court; the case comes up.
 *   2. Opening statements: each lawyer stands and introduces themselves.
 *   3. The argument: once the script arrives (written from the real debate),
 *      counsel perform it, line by line, each waiting for the last to finish.
 *      Until then, and between lines, the room breathes: short asides, pauses.
 *   4. The judge cuts it off, the votes come in, the winner and loser react.
 *   5. The ruling: the judge reads it out and bangs the gavel.
 *
 * Nothing here delays the answer. The show only fills time spent waiting.
 */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// when a lawyer is addressed, how they take it
const REACTIONS = {
  angry: 'shocked',
  smug: 'annoyed',
  laughing: 'annoyed',
  shocked: 'smug',
  happy: 'annoyed',
  annoyed: 'smug',
  sad: 'smug',
  neutral: 'annoyed',
};

const EMPTY = {
  crowd: null,
  round: null,
  voice: null,
  reactor: null,
  slams: {},
  caseCard: null,
  scoreCard: null,
  lines: {},
  emotions: {},
  gestures: {},
};

/** How long a line stays up without a voice: long enough to read comfortably. */
const readingTime = (text) => Math.min(6000, 1400 + text.length * 42);

/** The first sentence of the ruling, for the judge to read out. */
function firstSentence(text) {
  const clean = (text || '').replace(/[*_#`>]/g, '').replace(/\s+/g, ' ').trim();
  const match = clean.match(/^(.{12,170}?[.!?])(\s|$)/);
  return match ? match[1] : clean.slice(0, 140);
}

export default function useShow(scene, question, caseKey) {
  const [show, setShow] = useState(EMPTY);
  const latest = useRef(scene);
  latest.current = scene;
  const prevPhase = useRef(scene.phase);
  const run = useRef(0); // bumping this cancels whatever is in progress
  const queue = useRef([]);
  const scripted = useRef(false);
  const looping = useRef(false);
  const results = useRef(false);
  const talking = useRef(null); // resolves when whoever is speaking finishes

  const working = () => ['opinions', 'review'].includes(latest.current.phase) && !results.current;
  const alive = (token) => token === run.current;

  const stop = () => {
    run.current += 1;
    talking.current = null;
    queue.current = [];
    scripted.current = false;
    looping.current = false;
    results.current = false;
    stopVoice();
  };

  // --- moments -------------------------------------------------------------

  const gavel = (who = 'chair') => {
    setShow((s) => ({ ...s, slams: { ...s.slams, [who]: performance.now() } }));
    setTimeout(() => sfx('gavel', false), 290);
  };

  const cheer = (type, ...args) => {
    setShow((s) => ({ ...s, crowd: { type, at: performance.now() } }));
    sfx(type, ...args);
  };

  const round = (kicker, title) => {
    const at = performance.now();
    setShow((s) => ({ ...s, round: { kicker, title, at } }));
    setTimeout(() => setShow((s) => (s.round?.at === at ? { ...s, round: null } : s)), 2600);
  };

  /**
   * Someone speaks a line. Captions show it, the voice says it if sound is
   * on, and this resolves when they've finished. Returns false if the show
   * moved on in the meantime.
   */
  const line = async (token, who, text, { emotion, gesture, target } = {}) => {
    if (!alive(token)) return false;
    const at = performance.now();
    setShow((s) => ({
      ...s,
      voice: who,
      reactor: null,
      lines: { [who]: { text, at } },
      emotions: emotion ? { ...s.emotions, [who]: { e: emotion, at } } : s.emotions,
      gestures:
        gesture && gesture !== 'none'
          ? { ...s.gestures, [who]: { type: gesture, at, target: target || null } }
          : s.gestures,
    }));

    const voiced = soundEnabled() && voiceSupported();
    const key = who === 'chair' ? 'chair' : who.split('/')[0];
    // give the eye a moment even for very short spoken lines
    const done = voiced ? Promise.all([speak(text, key), wait(900)]) : wait(readingTime(text));
    talking.current = done;
    await done;

    if (!alive(token)) return false;
    setShow((s) => (s.lines[who]?.at === at ? { ...s, lines: {}, voice: null } : s));
    await wait(320);
    return alive(token);
  };

  /** The one being addressed reacts, and the camera cuts to them. */
  const react = (who, emotion, gesture) => {
    const at = performance.now();
    setShow((s) => ({
      ...s,
      reactor: { who, at },
      emotions: { ...s.emotions, [who]: { e: emotion, at } },
      gestures: gesture && gesture !== 'none' ? { ...s.gestures, [who]: { type: gesture, at } } : s.gestures,
    }));
  };

  const perform = async (token, l) => {
    const gesture = l.action === 'objection' ? 'point' : l.action;
    if (l.action === 'slam') setTimeout(() => gavel(l.who), 150);
    if (l.to) {
      // a beat into the line, the target reacts
      const delay = soundEnabled() ? 900 + l.say.length * 25 : readingTime(l.say) * 0.55;
      setTimeout(() => alive(token) && react(l.to, REACTIONS[l.emotion] || 'annoyed', pick(['facepalm', 'shrug', 'none'])), delay);
    }
    const ok = await line(token, l.who, l.say, { emotion: l.emotion, gesture, target: l.to });
    if (ok && l.crowd && l.crowd !== 'none') cheer(l.crowd);
    return ok;
  };

  /** Fill the room until the judge rules: the script, or the odd aside. */
  const loop = async (token) => {
    if (looping.current) return;
    looping.current = true;
    while (alive(token) && working()) {
      if (queue.current.length) {
        if (!(await perform(token, queue.current.shift()))) break;
        continue;
      }
      // nothing written yet: a short aside, then a pause, like a real room
      const cast = latest.current.council.filter((j) => j.state !== 'failed');
      if (cast.length) {
        const who = pick(cast);
        const others = cast.filter((j) => j.model !== who.model);
        const target = others.length && Math.random() < 0.35 ? pick(others).model : null;
        if (!(await line(token, who.model, pick(personaFor(who.model).adlibs), {
          emotion: pick(['smug', 'annoyed', 'neutral']),
          gesture: target ? 'point' : 'none',
          target,
        }))) break;
      }
      await wait(1400 + Math.random() * 1600);
    }
    if (alive(token)) looping.current = false;
  };

  // --- the proceedings ---------------------------------------------------------

  // A different conversation opened: clear the stage. Declared first so it runs
  // before the phase effect; asking from the empty screen does both at once,
  // and the new case must win.
  useEffect(() => {
    stop();
    setShow(EMPTY);
  }, [caseKey]);

  useEffect(() => {
    const from = prevPhase.current;
    const to = scene.phase;
    prevPhase.current = to;
    if (from === to) return;

    if (to === 'opinions') {
      stop();
      const token = run.current;
      setShow({ ...EMPTY, caseCard: { question, at: performance.now() } });
      (async () => {
        for (const ms of [0, 380, 380]) {
          await wait(ms);
          if (!alive(token)) return;
          gavel('chair');
        }
        await wait(600);
        if (!(await line(token, 'chair', pick(CHAIR_LINES.open), { emotion: 'neutral' }))) return;
        setShow((s) => ({ ...s, caseCard: null }));
        round('ROUND 1', 'Opening statements');
        if (!(await line(token, 'chair', pick(CHAIR_LINES.begin), { emotion: 'neutral' }))) return;
        for (const judge of latest.current.council.filter((j) => j.state !== 'failed')) {
          if (!working()) return;
          // the real argument is ready: skip straight to it
          if (queue.current.length || latest.current.phase !== 'opinions') break;
          if (!(await line(token, judge.model, pick(personaFor(judge.model).intros), { emotion: pick(['happy', 'smug', 'neutral']) }))) return;
          if (Math.random() < 0.3) cheer('laugh');
        }
        loop(token);
      })();
    }

    if (to === 'review') {
      round('ROUND 2', 'The argument');
      setTimeout(() => cheer('ooh'), 400);
    }

    if (to === 'verdict' && from === 'review') {
      // the judge cuts it off; the votes come in; winner and loser react.
      // Whoever is mid-sentence gets to finish it first (up to a few seconds).
      const finishing = talking.current;
      run.current += 1;
      queue.current = [];
      looping.current = false;
      results.current = true;
      const token = run.current;
      const ranks = scene.rankings || [];
      (async () => {
        await Promise.race([finishing, wait(3500)]);
        stopVoice();
        if (!alive(token)) return;
        setShow((s) => ({ ...s, voice: null, reactor: null, lines: {}, round: null }));
        await wait(250);
        gavel('chair');
        if (!(await line(token, 'chair', pick(CHAIR_LINES.verdict), { emotion: 'neutral' }))) return;
        setShow((s) => ({ ...s, scoreCard: { rankings: ranks, at: performance.now() } }));
        cheer('ooh');
        setTimeout(() => setShow((s) => ({ ...s, scoreCard: null })), 4200);
        await wait(1200);
        if (ranks.length) {
          const winner = ranks[0].model;
          if (!(await line(token, winner, pick(personaFor(winner).victory), { emotion: 'happy', gesture: 'laugh' }))) return;
        }
        if (ranks.length > 1) {
          const loser = ranks[ranks.length - 1].model;
          if (!(await line(token, loser, pick(personaFor(loser).defeat), { emotion: 'sad', gesture: 'facepalm' }))) return;
          cheer('laugh');
        }
        if (alive(token)) round('FINAL ROUND', 'The ruling');
      })();
    }

    if (to === 'done' && from === 'verdict') {
      // the ruling, read out, and the final gavel
      stop();
      const token = run.current;
      const ruling = firstSentence(latest.current.chairman?.text);
      (async () => {
        if (ruling && !(await line(token, 'chair', ruling, { emotion: 'neutral' }))) return;
        gavel('chair');
        setTimeout(() => cheer('applause', 3), 300);
        const winner = latest.current.rankings?.[0]?.model;
        if (winner) setShow((s) => ({ ...s, emotions: { [winner]: { e: 'happy', at: performance.now() } } }));
      })();
    }

    if (to === 'idle' || (to === 'done' && from !== 'verdict')) {
      stop();
      setShow(EMPTY);
    }
  }, [scene.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // The script arrived: counsel will perform it next
  useEffect(() => {
    if (!scene.script?.length || scripted.current || !working()) return;
    scripted.current = true;
    queue.current = [...scene.script];
  }, [scene.script]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return show;
}
