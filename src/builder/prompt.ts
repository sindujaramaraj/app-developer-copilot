import Joi from 'joi';
import parse from 'joi-to-json';
import {
  IInitializeAppResponse,
  InitializeAppResponseSchema,
  IInitializeAppInput,
  IGenerateCodeForComponentInput,
  IGenerateCodeForComponentResponse,
  GenerateCodeForComponentResponseSchema,
} from './types';

export class PromptBase<TInput, TOutput> {
  protected input: TInput;
  /* User message to the LM */
  protected instructions: string;
  /* Format for the LM response */
  protected responseSchema: Joi.Schema<TOutput>;

  constructor(
    input: TInput,
    instructions: string,
    responseSchema: Joi.Schema<TOutput>,
  ) {
    this.input = input;
    this.instructions = instructions;
    this.responseSchema = responseSchema;
  }

  getPromptText(): string {
    const responseSchema = parse(this.responseSchema);
    return `${this.instructions} Response must be JSON using the following schema: ${JSON.stringify(responseSchema)}`;
  }

  validateResponse(response: any): Joi.ValidationResult<TOutput> {
    return this.responseSchema.validate(response);
  }
}

export class InitializeAppPrompt extends PromptBase<
  IInitializeAppInput,
  IInitializeAppResponse
> {
  constructor(input: IInitializeAppInput) {
    const instructions = `
    First think through the problem and design the app. You don't have to add authentication to the app.
    Use default theme for the app and do not configure or create any custom theme.
    First, analyse the problem. Decide on features and design the architecture of the app as a mermaid diagram.
    Then to implement the app, think through and create components for the app.
    Make sure there are no circular dependencies between components.
    Make sure the app uses expo-router for navigation and file path of the components are correct.
    Assume the app is initialized using 'npx create-expo-app' and uses expo-router with typescript template.
    Create app for: ${input.userMessage}.`;
    super(input, instructions, InitializeAppResponseSchema);
  }
}

export class GenerateCodeForComponentPrompt extends PromptBase<
  IGenerateCodeForComponentInput,
  IGenerateCodeForComponentResponse
> {
  constructor(input: IGenerateCodeForComponentInput) {
    const instructions = `Request: Generate code for component ${input.name}. Purpose of the component: ${input.purpose}. Type: ${input.type}.
    Do not create placeholder code. Write the actual code that will be used in production.
    If the code uses any media like image, sound etc.. include the media as assets in the code.
    This component is part of an expo app. Design of the expo app: ${input.design}.
    Reuse code from dependencies if possible.
    Component Dependencies: ${JSON.stringify(input.dependencies)}.
    Tech stack: ${input.techStack}.`;
    super(input, instructions, GenerateCodeForComponentResponseSchema);
  }
}
