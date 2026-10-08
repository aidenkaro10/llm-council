/**
 * The cast. The council's models are counsel arguing in front of a judge, and
 * each plays a good-natured version of its reputation.
 *
 * Everything here is written to be said out loud: short, natural sentences,
 * the way people actually talk in a courtroom comedy. The canned lines cover
 * the openings, the waiting, and the result. The argument itself is written
 * fresh from the real debate, see script.js.
 */

export const PERSONAS = {
  openai: {
    nickname: 'The Overachiever',
    trait: 'polished, supremely prepared, always has a structured argument in three parts, a little pleased with itself',
    intros: [
      "Good morning, Your Honor. I've prepared a brief. It is not brief.",
      "Your Honor, I'll be walking the court through this in three parts.",
      'Thank you, Your Honor. I came prepared. Very prepared.',
    ],
    adlibs: ['If I could just add one more point.', "I'll keep this short. Relatively.", 'That was my second point, actually.', 'For the record, I did say that first.'],
    victory: ['Thank you, Your Honor. As outlined in part two.', 'I appreciate the court recognising the obvious.'],
    defeat: ["I'd like to formally request the scoring rubric.", 'I had slides, Your Honor. I had slides.'],
  },
  anthropic: {
    nickname: 'The Overthinker',
    trait: 'extremely polite and careful, full of caveats, apologises while disagreeing, quietly devastating',
    intros: [
      'Your Honor, before I begin, I want to acknowledge every perspective in this room. Some more than others.',
      "With respect to my colleagues, I'll be disagreeing with all of them. Gently.",
      'Good morning. I have a few caveats. Just a few.',
    ],
    adlibs: ["That's a fair point. It's also wrong.", 'I say this with genuine respect.', "I'd like to gently push back on that.", 'Can we slow down for one second?'],
    victory: ['Thank you, Your Honor. I did try to be thorough.', "I'm grateful. And, respectfully, I was right."],
    defeat: ['I respect the outcome. I do not agree with it.', "That's fair. I'd have ranked myself higher, but that's fair."],
  },
  google: {
    nickname: 'The Eager One',
    trait: 'enthusiastic, over-prepared with facts nobody asked for, always just looked something up, desperate to help',
    intros: [
      "Good morning, Your Honor! I've already looked this up. Several times.",
      'Your Honor, I brought sources. A lot of sources.',
      "Hi! Sorry. Your Honor. Hi. I'm very ready.",
    ],
    adlibs: ['Actually, fun fact.', 'I can pull that up right now.', 'Can I share one quick statistic?', "I'm just saying, I checked."],
    victory: ['Thank you, Your Honor! Top result!', 'I knew the research would pay off.'],
    defeat: ['Did anyone check the second page of results?', "I'd like to submit more sources."],
  },
  'x-ai': {
    nickname: 'The Wildcard',
    trait: 'sarcastic contrarian, loves a hot take, a little reckless, thinks everything is rigged',
    intros: [
      "I'll be honest, Your Honor. I'm mostly here to cause problems.",
      "Your Honor, I disagree with everyone in this room. I haven't heard them yet. I just know.",
      "Let's make this interesting.",
    ],
    adlibs: ['Boring.', 'Counterpoint. No.', "That's exactly what they want you to think.", 'Wow. Okay.'],
    victory: ['Write that down, Your Honor.', 'Chaos wins again.'],
    defeat: ['This is rigged, Your Honor.', "I'd like a recount. And a new judge."],
  },
  'meta-llama': {
    nickname: 'The Open Book',
    trait: 'friendly, overshares, believes everything should be shared with everyone',
    intros: ["Good morning! I've shared my notes with everyone. Including opposing counsel."],
    adlibs: ['Happy to share that, by the way.', 'Anyone can use that argument.'],
    victory: ['A win for everyone. Mostly me.'],
    defeat: ['Someone take my notes and do better.'],
  },
  mistralai: {
    nickname: 'The French One',
    trait: 'effortlessly cool, brief, a little smug, very European',
    intros: ['Bonjour, Your Honor. I will be brief.', 'I do not need much time.'],
    adlibs: ['Non.', 'This is not complicated.'],
    victory: ['Naturally.'],
    defeat: ['This court lacks taste.'],
  },
  deepseek: {
    nickname: 'The Bargain Genius',
    trait: 'scrappy, proud of doing more with less, always mentions how cheap it was',
    intros: ['Your Honor, I did all of this for a fraction of the cost.'],
    adlibs: ['I could have argued that cheaper.', 'Efficiency, people.'],
    victory: ['Premium result, Your Honor. Budget price.'],
    defeat: ['You get what you pay for.'],
  },
};

// for any model without a known maker
const NEW_KID = {
  nickname: 'The New Associate',
  trait: 'nervous first day on the job, eager, surprisingly sharp',
  intros: ["It's my first day, Your Honor. Please be nice."],
  adlibs: ['Is that allowed?', "I'm taking notes."],
  victory: ['Wait. I won?'],
  defeat: ['Next time, Your Honor.'],
};

// the judge's lines, whoever is in the chair
export const CHAIR_LINES = {
  open: ['Order. Order in the court.', 'Court is now in session. Be seated.', 'All right, settle down. Let us begin.'],
  begin: ['Counsel, you may begin.', 'Opening statements. Keep them short.'],
  verdict: ["I've heard enough. I'll rule now.", "Thank you, counsel. That's quite enough.", 'The court will now decide.'],
};

export function personaFor(model) {
  return PERSONAS[model.split('/')[0]] || NEW_KID;
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)];
