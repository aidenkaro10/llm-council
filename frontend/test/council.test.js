/**
 * Tests for the parts of the council that have to be right.
 *
 * Run them with:  npm test
 * Nothing here touches the network or costs money.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseRanking,
  aggregateRankings,
  buildRankingPrompt,
  buildMessages,
} from '../src/lib/council.js';
import { estimateCost } from '../src/lib/cost.js';
import { streamModel } from '../src/lib/openrouter.js';

// --- ranking parsing -------------------------------------------------------

test('parses the ranking format we ask models for', () => {
  const text = `Response A was thorough. Response B rambled.

FINAL RANKING:
1. Response B
2. Response A`;
  assert.deepEqual(parseRanking(text), ['Response B', 'Response A']);
});

test('ignores mentions in the body and only reads the ranking section', () => {
  const text = `Response C is best, I will say so below.

FINAL RANKING:
1. Response A
2. Response C`;
  assert.deepEqual(parseRanking(text), ['Response A', 'Response C']);
});

test('falls back to any labels in order when a model ignores the format', () => {
  assert.deepEqual(parseRanking('I prefer Response B, then Response A.'), [
    'Response B',
    'Response A',
  ]);
});

test('an empty or missing review parses to nothing', () => {
  assert.deepEqual(parseRanking(''), []);
  assert.deepEqual(parseRanking(undefined), []);
});

// --- aggregating the peer review ------------------------------------------

test('averages each model position and sorts best first', () => {
  const labelToModel = { 'Response A': 'alpha/one', 'Response B': 'beta/two' };
  const reviews = [
    { model: 'alpha/one', text: 'FINAL RANKING:\n1. Response B\n2. Response A' },
    { model: 'beta/two', text: 'FINAL RANKING:\n1. Response B\n2. Response A' },
  ];

  const result = aggregateRankings(reviews, labelToModel);
  assert.equal(result[0].model, 'beta/two');
  assert.equal(result[0].average_rank, 1);
  assert.equal(result[0].rankings_count, 2);
  assert.equal(result[1].average_rank, 2);
});

test('a judge that failed to review does not break the tally', () => {
  const labelToModel = { 'Response A': 'alpha/one' };
  const result = aggregateRankings(
    [{ model: 'alpha/one', text: '' }],
    labelToModel
  );
  assert.deepEqual(result, []);
});

// --- prompts ---------------------------------------------------------------

test('stage 2 hides model names behind letters', () => {
  const answers = [
    { model: 'openai/secret-model', text: 'first answer' },
    { model: 'google/other-model', text: 'second answer' },
  ];
  const { prompt, labelToModel } = buildRankingPrompt('why?', answers);

  assert.ok(!prompt.includes('openai/secret-model'), 'leaked a model name');
  assert.ok(!prompt.includes('google/other-model'), 'leaked a model name');
  assert.ok(prompt.includes('Response A:\nfirst answer'));
  assert.deepEqual(labelToModel, {
    'Response A': 'openai/secret-model',
    'Response B': 'google/other-model',
  });
});

test('follow-up questions carry the earlier exchange', () => {
  const messages = buildMessages(
    [{ question: 'first?', answer: 'the verdict' }],
    'second?'
  );
  assert.deepEqual(messages, [
    { role: 'user', content: 'first?' },
    { role: 'assistant', content: 'the verdict' },
    { role: 'user', content: 'second?' },
  ]);
});

// --- cost estimate ---------------------------------------------------------

const PRICES = [
  { id: 'a/one', promptPrice: 2, completionPrice: 10 },
  { id: 'b/two', promptPrice: 2, completionPrice: 10 },
];

test('more judges costs more', () => {
  const one = estimateCost(['a/one'], 'a/one', PRICES).estimate;
  const two = estimateCost(['a/one', 'b/two'], 'a/one', PRICES).estimate;
  assert.ok(two > one, 'two judges should cost more than one');
  assert.ok(one > 0);
});

test('flags itself as incomplete when a price is unknown', () => {
  const result = estimateCost(['a/one', 'mystery/model'], 'a/one', PRICES);
  assert.equal(result.complete, false);
});

// --- streaming -------------------------------------------------------------

/** Pretend to be OpenRouter, handing back bytes in awkward chunks. */
function fakeFetch(chunks, { ok = true, status = 200 } = {}) {
  return async () => ({
    ok,
    status,
    json: async () => ({ error: { message: 'nope' } }),
    body: {
      getReader() {
        let i = 0;
        return {
          read: async () =>
            i < chunks.length
              ? { done: false, value: new TextEncoder().encode(chunks[i++]) }
              : { done: true },
        };
      },
    },
  });
}

test('reassembles events that are split across network chunks', async () => {
  // the second event is deliberately cut in half mid-JSON
  global.fetch = fakeFetch([
    'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n' + 'data: {"choi',
    'ces":[{"delta":{"content":"lo"}}]}\n\n',
    'data: {"choices":[],"usage":{"cost":0.0025}}\n\ndata: [DONE]\n\n',
  ]);

  const seen = [];
  const result = await streamModel('sk-or-test', 'a/one', [], (channel, text) =>
    seen.push([channel, text])
  );

  assert.equal(result.text, 'Hello', 'dropped text from a split chunk');
  assert.equal(result.cost, 0.0025, 'missed the cost in the final message');
  assert.ok(seen.length > 0, 'never reported any text to the UI');
});

test('separates thinking from the answer', async () => {
  global.fetch = fakeFetch([
    'data: {"choices":[{"delta":{"reasoning":"hmm"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"answer"}}]}\n\ndata: [DONE]\n\n',
  ]);

  const channels = [];
  const result = await streamModel('sk-or-test', 'a/one', [], (channel) =>
    channels.push(channel)
  );

  assert.equal(result.text, 'answer', 'thinking leaked into the answer');
  assert.ok(channels.includes('reasoning'));
});

test('turns a rejected key into a message a person can act on', async () => {
  global.fetch = fakeFetch([], { ok: false, status: 401 });
  await assert.rejects(
    () => streamModel('sk-or-bad', 'a/one', [], () => {}),
    /API key was rejected/
  );
});

test('says plainly when you are out of credits', async () => {
  global.fetch = fakeFetch([], { ok: false, status: 402 });
  await assert.rejects(
    () => streamModel('sk-or-test', 'a/one', [], () => {}),
    /out of OpenRouter credits/
  );
});

// --- what's shown while text streams in ------------------------------------

import { balanceMarkdown, nameNames } from '../src/lib/text.js';

test('closes bold that has not finished streaming', () => {
  assert.equal(balanceMarkdown('**No, not'), '**No, not**');
  assert.equal(balanceMarkdown('**No.** Done'), '**No.** Done');
  assert.equal(balanceMarkdown('an *idea'), 'an *idea*');
});

test('bubbles name the model behind each anonymous label', () => {
  const labels = { 'Response A': 'openai/gpt-x', 'Response B': 'google/gemini-y' };
  assert.equal(
    nameNames('Response A hedges, Response B is right.', labels),
    'gpt-x hedges, gemini-y is right.'
  );
  assert.equal(nameNames('no labels here', null), 'no labels here');
});
