import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  IInitializeAppInput,
  IGenerateCodeForComponentInput,
  ZInitializeAppResponseType,
  ZInitializeAppResponseSchema,
  ZGenerateCodeForComponentResponseSchema,
  ZGenerateCodeForComponentResponseType,
  IGenerateCodeForComponentResponse,
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

  getInstructionsPrompt(): string {
    return this.instructions;
  }

  getResponseFormatPrompt(): string {
    const responseSchema = zodResponseFormat(this.responseSchema, 'json');
    return `Response must be JSON using the following schema: ${JSON.stringify(responseSchema)}`;
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
    Make sure the app uses expo-router for navigation and file path of the components are consistent.
    Make sure that app/index.tsx is the entry point of the app.
    
    Create app for: ${input.userMessage}. Do not create too many componnets. Keep it simple and functional.`;
    super(input, instructions, ZInitializeAppResponseSchema);
  }
}

export class GenerateCodeForComponentPrompt extends PromptBase<
  IGenerateCodeForComponentInput,
  ZGenerateCodeForComponentResponseType
> {
  constructor(input: IGenerateCodeForComponentInput) {
    const instructions = `Request: Generate code for component ${input.name} located at path: ${input.path}. Purpose of the component: ${input.purpose}. Type: ${input.type}.
    Do not create placeholder code. Write the actual code that will be used in production.
    If the code uses any media like image, sound etc.. include the media as assets in the code.
    This component is part of an react native expo app. Design of the app: ${input.design}.
    Tech stack: ${input.techStack}.
    Reuse code from dependencies if possible.
    Code for dependent components: ${getPromptForDependentCode(input.dependencies)}.
    Make sure to import the dependencies correctly based on path when using code from dependencies.
    Make sure to use only available code from dependencies and if code is not available, generate code for the dependency first and then reuse. Make sure to send the updated dependencies back in the response.`;
    super(input, instructions, ZGenerateCodeForComponentResponseSchema);
  }
}

function getPromptForDependentCode(
  dependencies: IGenerateCodeForComponentResponse[],
): string {
  return dependencies
    .map(
      (dependency) =>
        `Code for ${dependency.componentName} is located at path ${dependency.filePath}
      <!------------------------------CODE START------------------------------------------->
      ${dependency.content}
      <!------------------------------CODE END------------------------------------------->`,
    )
    .join('\n');
}
