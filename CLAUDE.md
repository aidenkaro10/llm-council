# CLAUDE.md - Notes for future sessions

## What this is

A browser-only fork of karpathy/llm-council. There is no backend. Everything
runs in the user's browser and talks straight to OpenRouter with their own key.

## Layout

```
frontend/
  src/lib/
    openrouter.js   streaming client, SSE parsing, error messages, pricing
    council.js      the 3 stages, prompts, ranking parser, peer-review tally
    storage.js      conversations + settings in localStorage
    cost.js         pre-flight price estimate and money formatting
  src/components/
    CouncilStrip.jsx the one-line summary shown once the verdict is in
    brand.js        maker colours, shared by the 3D scene and the strip
    TopBar / Sidebar / IntroLoader  the glass chrome around the scene
  src/scene/
    Chamber.jsx     the full-screen three.js stage: lights, shadows, depth of
                    field, and the court-TV camera (shotFor + CameraRig)
    CourtSet.jsx    a real courtroom: judge's high bench, seal, two counsel
                    tables, lectern, witness stand, the bar, gallery pews,
                    wood panelling, windows with daylight shafts
    Mech3D.jsx      one character: lawyer in a suit (sits, stands to speak)
                    or the judge in a robe with the gavel; lip-flap mouths
    useShow.js      the director: runs the episode (opening, statements, the
                    script, the vote, the ruling); one speaker at a time,
                    each line paced by its voice or its reading time
    Audience.jsx    the seated gallery, reacting quietly to crowd cues
    voice.js        browser speechSynthesis: a distinct voice per character
    sound.js        Web Audio synth: gavel, murmurs, laughs, applause,
                    ambient room tone. Off by default
    marks.js / textures.js  SVG marks and the seal, turned into textures
  src/components/ShowOverlay.jsx  broadcast graphics over the scene, never the
                    panel: case card, round banners, captions, the vote
  src/lib/personas.js  the cast: each maker's character and canned lines
  src/lib/script.js    the courtroom script: prompt, call, and a strict parser
    ui.jsx          shared Button, Card, Panel, ModelTabs (Tailwind)
    Stage1/2/3.jsx  the full text under the courtroom
    Settings.jsx    API key and judge picker
  test/             node:test suite, no network
```

## The look

Modelled on immersive award-style sites: one full-screen WebGL stage with the
UI as frosted glass over it, courtroom doors that swing open on the first visit per session, and
the camera moving with the story. Spectacle lives in the deliberation, which
is dead waiting time anyway. The verdict must stay instant to read.

## The product rule

The user came for the verdict. Show the answer, hide the process. While the
council works the arena is the loading screen; once the verdict lands, the
deliberation folds into one line (`CouncilStrip`) with "How they got there".
Don't add hints or explainer text to the main view (the show's captions sit
over the scene, never the panel). The chairman
prompt asks for a short, direct answer that never mentions the council; keep it
that way.

## The show

It's a courtroom comedy played straight, in the spirit of Night Court. The
chairman is the judge; council models are counsel. After stage 1,
`writeScript` asks a cheap fast model (`SCRIPT_MODEL`) to turn the real answers
into 8 to 10 spoken lines, with "judge" as a speaker for interjections. It runs
in parallel with stages 2 and 3 and is never awaited for more than 1.5s; if it
fails the show falls back to canned lines from `personas.js`. Captions show
only scripted or canned lines, never the models' real streaming text (that's
in "How they got there"). Lines must read well out loud: no memes, no slang.

Everything in `useShow.js` reacts to real progress and must never delay the
answer. Beats: case card + three gavel taps on entering opinions, the judge
opens, counsel give one-line openings (skipped as soon as the script is ready);
the script plays on review; on review -> verdict the current speaker finishes
their sentence (max 3.5s), the judge cuts in, the vote shows, winner and loser
react; on verdict -> done the judge reads the first sentence of the ruling and
bangs the gavel. With sound on, a line lasts as long as its voice; with sound
off, as long as it takes to read. The reset for a newly opened conversation
must stay declared BEFORE the phase effect, because asking from the empty
screen does both in one render.

Camera: shots are hard cuts with a slow push-in, like a broadcast. Close shots
sit in front of the bench, never inside it (the bench front is at z about
-3.4). On phones only the top strip shows the court, so close shots widen the
lens (`freeHeight`) instead of moving the camera back.

Smoothness rules: animate in `useFrame` with `maath` damping, never with React
state; `Mech3D` is memoised, so give it numbers and stable objects, not fresh
arrays; title cards only animate opacity, transform and filter.

## Things that will bite you

- **Anonymity is the whole point of stage 2.** `buildRankingPrompt` must never
  leak model names into the prompt. There is a test for this. Keep it.
- **SSE chunks split mid-event.** The stream reader buffers partial events on
  purpose. This was a real bug. There is a test for it.
- **Cost comes in the last SSE message**, which has no `choices`, so read
  `usage` before any early `continue`.
- **Data shape**: every stage entry is `{model, text, cost, reasoning?, error?}`.
  Stage 2 adds `parsed_ranking`. Do not reintroduce `response`/`ranking`.
- **A judge that fails must not take down the council.** Failures become a
  `recused` judge in the courtroom, and the rest carry on.
- **Camera fit**: the field of view is vertical. `fit` in `Chamber.jsx` checks
  width and height separately against the space the panel leaves free. Fog
  scales with it, or a pulled-back camera fogs the council to black.
- **Overlay keys need a prefix.** Several overlay pieces are keyed by
  `performance.now()`, and two can get the same value in one tick. Duplicate
  sibling keys made React leave stale round banners on screen.
- **Voices need a user gesture** before they'll play (`unlockVoice`), and the
  available voices depend on the OS. Novelty voices are filtered out.
- **Phones**: check 375px wide after touching the scene or the panel.
- `base` in `vite.config.js` is `/llm-council/` because GitHub Pages serves
  project sites from a subpath. Changing the repo name breaks the build output.

## Testing

`cd frontend && npm test`. To exercise the UI without spending money, stub
`window.fetch` in the browser console to return fake SSE streams.
