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

While they deliberate, it's a show. Each model is a 3D mech with its maker's
mark for a face, standing at the bench of a courtroom.

1. **Order in the court.** The chairman bangs the gavel and your question
   comes up as the case.
2. **Opening arguments.** Judges take the floor in turn under a spotlight,
   chattering in robot bleeps.
3. **Cross-examination.** They turn on each other. Gavels slam, energy arcs
   between whoever is arguing, and OBJECTION! and HEARSAY! fly. Their words
   name the judge they're attacking.
4. **The votes are in.** A scorecard shows the blind-review ranking and the
   winner is crowned.
5. **The verdict.** The camera pushes in on the chairman as it's written, then
   one last gavel.

Sound is off until you turn it on with the speaker button. It's all generated
in the browser, no audio files.

Then you see the verdict. Everything else, every judge's answer and every
review, is one click away under **How they got there**.

## Your key and your money

Your key stays in your browser and goes straight to openrouter.ai. There is no
server. A question with four flagship models costs about 7 cents; the app shows
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
separately so the app is usable before it arrives. Sound is synthesised with
the Web Audio API. Animation runs in the render loop with damping rather than
through React, quality steps down automatically on slow devices, and it
respects reduced-motion settings.

## Notes

The mechs' head marks are simple drawings for telling models apart, not the
companies' logos, and none of those companies endorse this.

Karpathy's repo has no licence, so neither does this one. Treat it the way he
framed his: there for inspiration. For anything that came from him, assume you
need his permission.
