export type LLMProvider = 'openai' | 'anthropic' | 'openrouter';
export type LLMCodeModel =
  | 'claude-3-5-sonnet-latest'
  | 'claude-3-5-haiku-latest'
  | 'claude-3-opus-latest'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o1'
  | 'o1-mini'
  | 'o1-preview'
  | 'openrouter/auto'
  | 'anthropic/claude-3.5-sonnet'
  | 'google/gemini-flash-1.5'
  | 'openai/gpt-4o-mini';
