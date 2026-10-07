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
    Courtroom.jsx   the arena scene; Judge.jsx draws one mech in SVG
    CouncilStrip.jsx the one-line summary shown once the verdict is in
    brand.js        maker colours, shared by the arena and the strip
    ui.jsx          shared Button, Card, Panel, ModelTabs (Tailwind)
    Stage1/2/3.jsx  the full text under the courtroom
    Settings.jsx    API key and judge picker
  test/             node:test suite, no network
```

## The product rule

The user came for the verdict. Show the answer, hide the process. While the
council works the arena is the loading screen; once the verdict lands, the
deliberation folds into one line (`CouncilStrip`) with "How they got there".
Don't add captions, hints or explainer text to the main view. The chairman
prompt asks for a short, direct answer that never mentions the council; keep it
that way.

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
- **The arena is dark in both themes on purpose**, so the brand colours pop.
  Don't theme it with the app tokens.
- **Speech bubbles are clamped to three lines** and stop at the word `FINAL`,
  so a long review or its ballot can't cover the arena header.
- **Phones**: the sidebar is a drawer below `md`, and the bench row is
  `nowrap` below 640px so four mechs share one line. Check 375px wide after
  touching either.
- `base` in `vite.config.js` is `/llm-council/` because GitHub Pages serves
  project sites from a subpath. Changing the repo name breaks the build output.

## Testing

`cd frontend && npm test`. To exercise the UI without spending money, stub
`window.fetch` in the browser console to return fake SSE streams.
