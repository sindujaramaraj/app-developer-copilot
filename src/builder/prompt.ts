import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  IInitializeAppInput,
  IGenerateCodeForComponentInput,
  ZInitializeAppResponseType,
  ZInitializeAppResponseSchema,
  ZGenerateCodeForComponentResponseSchema,
  ZGenerateCodeForComponentResponseType,
} from './types';

export class PromptBase<TInput, TOutput> {
  protected input: TInput;
  /* User message to the LM */
  protected instructions: string;
  /* Format for the LM response */
  protected responseSchema: z.ZodSchema<TOutput>;

  constructor(
    input: TInput,
    instructions: string,
    responseSchema: z.ZodSchema<TOutput>,
  ) {
    this.input = input;
    this.instructions = instructions;
    this.responseSchema = responseSchema;
  }

  getPromptText(): string {
    const responseSchema = zodResponseFormat(this.responseSchema, 'json');
    return `${this.instructions} Response must be JSON using the following schema: ${JSON.stringify(responseSchema)}`;
  }

  validateResponse(response: any): TOutput {
    return this.responseSchema.parse(response);
  }
}

export class InitializeAppPrompt extends PromptBase<
  IInitializeAppInput,
  ZInitializeAppResponseType
> {
  constructor(input: IInitializeAppInput) {
    const instructions = `
    First think through the problem and design the mobile app using react-native and expo. Use expo-router for navigation.
    Assume the app is initialized using 'npx create-expo-app' and uses expo-router with typescript template.
    You don't have to add authentication to the app.
    Use default theme for the app and do not configure or create any custom theme.
    First, analyse the problem. Decide on features and design the architecture of the app as a mermaid diagram.
    Then to implement the app, think through and create components for the app.
    Make sure there are no circular dependencies between components.
    Make sure the app uses expo-router for navigation and file path of the components are correct.
    Make sure that app/index.tsx is the entry point of the app.
    
    Create app for: ${input.userMessage}.`;
    super(input, instructions, ZInitializeAppResponseSchema);
  }
}

export class GenerateCodeForComponentPrompt extends PromptBase<
  IGenerateCodeForComponentInput,
  ZGenerateCodeForComponentResponseType
> {
  constructor(input: IGenerateCodeForComponentInput) {
    const instructions = `Request: Generate code for component ${input.name}. Purpose of the component: ${input.purpose}. Type: ${input.type}.
    Do not create placeholder code. Write the actual code that will be used in production.
    If the code uses any media like image, sound etc.. include the media as assets in the code.
    This component is part of an expo app. Design of the expo app: ${input.design}.
    Reuse code from dependencies if possible.
    Component Dependencies: ${JSON.stringify(input.dependencies)}.
    Tech stack: ${input.techStack}.`;
    super(input, instructions, ZGenerateCodeForComponentResponseSchema);
  }
}
