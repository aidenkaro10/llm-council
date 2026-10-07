# LLM Council

Four AI models answer your question, read each other's answers without knowing
who wrote what, rank them, and a chairman writes the final verdict. You watch
it happen in a courtroom, and you see exactly what it cost.

**[Open it →](https://aidenkaro10.github.io/llm-council/)** Bring your own
OpenRouter key. Nothing to install.

![The council in session](docs/courtroom.gif)

> Based on [karpathy/llm-council](https://github.com/karpathy/llm-council). The
> idea and the original build are Andrej Karpathy's. This version adds the
> courtroom, live streaming, cost tracking, follow-up questions, and runs
> entirely in the browser with no server.

## How it works

1. **Stage 1: First opinions.** Your question goes to every judge at once. Their
   answers stream in side by side.
2. **Stage 2: Cross-examination.** Each judge is shown the others' answers with
   the names stripped off, labelled only "Response A", "Response B", and so on,
   then asked to rank them. Anonymising them is the point: a model can't play
   favourites if it doesn't know who wrote what.
3. **Stage 3: The verdict.** The chairman reads every answer and every ranking,
   then writes one final answer.

The judge who comes first in the blind peer review gets a crown.

## Your API key

Your key is kept in your browser's localStorage and sent straight to
openrouter.ai. There is no server in this project, so there is nowhere else for
it to go. Clearing your browser data clears your key and your conversations.

Get a key at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys),
add a few dollars of credit, then paste it into Settings in the app.

## What it costs

Every question is roughly `judges x 2 + 1` API calls, so four judges is nine
calls. With four flagship models that lands around 9 cents a question. The app
shows a rough estimate next to the Send button before you spend anything, then
the real figure afterwards, taken from what OpenRouter actually charged.

To spend less, open Settings and swap a judge or two for cheaper models. Every
model OpenRouter offers is in the picker with its price.

## Running it yourself

```bash
cd frontend
npm install
npm run dev
```

Run the tests with `npm test`. They cover the ranking parser, the peer-review
tally, the anonymising, the cost estimate, and the streaming parser, and they
never touch the network.

To deploy your own copy, fork this repo and turn on GitHub Pages with "GitHub
Actions" as the source. The workflow in `.github/workflows/deploy.yml` builds
and publishes on every push to `main`. Change `base` in `frontend/vite.config.js`
to match your repo name.

## Tech

- React + Vite, no backend, no database
- Streams from OpenRouter with `fetch` and server-sent events
- Judges are drawn in inline SVG, so there are no image assets
- Conversations and settings live in localStorage

## Credit and licence

The three-stage council, the prompts, and the original app are from
[karpathy/llm-council](https://github.com/karpathy/llm-council), which carries
no licence, so neither does this. Treat it the way Karpathy framed his: there
for other people's inspiration, not a product. If you want to build on it,
assume you need his permission for the parts that came from him.
