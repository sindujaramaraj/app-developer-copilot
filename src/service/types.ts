export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'copilot';
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
  | 'anthropic/claude-3.5-haiku'
  | 'anthropic/claude-3-opus'
  | 'openai/gpt-4o'
  | 'openai/gpt-4o-mini'
  | 'openai/o1'
  | 'openai/o1-mini'
  | 'openai/o1-preview';
