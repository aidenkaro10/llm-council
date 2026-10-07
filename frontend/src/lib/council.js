/**
 * The 3-stage council, running entirely in your browser.
 *
 * Stage 1: every judge answers the question.
 * Stage 2: every judge reads the others' answers with the names stripped off,
 *          and ranks them.
 * Stage 3: the chairman reads everything and writes the final answer.
 */

import { streamModel, askOnce } from './openrouter.js';

/** Build the chat history the judges see, so follow-up questions have context. */
export function buildMessages(history, question) {
  const messages = [];
  for (const turn of history) {
    messages.push({ role: 'user', content: turn.question });
    if (turn.answer) messages.push({ role: 'assistant', content: turn.answer });
  }
  messages.push({ role: 'user', content: question });
  return messages;
}

/** Stage 2 prompt: rank the anonymised answers. */
export function buildRankingPrompt(question, answers) {
  const labels = answers.map((_, i) => `Response ${String.fromCharCode(65 + i)}`);

  const labelToModel = {};
  labels.forEach((label, i) => {
    labelToModel[label] = answers[i].model;
  });

  const body = answers
    .map((answer, i) => `${labels[i]}:\n${answer.text}`)
    .join('\n\n');

  const prompt = `You are evaluating different responses to the following question:

Question: ${question}

Here are the responses from different models (anonymized):

${body}

Your task:
1. For each response, write one or two sentences on what it gets right and what it gets wrong. Be blunt and brief.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example of the correct format for your ENTIRE response:

Response A provides good detail on X but misses Y...
Response B is accurate but lacks depth on Z...
Response C offers the most comprehensive answer...

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Now provide your evaluation and ranking:`;

  return { prompt, labelToModel };
}

/** Stage 3 prompt: the chairman writes the verdict. */
export function buildChairmanPrompt(question, answers, reviews) {
  const answersText = answers
    .map((a) => `Model: ${a.model}\nResponse: ${a.text}`)
    .join('\n\n');

  const reviewsText = reviews
    .map((r) => `Model: ${r.model}\nRanking: ${r.text}`)
    .join('\n\n');

  return `You are the chairman of a council of AI models. Several models answered the user's question, then ranked each other's answers without knowing who wrote what.

Question: ${question}

ANSWERS:
${answersText}

REVIEWS:
${reviewsText}

Write the final answer for the user.

- Start with the answer itself in the first sentence. No preamble, no restating the question.
- Keep what the council got right, fix what it got wrong, and use the reviews to settle disagreements.
- Be as short as the question allows. A simple question gets a sentence or two. A complex one gets a few short paragraphs or a short list, never an essay.
- Do not mention the council, the models, the reviews, or this process. The user only wants the answer.`;
}

/** Pull the "FINAL RANKING:" list out of a judge's review. */
export function parseRanking(text) {
  if (!text) return [];

  const section = text.includes('FINAL RANKING:')
    ? text.split('FINAL RANKING:').slice(1).join('')
    : text;

  const numbered = section.match(/\d+\.\s*Response [A-Z]/g);
  if (numbered) return numbered.map((m) => m.match(/Response [A-Z]/)[0]);

  return section.match(/Response [A-Z]/g) || [];
}

/** Average each model's position across every peer review. Lower is better. */
export function aggregateRankings(reviews, labelToModel) {
  const positions = {};

  for (const review of reviews) {
    parseRanking(review.text).forEach((label, index) => {
      const model = labelToModel[label];
      if (!model) return;
      (positions[model] = positions[model] || []).push(index + 1);
    });
  }

  return Object.entries(positions)
    .map(([model, places]) => ({
      model,
      average_rank: Number(
        (places.reduce((a, b) => a + b, 0) / places.length).toFixed(2)
      ),
      rankings_count: places.length,
    }))
    .sort((a, b) => a.average_rank - b.average_rank);
}

/**
 * Run all judges at once, streaming each one.
 *
 * emit(event) is called with {type, model, ...} as things happen.
 * Returns [{model, text, cost, error}] in the order the judges were given.
 */
