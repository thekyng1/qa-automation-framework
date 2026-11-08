import type { LlmAdapter, LlmMessage, LlmResponse } from '../types';

const ENDPOINT = 'https://api.deepseek.com/chat/completions';

/**
 * Real adapter over the DeepSeek API (OpenAI-compatible schema).
 * Auth comes from env only — the key is never committed.
 * Activated by AI_EVAL_MODE=real + DEEPSEEK_API_KEY; CI defaults to mock.
 */
export class DeepSeekAdapter implements LlmAdapter {
  readonly provider = 'deepseek';
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model = 'deepseek-chat',
  ) {
    this.model = model;
  }

  async chat(messages: LlmMessage[]): Promise<LlmResponse> {
    const started = Date.now();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, messages }),
    });

    if (!res.ok) {
      throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      text: data.choices?.[0]?.message?.content ?? '',
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
      model: this.model,
      provider: this.provider,
    };
  }
}
