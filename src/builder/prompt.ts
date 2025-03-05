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
import { getWebAppCreationCommands } from './web/webTechStack';

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

export class InitializeMobileAppPrompt extends PromptBase<
  IInitializeAppInput,
  ZInitializeAppResponseType
> {
  constructor(input: IInitializeAppInput) {
    const instructions = `
    Create app for: ${input.userMessage}.
    First think through the problem and design the mobile app. Use expo-router for navigation.
    The app will be initialized using 'npx create-expo-app' and uses expo-router with typescript template.
    Tech stack: ${input.techStack}
    First, analyse the problem. Decide on features and design the architecture of the app as a mermaid diagram.
    Then to implement the app, think through and create components for the app.
    Make sure there are no circular dependencies between components.
    Make sure the app uses expo-router for navigation and file path of the components are consistent.
    Make sure that app/index.tsx is the entry point of the app.
    Do not create too many components. Use default theme for UI if available. Keep it simple and functional.`;
    super(input, instructions, ZInitializeAppResponseSchema);
  }
}

export class InitializeWebAppPrompt extends PromptBase<
  IInitializeAppInput,
  ZInitializeAppResponseType
> {
  constructor(input: IInitializeAppInput) {
    const instructions = `
    Create app for: ${input.userMessage}.
    First think through the problem and design the web app.
    The webapp will be built using next.js with typescript template by running command 'npx create-next-app@latest {PROJECT_NAME} --eslint --src-dir --tailwind --ts --app --turbopack --import-alias '@/*'.
    Tech stack: ${input.techStack}.
    First, analyse the problem. Decide on features and design the architecture of the app as a mermaid diagram.
    Then to implement the app, think through and create components for the app.
    Make sure there are no circular dependencies between components.
    Make sure the app uses the correct framework and the file path of the components are consistent.
    Use default theme provider from the ui library if available and dont create a theme provider component unless necessary.
    Do not create too many components. Keep it simple and functional.
    Include necessary commands in the response to install dependencies. Commands must run without user intervention.`;
    super(input, instructions, ZInitializeAppResponseSchema);
  }
}

export class GenerateCodeForMobileComponentPrompt extends PromptBase<
  IGenerateCodeForComponentInput,
  ZGenerateCodeForComponentResponseType
> {
  constructor(input: IGenerateCodeForComponentInput) {
    const instructions = `Generate code for component ${input.name} located at path: ${input.path}. Purpose of the component: ${input.purpose}. Type: ${input.type}.
    If this is the entry file, make sure to initialize the UI library correctly.
    Tech stack: ${input.techStack}.
    This component is part of an react native app. Design of the app as a mermaid diagram: ${input.design}.
    Generate code in typescript and make sure the code is properly typed, functional and error free.
    Do not create placeholder code. Write the actual code that will be used in production.
    If the code uses any media like image, sound etc.. don not gnerate the code for the media. Just use placeholder text and include the media in the response.
    If the code uses any external libraries, include the libraries in the response.
    Reuse code from dependencies if possible.
    When using code from dependencies, make sure to import the dependencies correctly based on path.
    Code for dependent components:
    ${getPromptForDependentCode(input.dependencies)}.`;
    super(input, instructions, ZGenerateCodeForComponentResponseSchema);
  }
}

export class GenerateCodeForWebComponentPrompt extends PromptBase<
  IGenerateCodeForComponentInput,
  ZGenerateCodeForComponentResponseType
> {
  constructor(input: IGenerateCodeForComponentInput) {
    const instructions = `Generate code for component ${input.name} located at path: ${input.path}. Purpose of the component: ${input.purpose}. Type: ${input.type}.
    If this is the entry file, make sure to initialize the UI library correctly.
    Tech stack: ${input.techStack}.
    This component is part of an web app. Design of the app as a mermaid diagram: ${input.design}.
    Generate code in typescript and make sure the code is properly typed, functional and error free.
    Do not create placeholder code. Write the actual code that will be used in production.
    If the code uses any media like image or sound, do not generate the media. Just use placeholder text and include the media as asset in the response.
    If the code uses any external libraries, include the libraries in the response.
    When using code from dependencies, make sure to import the dependencies correctly based on path.
    Code for dependent components:
    ${getPromptForDependentCode(input.dependencies)}.`;
    super(input, instructions, ZGenerateCodeForComponentResponseSchema);
  }
}

function getPromptForDependentCode(
  dependencies: IGenerateCodeForComponentResponse[],
): string {
  // TODO:  Should we include the code for configuration files?
  return dependencies
    .map(
      (dependency) =>
        `================================
          File: ${dependency.filePath}
        ================================
        ${dependency.content}`,
    )
    .join('\n');
}
