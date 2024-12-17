import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';

export async function requestLLM() {
  const openrouter = createOpenRouter({
    apiKey:
      process.env.OPENROUTER_API_KEY ||
      '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',
  });

  const { object } = await generateObject({
    model: openrouter('llm'),
    schema: z.object({
      code: z.string(),
      design: z.string(),
      features: z.string(),
    }),
    messages: [
      {
        content:
          'You are a expert at building mobile systems using react native and typescript using expo framework.',
        role: 'system',
      },
      {
        content:
          'Help me build a mobile app that allows users to create and share their own recipes.',
        role: 'user',
      },
    ],
  });

  console.log(JSON.stringify(object, null, 2));
}

requestLLM();
