import { useEffect, useRef, useState } from 'react';
import { sfx } from './sound';
import { personaFor, CHAIR_LINES, pick } from '../lib/personas';

/**
 * The director. Runs the episode on top of the council's real progress:
 *
 *   1. Order in the court: the chairman opens, the case comes up.
 *   2. Entrances: each judge introduces themselves, in character.
 *   3. While they work: ad-libs. Once the script arrives (written from the
 *      real debate), the cast performs it line by line, with reactions,
 *      pointing, slams and the studio audience.
 *   4. The votes are in: the winner gloats, the loser sulks.
 *   5. The final gavel.
 *
 * Nothing here delays the answer. The show only fills time spent waiting.
 */

// how long after a slam starts the gavel actually hits (matches Mech3D)
const IMPACT_MS = 290;
// how long the result sequence holds the floor before the script carries on
const RESULTS_MS = 7000;

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// when someone gets a line aimed at them, how they react
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
  bursts: {},
  clash: null,
  shake: null,
  caseCard: null,
  scoreCard: null,
  flashAt: 0,
  lines: {},
  emotions: {},
  gestures: {},
};

/** How long a line stays up: long enough to read, never sluggish. */
const lineLength = (text) => Math.min(5200, Math.max(2100, 1400 + text.length * 44));

