# LLM Council

Ask once. Four AI models take your question to court, argue it out, rank each
other blind, and you get one short verdict.

**[Open it →](https://aidenkaro10.github.io/llm-council/)** Bring your own
[OpenRouter key](https://openrouter.ai/settings/keys). Nothing to install.

![The council in session](docs/courtroom.gif)

> Based on [karpathy/llm-council](https://github.com/karpathy/llm-council).
> The idea and the original build are Andrej Karpathy's.

## How it works

1. Every judge answers your question.
2. Each judge ranks the others' answers with the names hidden, so nobody can
   play favourites.
3. A chairman writes one answer from all of it.

While they deliberate, it's a show: a courtroom comedy, played straight.

The chairman is the judge, up at the high bench with the only gavel. The other
models are lawyers in suits at two counsel tables, each playing a character
based on its public reputation. GPT is the Overachiever with a brief that is
not brief, Claude the Overthinker who disagrees respectfully in advance, Gemini
the Eager One who already looked it up, Grok the Wildcard who disagrees before
hearing anyone.

1. **Order in the court.** The judge calls the case (your question). Counsel
   stand one at a time for opening statements.
2. **The argument.** Once the answers are in, a small fast model writes a short
   scene out of their real disagreement, the way people actually talk in court:
   "Your Honor", objections, rebuttals, the judge cutting in. Whoever speaks
   stands up, and the camera cuts like court TV, with reaction shots of whoever
   just got called out.
3. **The vote.** The judge has heard enough. The blind-review ranking comes up,
   the winner is gracious, the loser less so.
4. **The ruling.** The judge reads the verdict out and bangs the gavel.

Lines show as TV captions. Turn sound on (the speaker button) and the cast
speaks them out loud in different voices, with the gallery reacting quietly.
Voices come from your own device's speech engine, so they're free and sound
best on a Mac or with Chrome's built-in voices. No audio files.

Then you see the verdict. Everything else, every judge's answer and every
review, is one click away under **How they got there**.

## Your key and your money

Your key stays in your browser and goes straight to openrouter.ai. There is no
server. A question with four flagship models costs about 7 cents, plus about a
third of a cent for the courtroom script; the app shows
an estimate before you send and the real cost after. Swap in cheaper judges in
Settings to spend less.

## Run it yourself

```bash
cd frontend
npm install
npm run dev
```

`npm test` runs the tests, offline and free. Pushing to `main` tests and deploys
to GitHub Pages. If you fork it, change `base` in `frontend/vite.config.js` to
your repo name.

## Tech

React and Vite, with the courtroom in three.js through React Three Fiber. The
mechs and the set are built from code, not model files, and the 3D loads
separately so the app is usable before it arrives. Sound effects are synthesised
with the Web Audio API and the voices use the browser's speech synthesis. Animation runs in the render loop with damping rather than
through React, quality steps down automatically on slow devices, and it
respects reduced-motion settings.

## Notes

The mechs' head marks are simple drawings for telling models apart, not the
companies' logos, and none of those companies endorse this.

Karpathy's repo has no licence, so neither does this one. Treat it the way he
framed his: there for inspiration. For anything that came from him, assume you
need his permission.
