import { useEffect, useRef, useState } from 'react';
import { sfx } from './sound';

/**
 * The director. Watches the council's progress and stages the show on top of
 * it: who has the floor, gavel slams, outbursts, the scorecard, the finale.
 *
 * Everything here reacts to what the models are really doing. Nothing is
 * allowed to delay the answer; the show only fills time spent waiting.
 */

const OUTBURSTS = ['OBJECTION!', 'OVERRULED!', 'HEARSAY!', 'SUSTAINED!', 'ORDER!', 'NONSENSE!'];
// how long after a slam starts the gavel actually hits (matches Mech3D)
const IMPACT_MS = 290;

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const EMPTY = {
  voice: null,
  slams: {},
  bursts: {},
  clash: null,
  shake: null,
  caseCard: null,
  scoreCard: null,
  flashAt: 0,
};

export default function useShow(scene, question, caseKey) {
  const [show, setShow] = useState(EMPTY);
  const latest = useRef(scene);
  latest.current = scene;
  const prevPhase = useRef(scene.phase);
  const timers = useRef([]);

  const later = (ms, fn) => timers.current.push(setTimeout(fn, ms));
  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

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

  const outburst = (who) => {
    const at = performance.now();
    setShow((s) => ({ ...s, bursts: { ...s.bursts, [who]: { word: pick(OUTBURSTS), at } } }));
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

  // A different conversation opened: drop whatever was on stage. Declared
  // first so it runs before the phase effect below; asking from the empty
  // screen opens a conversation and calls the case in the same moment, and
  // the case must win.
  useEffect(() => {
    clearAll();
    setShow(EMPTY);
  }, [caseKey]);

  // Phase changes: the big set pieces
  useEffect(() => {
    const from = prevPhase.current;
    const to = scene.phase;
    prevPhase.current = to;
    if (from === to) return;

    if (to === 'opinions') {
      // a new case: order in the court
      clearAll();
      setShow({ ...EMPTY, caseCard: { question, at: performance.now() } });
      [0, 380, 760].forEach((ms) => later(ms, () => slam('chair')));
      later(2700, () => setShow((s) => ({ ...s, caseCard: null })));
    }

    if (to === 'verdict' && from === 'review') {
      // the votes are in: scorecard, and the winner is crowned
      setShow((s) => ({
        ...s,
        voice: 'chair',
        clash: null,
        bursts: {},
        scoreCard: { rankings: scene.rankings || [], at: performance.now() },
      }));
      later(250, () => sfx('fanfare'));
      later(3800, () => setShow((s) => ({ ...s, scoreCard: null })));
    }

    if (to === 'done' && from === 'verdict') {
      // the final gavel
      setShow((s) => ({ ...s, voice: null, clash: null, flashAt: performance.now() + IMPACT_MS }));
      slam('chair', { big: true });
    }

    if (to === 'idle' || (to === 'done' && from !== 'verdict')) {
      clearAll();
      setShow(EMPTY);
    }
  }, [scene.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Who has the floor: rotates between judges who are talking, like a broadcast
  useEffect(() => {
    if (scene.phase !== 'opinions' && scene.phase !== 'review') return;

    const rotate = () => {
      const speaking = latest.current.council.filter((j) => j.state === 'speaking');
      setShow((s) => {
        if (!speaking.length) return s.voice ? { ...s, voice: null, clash: null } : s;
        const index = speaking.findIndex((j) => j.model === s.voice);
        const next = speaking[(index + 1) % speaking.length];
        const voiceIndex = latest.current.council.findIndex((j) => j.model === next.model);
        sfx('chatter', voiceIndex, 2.6);

        // in cross-examination, the speaker goes after someone
        let clash = null;
        if (latest.current.phase === 'review') {
          const others = latest.current.council.filter((j) => j.model !== next.model && j.state !== 'failed');
          if (others.length) {
            clash = { from: next.model, to: pick(others).model, at: performance.now() };
            later(120, () => sfx('zap'));
          }
        }
        return { ...s, voice: next.model, clash };
      });
    };

    rotate();
    const id = setInterval(rotate, 3200);
    return () => clearInterval(id);
  }, [scene.phase]);

  // The chairman mutters while writing the verdict
  useEffect(() => {
    if (scene.phase !== 'verdict' || scene.chairman?.state !== 'speaking') return;
    sfx('chatter', 0, 2.8, true);
    const id = setInterval(() => sfx('chatter', 0, 2.8, true), 3000);
    return () => clearInterval(id);
  }, [scene.phase, scene.chairman?.state]);

  // The heat of the argument: slams and outbursts during cross-examination,
  // and the odd emphatic slam during opening arguments
  useEffect(() => {
    if (scene.phase !== 'opinions' && scene.phase !== 'review') return;
    const fierce = scene.phase === 'review';
    let id;

    const beat = () => {
      const active = latest.current.council.filter((j) => j.state === 'speaking' || j.state === 'thinking');
      if (active.length) {
        const who = pick(active).model;
        if (fierce && Math.random() < 0.6) outburst(who);
        else slam(who);
      }
      id = setTimeout(beat, fierce ? 1000 + Math.random() * 900 : 2400 + Math.random() * 1600);
    };

    id = setTimeout(beat, fierce ? 500 : 1600);
    return () => clearTimeout(id);
  }, [scene.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => clearAll, []);

  return show;
}
