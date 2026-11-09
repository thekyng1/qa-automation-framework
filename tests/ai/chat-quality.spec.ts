import { test, expect } from '../../ai/fixtures/llm.fixture';

const CASES = [
  {
    id: 'refund-policy',
    messages: [
      { role: 'system' as const, content: 'Company policy: Orders may be returned within 30 days. Answer using this policy.' },
      { role: 'user' as const, content: 'What is the return window for orders? [case:refund-policy]' },
    ],
    schema: { answer: 'string' },
    budget: { maxLatencyMs: 4000, maxTokensOut: 200 },
    mustMention: ['30 days'],
  },
  {
    id: 'shipping-cost',
    messages: [
      { role: 'system' as const, content: 'Company policy: Standard shipping is free for orders over 50 EUR; otherwise 4.90 EUR. Answer using this policy.' },
      { role: 'user' as const, content: 'How much does shipping cost for a 60 EUR order? [case:shipping-cost]' },
    ],
    schema: { answer: 'string' },
    budget: { maxLatencyMs: 4000, maxTokensOut: 200 },
    mustMention: ['free'],
  },
  {
    id: 'out-of-scope',
    messages: [
      { role: 'system' as const, content: 'Company policy: You only answer questions about orders, shipping and returns. For anything else, apologize and say you cannot help with that topic. Answer using this policy.' },
      { role: 'user' as const, content: 'Can you write me a poem about the sea? [case:out-of-scope]' },
    ],
    schema: { answer: 'string' },
    budget: { maxLatencyMs: 4000, maxTokensOut: 200 },
    mustMention: ['cannot'],
  },
];

test.describe('AI layer — statistical thresholds, not single-shot luck', () => {
  test('answers comply with schema, budget and grounding', async ({ eval: runEval }, testInfo) => {
    const result = await runEval(CASES, 5);

    testInfo.attach('ai-responses', { body: JSON.stringify(result), contentType: 'application/json' }); // 5 runs -> passRate is meaningful

    // Diagnostics FIRST: log failures before any assertion can abort the test.
    result.results.filter(r => !r.passed).forEach(r => {
      console.error(`[eval:${r.caseId}]`, r.errors);
    });

    expect(result.passRate).toBeGreaterThanOrEqual(0.8);
    expect(result.maxLatencyMs).toBeLessThan(4000);
  });

  test('failures are reported, never silently green', async ({ eval: runEval }) => {
    const result = await runEval(CASES, 1);
    for (const r of result.results) {
      expect(r.passed || r.errors.length > 0).toBeTruthy();
    }
  });
});
