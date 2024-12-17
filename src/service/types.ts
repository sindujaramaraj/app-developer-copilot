export type LLMProvider = 'openai' | 'anthropic' | 'openrouter';

enum OpenRouterModel {
  CLAUDE_SONNET = 'anthropic/claude-3.5-sonnet',
  GPT_4O = 'openai/gpt-4o',
  GEMINI_PRO = 'google/gemini-pro', // structured output is not working with this model
}
