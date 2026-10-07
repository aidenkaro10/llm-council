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
    Courtroom.jsx   the cartoon scene; Judge.jsx draws one judge in SVG
    Stage1/2/3.jsx  the full text under the courtroom
    Settings.jsx    API key and judge picker
  test/             node:test suite, no network
```

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
- `base` in `vite.config.js` is `/llm-council/` because GitHub Pages serves
  project sites from a subpath. Changing the repo name breaks the build output.

## Testing

`cd frontend && npm test`. To exercise the UI without spending money, stub
`window.fetch` in the browser console to return fake SSE streams.
