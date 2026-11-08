import { test as base } from '@playwright/test';
import { DeepSeekAdapter } from '../adapters/deepseek-adapter';
import { MockAdapter } from '../adapters/mock-adapter';
import { report, runCase } from '../evaluators';
import type { CaseResult, EvalCase, EvalReport, LlmAdapter } from '../types';

// Scripted replies for mock mode (CI). Keyed by the [case:<id>] tag.
const MOCK_REPLIES: Record<string, string> = {
  'refund-policy': '{"answer":"Orders can be returned within 30 days of delivery."}',
  default: '{"answer":"mock"}',
};

// Real mode is explicit opt-in: AI_EVAL_MODE=real + DEEPSEEK_API_KEY.
// CI never sets AI_EVAL_MODE, so it always runs the free deterministic mock.
const useReal = process.env.AI_EVAL_MODE === 'real' && !!process.env.DEEPSEEK_API_KEY;

export interface LlmFixtures {
  llm: LlmAdapter;
  eval: (cases: EvalCase[], runs?: number) => Promise<EvalReport>;
}

export const test = base.extend<LlmFixtures>({
  llm: async (_, use) => {
    await use(
      useReal
        ? new DeepSeekAdapter(process.env.DEEPSEEK_API_KEY as string)
        : new MockAdapter(MOCK_REPLIES),
    );
  },
  eval: async ({ llm }, use) => {
    await use(async (cases, runs = 1) => {
      const all: CaseResult[] = [];
      for (let i = 0; i < runs; i++) {
        for (const c of cases) all.push(await runCase(llm, c));
      }
      return report(all);
    });
  },
});

export const expect = base.expect;