export default function useShow(scene, question, caseKey) {
  const [show, setShow] = useState(EMPTY);
  const latest = useRef(scene);
  latest.current = scene;
  const prevPhase = useRef(scene.phase);
  const timers = useRef([]);
  const queue = useRef([]);
  const scripted = useRef(false);
  const loopOn = useRef(false);
  const holdUntil = useRef(0);

  const later = (ms, fn) => timers.current.push(setTimeout(fn, ms));
  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    queue.current = [];
    scripted.current = false;
    loopOn.current = false;
    holdUntil.current = 0;
  };

  const voiceIndex = (actor) => Math.max(0, latest.current.council.findIndex((j) => j.model === actor));
  const working = () => ['opinions', 'review', 'verdict'].includes(latest.current.phase);

  // --- the actors' moves -----------------------------------------------------

  /** A gavel slam: animation now, sound and shake when it actually lands. */
  const slam = (who, { big = false } = {}) => {
    const now = performance.now();
    setShow((s) => ({ ...s, slams: { ...s.slams, [who]: now } }));
    later(IMPACT_MS, () => {
      sfx('gavel', big);
      if (!reducedMotion) {
        setShow((s) => ({ ...s, shake: { at: performance.now(), strength: big ? 0.22 : 0.05 } }));
      }
    });
  };

  const outburst = (who, word) => {
    const at = performance.now();
    setShow((s) => ({ ...s, bursts: { ...s.bursts, [who]: { word, at } } }));
    sfx('objection');
    later(1300, () =>
      setShow((s) => {
        if (s.bursts[who]?.at !== at) return s;
        const bursts = { ...s.bursts };
        delete bursts[who];
        return { ...s, bursts };
      })
    );
  };

  /** Someone says a line: bubble, face, body, voice. Returns how long it lasts. */
  const say = (who, text, { emotion, gesture, target } = {}) => {
    const at = performance.now();
    const ms = lineLength(text);
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
    sfx('chatter', voiceIndex(who), Math.min(ms / 1000 - 0.4, 3.2), who === 'chair');
    later(ms, () =>
      setShow((s) => {
        if (s.lines[who]?.at !== at) return s;
        const lines = { ...s.lines };
        delete lines[who];
        return { ...s, lines };
      })
    );
    return ms;
  };

  /** The one being talked about reacts, and the camera cuts to them. */
  const react = (who, emotion, gesture) => {
    const at = performance.now();
    setShow((s) => ({
      ...s,
      reactor: { who, at },
      emotions: { ...s.emotions, [who]: { e: emotion, at } },
      gestures: gesture && gesture !== 'none' ? { ...s.gestures, [who]: { type: gesture, at } } : s.gestures,
    }));
  };

  /** The studio audience reacts: sound and the robots in the gallery, together. */
  const cheer = (type, ...args) => {
    setShow((s) => ({ ...s, crowd: { type, at: performance.now() } }));
    sfx(type, ...args);
  };

  /** A game-show round banner over the stage. */
  const round = (kicker, title) => {
    const at = performance.now();
    setShow((s) => ({ ...s, round: { kicker, title, at } }));
    later(2600, () => setShow((s) => (s.round?.at === at ? { ...s, round: null } : s)));
  };

  const beam = (from, to) => {
    setShow((s) => ({ ...s, clash: { from, to, at: performance.now() } }));
    later(90, () => sfx('zap'));
  };

  // --- performing the script --------------------------------------------------

  const perform = (line) => {
    const gesture = line.action === 'objection' ? 'point' : line.action;
    const ms = say(line.who, line.say, { emotion: line.emotion, gesture, target: line.to });

    if (line.action === 'slam') slam(line.who);
    if (line.action === 'objection') outburst(line.who, 'OBJECTION!');
    if (line.to && ['point', 'objection', 'slam'].includes(line.action)) beam(line.who, line.to);
    else setShow((s) => ({ ...s, clash: null }));

    if (line.to) {
      later(ms * 0.55, () =>
        react(line.to, REACTIONS[line.emotion] || 'annoyed', pick(['facepalm', 'shrug', 'none']))
      );
    }
    if (line.crowd && line.crowd !== 'none') later(ms * 0.8, () => cheer(line.crowd));
    return ms;
  };

  /** Fill the room until the verdict: the script when we have it, ad-libs otherwise. */
  const loop = () => {
    if (!loopOn.current || !working()) {
      loopOn.current = false;
      return;
    }
    const wait = holdUntil.current - performance.now();
    if (wait > 0) {
      later(wait, loop);
      return;
    }

    const phase = latest.current.phase;
    let ms;

    if (queue.current.length) {
      ms = perform(queue.current.shift());
    } else if (phase === 'opinions' || phase === 'review') {
      // nothing written yet, or it's all been said: ad-lib
      const cast = latest.current.council.filter((j) => j.state !== 'failed');
      if (cast.length) {
        const who = pick(cast);
        const others = cast.filter((j) => j.model !== who.model);
        const target = others.length && Math.random() < 0.4 ? pick(others).model : null;
        ms = say(who.model, pick(personaFor(who.model).adlibs), {
          emotion: pick(['smug', 'annoyed', 'neutral', 'happy']),
          gesture: target ? 'point' : pick(['shrug', 'none', 'none']),
          target,
        });
        // tempers flare in cross-examination
        if (phase === 'review' && Math.random() < 0.45) {
          later(ms * 0.4, () =>
            Math.random() < 0.5 ? outburst(pick(cast).model, pick(['OBJECTION!', 'HEARSAY!', 'OVERRULED!'])) : slam(pick(cast).model)
          );
        }
      }
    } else {
      // the chairman has the floor; the cast waits
      loopOn.current = false;
      return;
    }

    later((ms || 2400) + 380, loop);
  };

  const startLoop = (delay = 0) => {
    if (loopOn.current) return;
    loopOn.current = true;
    later(delay, loop);
  };

  // --- the big set pieces, on phase changes -----------------------------------

  // A different conversation opened: drop whatever was on stage. Declared first
  // so it runs before the phase effect; asking from the empty screen opens a
  // conversation and calls the case in the same moment, and the case must win.
  useEffect(() => {
    clearAll();
    setShow(EMPTY);
  }, [caseKey]);

  useEffect(() => {
    const from = prevPhase.current;
    const to = scene.phase;
    prevPhase.current = to;
    if (from === to) return;

    if (to === 'opinions') {
      // a new case: order in the court, then the cast makes its entrances
      clearAll();
      setShow({ ...EMPTY, caseCard: { question, at: performance.now() } });
      [0, 380, 760].forEach((ms) => later(ms, () => slam('chair')));
      later(950, () => say('chair', pick(CHAIR_LINES.open), { emotion: 'neutral' }));
      later(2700, () => setShow((s) => ({ ...s, caseCard: null })));
      later(2800, () => round('ROUND 1', 'Opening arguments'));

      const cast = latest.current.council.filter((j) => j.state !== 'failed');
      cast.forEach((judge, i) => {
        later(3000 + i * 2900, () => {
          if (latest.current.phase !== 'opinions' && latest.current.phase !== 'review') return;
          say(judge.model, pick(personaFor(judge.model).intros), {
            emotion: pick(['happy', 'smug']),
            gesture: 'wave',
          });
          if (Math.random() < 0.35) later(1600, () => cheer('laugh'));
        });
      });
      // the script waits until everyone has made their entrance
      holdUntil.current = performance.now() + 3000 + cast.length * 2900 + 300;
      startLoop(3000 + cast.length * 2900 + 300);
    }

    if (to === 'review') {
      round('ROUND 2', 'Cross-examination');
      later(400, () => cheer('ooh'));
    }

    if (to === 'verdict' && from === 'review') {
      // the votes are in: the winner gloats, the loser sulks, the chair takes over
      const ranks = scene.rankings || [];
      holdUntil.current = performance.now() + RESULTS_MS;
      setShow((s) => ({
        ...s,
        voice: null,
        reactor: null,
        clash: null,
        bursts: {},
        lines: {},
        round: null,
        scoreCard: { rankings: ranks, at: performance.now() },
      }));
      later(250, () => {
        sfx('fanfare');
        cheer('applause', 2.2);
      });
      later(4000, () => round('FINAL ROUND', 'The verdict'));
      if (ranks.length) {
        const winner = ranks[0].model;
        later(1000, () =>
          say(winner, pick(personaFor(winner).victory), { emotion: 'happy', gesture: 'laugh' })
        );
      }
      if (ranks.length > 1) {
        const loser = ranks[ranks.length - 1].model;
        later(3600, () => {
          say(loser, pick(personaFor(loser).defeat), { emotion: 'sad', gesture: 'facepalm' });
          later(1500, () => cheer('laugh'));
        });
      }
      later(6000, () => {
        say('chair', pick(CHAIR_LINES.verdict), { emotion: 'neutral' });
        slam('chair');
      });
      later(3800, () => setShow((s) => ({ ...s, scoreCard: null })));
      startLoop(RESULTS_MS);
    }

    if (to === 'done' && from === 'verdict') {
      // the final gavel
      loopOn.current = false;
      queue.current = [];
      const winner = scene.rankings?.[0]?.model;
      setShow((s) => ({
        ...s,
        voice: null,
        reactor: null,
        clash: null,
        lines: {},
        flashAt: performance.now() + IMPACT_MS,
        emotions: winner ? { [winner]: { e: 'happy', at: performance.now() } } : {},
      }));
      slam('chair', { big: true });
      later(IMPACT_MS + 120, () => cheer('applause', 3));
    }

    if (to === 'idle' || (to === 'done' && from !== 'verdict')) {
      clearAll();
      setShow(EMPTY);
    }
  }, [scene.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // The script arrived: queue it, and the cast will perform it next
  useEffect(() => {
    if (!scene.script?.length || scripted.current || !working()) return;
    scripted.current = true;
    queue.current = [...scene.script];
    startLoop(0);
  }, [scene.script]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => clearAll, []);

  return show;
}
