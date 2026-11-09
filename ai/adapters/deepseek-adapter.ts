import type { LlmAdapter, LlmMessage, LlmResponse } from '../types';

const ENDPOINT = 'https://api.deepseek.com/chat/completions';

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

// Păstrează instrucțiunile system existente și adaugă cerința de format
    // pentru schema folosită de test: { "answer": "string" }.
    const existingSystem = messages
      .filter(message => message.role === 'system')
      .map(message => message.content)
      .join('\n\n');

const requestMessages: LlmMessage[] = [
      {
        role: 'system',
        content: [
          existingSystem,
          'Return only a valid JSON object matching this shape: {"answer":"string"}.',
          'Do not include Markdown or code fences.',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
      ...messages.filter(message => message.role !== 'system'),
    ];

const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: requestMessages,
        response_format: { type: 'json_object' },
        max_tokens: 200,
      }),
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
