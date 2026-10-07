/**
 * A rough price for a question before you spend it.
 *
 * Nobody can know the real number in advance, because it depends on how much
 * each model decides to write. These are averages from real council runs, and
 * the estimate is labelled as rough everywhere it is shown.
 */

// Typical sizes, in tokens
const QUESTION_TOKENS = 60;
const ANSWER_TOKENS = 700;    // what one judge writes in stage 1
const REVIEW_TOKENS = 250;    // one judge's brief review in stage 2
const VERDICT_TOKENS = 400;   // the chairman's verdict, kept short

export function estimateCost(councilModels, chairmanModel, models) {
  const priceOf = (id) => models.find((m) => m.id === id);

  // per million tokens, so divide by 1e6 at the end
  let promptTokens = 0;
  let total = 0;
  let known = 0;

  const judgeCount = councilModels.length;

  // Stage 2 shows every judge all of stage 1, so the prompt grows with the council
  const stage2Prompt = QUESTION_TOKENS + judgeCount * ANSWER_TOKENS;
  // Stage 3 shows the chairman everything from both earlier stages
  const stage3Prompt = stage2Prompt + judgeCount * REVIEW_TOKENS;

  for (const id of councilModels) {
    const price = priceOf(id);
    if (!price) continue;
    known += 1;
    total +=
      (QUESTION_TOKENS * price.promptPrice + ANSWER_TOKENS * price.completionPrice) / 1e6;
    total +=
      (stage2Prompt * price.promptPrice + REVIEW_TOKENS * price.completionPrice) / 1e6;
  }

  const chairPrice = priceOf(chairmanModel);
  if (chairPrice) {
    total +=
      (stage3Prompt * chairPrice.promptPrice + VERDICT_TOKENS * chairPrice.completionPrice) / 1e6;
  }

  return {
    estimate: total,
    // if we have no prices for some judges the number is understated, so say so
    complete: known === judgeCount && Boolean(chairPrice),
  };
}

/** Format a dollar amount, keeping fractions of a cent visible. */
export function money(amount) {
  if (!amount) return '$0.000';
  return amount < 0.001 ? `$${amount.toFixed(5)}` : `$${amount.toFixed(3)}`;
}
