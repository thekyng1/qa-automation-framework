import type { LlmAdapter, LlmMessage, LlmResponse } from '../types';

/**
 * Deterministic adapter for CI. Tests embed a `[case:<id>]` tag in the
 * prompt; the adapter returns the scripted reply for that id.
 * Free, reproducible, zero network — CI stays green and fast.
 */
export class MockAdapter implements LlmAdapter {
  readonly provider = 'mock';
  readonly model = 'mock-deterministic';

  constructor(private readonly replies: Record<string, string> = {}) {}

  async chat(messages: LlmMessage[]): Promise<LlmResponse> {
    const last = messages[messages.length - 1]?.content ?? '';
    const caseId = /\[case:([a-z0-9-]+)\]/i.exec(last)?.[1] ?? 'default';
    const text = this.replies[caseId] ?? this.replies['default'] ?? 'mock reply';

    return {
      text,
      tokensIn: Math.ceil(last.length / 4),
      tokensOut: Math.ceil(text.length / 4),
      latencyMs: 5,
      model: this.model,
      provider: this.provider,
    };
  }
}
