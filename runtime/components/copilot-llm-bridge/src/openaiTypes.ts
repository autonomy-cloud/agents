// Minimal subset of the OpenAI chat-completions wire format -- just enough
// to be a valid `base_url` for any OpenAI-SDK-compatible client (e.g.
// openagents-coworker's `openai.LLM(base_url=..., api_key=...)`).
// Not a full re-implementation: no function/tool-calling translation (see
// README's "Known limitations").

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  name?: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: { role: 'assistant'; content: string };
  finish_reason: 'stop' | 'length';
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: { role?: 'assistant'; content?: string };
  finish_reason: 'stop' | 'length' | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
}

export interface ModelListEntry {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}
