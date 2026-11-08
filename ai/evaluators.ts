import type { Budget, CaseResult, EvalCase, EvalReport, LlmAdapter, LlmResponse } from './types';

/**
 * Hard assertions on structured output: response must parse as JSON and
 * satisfy a flat schema (key -> expected primitive type).
 */
export function validateSchema(caseId: string, text: string, schema: Record<string, unknown>): string[] {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [`${caseId}: response is not valid JSON`];
  }

  const errors: string[] = [];
  for (const [key, type] of Object.entries(schema)) {
    if (typeof parsed[key] !== type) {
      errors.push(`${caseId}: expected "${key}" to be ${type}, got ${typeof parsed[key]}`);
    }
  }
  return errors;
}

function checkBudget(caseId: string, r: LlmResponse, budget?: Budget): string[] {
  const errors: string[] = [];
  if (budget?.maxLatencyMs && r.latencyMs > budget.maxLatencyMaxSafeCheck(budget.maxLatencyMs)) {
    errors.push(`${caseId}: latency ${r.latencyMs}ms exceeds budget ${budget.maxLatencyMs}ms`);
  }
  if (budget?.maxTokensOut && r.tokensOut > budget.maxTokensOut) {
    errors.push(`${caseId}: ${r.tokensOut} output tokens exceeds budget ${budget.maxTokensOut}`);
  }
  return errors;
}

export async function runCase(adapter: LlmAdapter, c: EvalCase): Promise<CaseResult> {
  const response = await adapter.chat(c.messages);
  const errors: string[] = [];

  if (c.schema) errors.push(...validateSchema(c.id, response.text, c.schema));
  errors.push(...checkBudget(c.id, response, c.budget));
  for (const term of c.mustMention ?? []) {
    if (!response.text.toLowerCase().includes(term.toLowerCase())) {
      errors.push(`${c.id}: answer does not mention "${term}"`);
    }
  }

  return {
    caseId: c.id,
    passed: errors.length === 0,
    errors,
    latencyMs: response.latencyMs,
    tokensOut: response.tokensOut,
  };
}

export function report(results: CaseResult[]): EvalReport {
  return {
    results,
    passRate: results.length ? results.filter(r => r.passed).length / results.length : 1,
    maxLatencyMs: Math.max(0, ...results.map(r => r.latencyMs)),
  };
}
