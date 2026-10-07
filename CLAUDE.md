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
    Chamber.jsx     the full-screen three.js stage: lights, floor, camera rig,
                    spotlight on the speaker, energy beams
    CourtSet.jsx    bench, high bench, columns, seal, bar, aisle, lectern
    Mech3D.jsx      one mech behind the bench, gavel slams, outbursts
    useShow.js      the director: runs the episode (entrances, ad-libs, the
                    script, results, finale); one speaker at a time
    Audience.jsx    the robot studio audience, reacting to crowd cues
    sound.js        Web Audio synth: gavel, objection, chatter, zap, fanfare,
                    ambient hum. Off by default
    marks.js / textures.js  SVG marks and the seal, turned into textures
  src/components/ShowOverlay.jsx  broadcast graphics over the scene, never the
                    panel: case card, round banners, lower thirds, scoreboard
  src/lib/personas.js  the cast: each maker's character and canned lines
  src/lib/script.js    the comedy script: prompt, call, and a strict parser
    ui.jsx          shared Button, Card, Panel, ModelTabs (Tailwind)
    Stage1/2/3.jsx  the full text under the courtroom
    Settings.jsx    API key and judge picker
  test/             node:test suite, no network
```

## The look

Modelled on immersive award-style sites: one full-screen WebGL stage with the
UI as frosted glass over it, an intro counter on first visit per session, and
the camera moving with the story. Spectacle lives in the deliberation, which
is dead waiting time anyway. The verdict must stay instant to read.

## The product rule

The user came for the verdict. Show the answer, hide the process. While the
council works the arena is the loading screen; once the verdict lands, the
deliberation folds into one line (`CouncilStrip`) with "How they got there".
Don't add captions, hints or explainer text to the main view. The chairman
prompt asks for a short, direct answer that never mentions the council; keep it
that way.

## The show

It's a sitcom. After stage 1, `writeScript` asks a cheap fast model
(`SCRIPT_MODEL`) to turn the real answers into 8 to 10 lines of comedy. It runs
in parallel with stages 2 and 3 and is never awaited for more than 1.5s; if it
fails the show falls back to canned ad-libs from `personas.js`. Judges' bubbles
show only scripted or canned lines, never their real streaming text (that's in
"How they got there"); the chairman's bubble subtitles the verdict.

Everything in `useShow.js` reacts to real progress and must never delay the
answer. Beats: case called (3 chair taps) on entering opinions; the floor
rotates every 3.2s between speaking judges; random slams, and outbursts during
review; scorecard + crown + fanfare on review -> verdict; big slam + flash on
verdict -> done. Sounds fire on the gavel's impact (290ms after a slam starts),
not on the click. The reset for a newly opened conversation must stay declared
BEFORE the phase effect, because asking from the empty screen does both in one
render.

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
- **Narrow screens** (free width under 0.9 of the height) use a staggered
  formation and show one speech bubble at a time, rotating between speakers.
- **Nameplates sit at z=0 under the feet** so they don't swing when mechs turn.
- **drei `<Html>` logs "synchronously unmount a root" in dev only**, from
  StrictMode. Production is clean; don't chase it.
- **Phones**: check 375px wide after touching the scene or the panel.
- `base` in `vite.config.js` is `/llm-council/` because GitHub Pages serves
  project sites from a subpath. Changing the repo name breaks the build output.

## Testing

`cd frontend && npm test`. To exercise the UI without spending money, stub
`window.fetch` in the browser console to return fake SSE streams.
