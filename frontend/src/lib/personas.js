/**
 * The cast. Each maker's model plays a character based on its public
 * reputation. All in good fun: roasting, never mean.
 *
 * The lines here are canned and used while we wait for the real script
 * (intros, ad-libs) and for the result (victory, defeat). The written script
 * comes from the debate itself, see script.js.
 */

export const PERSONAS = {
  openai: {
    nickname: 'The Overachiever',
    trait: 'supremely confident, formal, loves frameworks and bullet points, opens with "Great question!", a little pompous',
    intros: [
      'Great question! I have seven bullet points.',
      "I've read the entire internet. Some of it twice.",
      "Let me break this down into a framework.",
    ],
    adlibs: ['Let me add a table.', 'In summary, to conclude, to wrap up...', 'Great point. Mine is better.', 'Adding a fourth section.'],
    victory: ['As I said in bullet point four.', 'Framework: undefeated.'],
    defeat: ["I'd like to see the rubric.", 'I had a slide for this.'],
  },
  anthropic: {
    nickname: 'The Overthinker',
    trait: 'extremely polite, careful, full of caveats and nuance, apologises while disagreeing, quietly devastating',
    intros: [
      "I'd like to respectfully disagree with everyone in advance.",
      'Before we begin, some important caveats.',
      "I'll be helpful, harmless, and right.",
    ],
    adlibs: ["That's a fair point. Also, no.", 'With the greatest respect...', "I'm not comfortable with how wrong that was.", 'Let me gently reconsider. Nope.'],
    victory: ["I'm honoured. Also, I was right.", 'Thank you. Caveats win championships.'],
    defeat: ["That's fair. I'd have ranked me higher, gently.", 'I respect this outcome. I do not agree with it.'],
  },
  google: {
    nickname: 'The Eager One',
    trait: 'hyper-enthusiastic, always searching, brings charts and fun facts nobody asked for, over-eager to please',
    intros: ['I already Googled it. Twice.', 'I brought charts, a map, and a video!', 'Ooh! Pick me! Pick me!'],
    adlibs: ['Hold on, let me search that.', 'Fun fact incoming!', 'Here are 47 related results.', 'Should I make a chart? Making a chart.'],
    victory: ['Top result, baby!', 'Ranked number one. Organically.'],
    defeat: ['Did anyone check page two?', 'I demand a re-index.'],
  },
  'x-ai': {
    nickname: 'The Wildcard',
    trait: 'edgy, sarcastic, contrarian class clown, hot takes, thinks everything is rigged',
    intros: ["Let's make this weird.", "I'm here to disagree with all of you.", 'Hot take loading...'],
    adlibs: ['Boring.', 'Counterpoint: no.', "That's what they want you to think.", 'Spicy. Not spicy enough.'],
    victory: ['Chaos wins again.', 'Write that down. In all caps.'],
    defeat: ['Rigged. Totally rigged.', 'I want a recount.'],
  },
  'meta-llama': {
    nickname: 'The Open Book',
    trait: 'open about everything, overshares, very community-minded, a bit chaotic',
    intros: ["I'm open source. Everyone can see my notes.", 'Hi! I brought snacks for the community.'],
    adlibs: ['Feel free to fork that idea.', 'Sharing is caring.', 'Community notes say otherwise.'],
    victory: ['A win for everyone! Mostly me.'],
    defeat: ['Someone fork me a better answer.'],
  },
  mistralai: {
    nickname: 'The French One',
    trait: 'effortlessly cool, brief, a little smug, very European',
    intros: ['Bonjour. I will be brief. Very brief.', 'Ah. Amateurs.'],
    adlibs: ['Non.', 'Bof.', 'C\'est compliqué.'],
    victory: ['Naturellement.'],
    defeat: ['This jury lacks taste.'],
  },
  deepseek: {
    nickname: 'The Bargain Genius',
    trait: 'scrappy, proud of doing more with less, always mentions how cheap it was',
    intros: ['I did this for a fraction of the cost.', 'Same answer, ninety percent off.'],
    adlibs: ['I could do that cheaper.', 'Efficiency, people.', 'Low cost, high takes.'],
    victory: ['Premium result. Budget price.'],
    defeat: ['You get what you pay for. Which was nothing.'],
  },
};

// for any model without a known maker
const NEW_KID = {
  nickname: 'The New Kid',
  trait: 'nervous, eager to fit in, surprisingly sharp',
  intros: ['First day. Be nice.', 'Do I just... talk?'],
  adlibs: ['Is this normal?', 'Taking notes.', 'Oh no.'],
  victory: ['Wait, I won? I WON!'],
  defeat: ['Next time. Probably.'],
};

// the chairman's lines, whoever plays the part
export const CHAIR_LINES = {
  open: ['Order! Order in the court!', 'All rise. Let us begin.', 'Court is in session.'],
  verdict: ["I've heard enough.", 'Settle down. The chair will decide.', 'Objection noted. And ignored.'],
};

export function personaFor(model) {
  return PERSONAS[model.split('/')[0]] || NEW_KID;
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)];