async function runJudges(apiKey, models, messages, stage, emit, signal) {
  return Promise.all(
    models.map(async (model) => {
      try {
        const { text, cost } = await streamModel(
          apiKey,
          model,
          messages,
          (channel, delta) =>
            emit({ type: `${stage}_delta`, model, channel, text: delta }),
          signal
        );
        emit({ type: `${stage}_cost`, model, cost });
        return { model, text, cost };
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        emit({ type: `${stage}_error`, model, message: error.message });
        return { model, text: '', cost: 0, error: error.message };
      }
    })
  );
}

/** A short title for the sidebar, generated from the first question. */
export async function generateTitle(apiKey, model, question) {
  const prompt = `Generate a very short title (3-5 words maximum) that summarizes the following question.
The title should be concise and descriptive. Do not use quotes or punctuation in the title.

Question: ${question}

Title:`;

  try {
    const { text, cost } = await askOnce(apiKey, model, [
      { role: 'user', content: prompt },
    ]);
    let title = (text || '').trim().replace(/^["']|["']$/g, '');
    if (title.length > 50) title = title.slice(0, 47) + '...';
    return { title: title || 'New Conversation', cost };
  } catch {
    return { title: 'New Conversation', cost: 0 };
  }
}

/**
 * The whole thing, start to finish.
 *
 * emit(event) reports progress as it happens so the courtroom can animate.
 */
export async function runCouncil({
  apiKey,
  councilModels,
  chairmanModel,
  question,
  history = [],
  emit,
  signal,
}) {
  // --- Stage 1: first opinions ---
  emit({ type: 'stage1_start', models: councilModels });
  const messages = buildMessages(history, question);
  const stage1 = await runJudges(apiKey, councilModels, messages, 'stage1', emit, signal);

  // Failed judges stay in the list (marked with an error) so they don't vanish
  // from the room; only the ones that answered feed the next stages.
  const answers = stage1.filter((r) => r.text);
  emit({ type: 'stage1_complete', data: stage1 });

  if (answers.length === 0) {
    const reason = stage1.find((r) => r.error)?.error || 'every judge failed';
    throw new Error(`The council could not sit: ${reason}`);
  }

  // --- Stage 2: cross-examination ---
  emit({ type: 'stage2_start' });
  const { prompt, labelToModel } = buildRankingPrompt(question, answers);
  emit({ type: 'stage2_models', models: councilModels, label_to_model: labelToModel });

  const stage2 = await runJudges(
    apiKey,
    councilModels,
    [{ role: 'user', content: prompt }],
    'stage2',
    emit,
    signal
  );

  const allReviews = stage2.map((r) => ({ ...r, parsed_ranking: parseRanking(r.text) }));
  const reviews = allReviews.filter((r) => r.text);

  const aggregate = aggregateRankings(reviews, labelToModel);
  emit({
    type: 'stage2_complete',
    data: allReviews,
    metadata: { label_to_model: labelToModel, aggregate_rankings: aggregate },
  });

  // --- Stage 3: the verdict ---
  emit({ type: 'stage3_start', model: chairmanModel });
  const chairmanPrompt = buildChairmanPrompt(question, answers, reviews);
  const [verdict] = await runJudges(
    apiKey,
    [chairmanModel],
    [{ role: 'user', content: chairmanPrompt }],
    'stage3',
    emit,
    signal
  );
  emit({ type: 'stage3_complete', data: verdict });

  const cost =
    answers.reduce((sum, r) => sum + r.cost, 0) +
    reviews.reduce((sum, r) => sum + r.cost, 0) +
    (verdict.cost || 0);

  return {
    // everyone, including judges that failed, for display
    opinions: stage1,
    allReviews,
    // only the ones that worked, which is what the verdict was built from
    answers,
    reviews,
    verdict,
    metadata: { label_to_model: labelToModel, aggregate_rankings: aggregate },
    cost,
  };
}
