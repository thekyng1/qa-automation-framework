export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string;
  provider: string;
}

export interface LlmAdapter {
  readonly provider: string;
  readonly model: string;
  chat(messages: LlmMessage[]): Promise<LlmResponse>;
}

export interface Budget {
  maxLatencyMs?: number;
  maxTokensOut?: number;
}

export interface EvalCase {
  id: string;
  messages: LlmMessage[];
  schema?: Record<string, unknown>;
  budget?: Budget;
  mustMention?: string[];
}

export interface CaseResult {
  caseId: string;
  passed: boolean;
  errors: string[];
  latencyMs: number;
  tokensOut: number;
}

export interface EvalReport {
  results: CaseResult[];
  passRate: number;
  maxLatencyMs: number;
}
