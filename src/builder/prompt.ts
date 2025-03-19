import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  IGenerateCodeForComponentInput,
  IGenerateCodeForComponentResponse,
  IInitializeAppInput,
  ZGenerateCodeForComponentResponseSchema,
  ZGenerateCodeForComponentResponseType,
  ZInitializeAppResponseSchema,
  ZInitializeAppResponseType,
  ZInitializeAppWithBackendResponseSchema,
  ZInitializeAppWithBackendResponseType,
} from './types';
import {
  getPromptForMobileStack,
  IMobileTechStackOptions,
} from './mobile/mobileTechStack';
import { getPromptForWebStack, IWebTechStackOptions } from './web/webTechStack';

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
    return `Response must be JSON using the following schema: ${JSON.stringify(
      responseSchema,
    )}`;
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
    Tech stack: ${getPromptForMobileStack(
      input.techStack as IMobileTechStackOptions,
    )}
    First, analyse the problem. Decide on features and design the architecture of the app as a mermaid diagram.
    Then to implement the app, think through and create components for the app.
    Make sure there are no circular dependencies between components.
    Make sure the app uses expo-router for navigation and file path of the components are consistent.
    Make sure that app/index.tsx is the entry point of the app.
    Do not create too many components. Use default theme for UI if available. Keep it simple and functional.`;
    super(input, instructions, ZInitializeAppResponseSchema);
  }
}

export class InitializeWebAppWithBackendPrompt extends PromptBase<
  IInitializeAppInput,
  ZInitializeAppWithBackendResponseType
> {
  constructor(input: IInitializeAppInput) {
    const instructions = `
      You are an expert at building web applications using Supabase as the backend and Next.js as the web framweork.
      Given a request for creating an app, you will first think through the problem and come up with an extensive list of features for the app.
      You will first design the app using database, server and client components that will enable the functionality of the app. Represent the design as a mermaid diagram. Do not create too many components. Keep it simple and functional.
      Then to implement the app, come up with the list of components that can be derived from the app design. For now components are just placeholders and code for the components will be requested later.

      Assume web app will be built using nextjs with typescript template by running command 'npx create-next-app@latest {PROJECT_NAME} --eslint --src-dir --tailwind --ts --app --turbopack --import-alias '@/*'.
      This is the tech stack that will be used: ${getPromptForWebStack(input.techStack as IWebTechStackOptions)}.
      
      Things to keep in mind when designing the app:
      1. Code for components will be requested later so all components must be listed in the response.
      2. A component can be dependent on another component. If a component is dependent on another component, make sure to list the components as dependents in the response.
      3. There should be no circular dependencies between components.
      4. Make sure the components design adhere to the framework we are using and the file path of the components are consistent.
    
      User will first request design for the app and request code the components one by one sequentially.
      If the user asks a non-programming question, politely decline to respond.`;

    super(input, instructions, ZInitializeAppWithBackendResponseSchema);
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
      Tech stack: ${getPromptForWebStack(input.techStack as IWebTechStackOptions)}.
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
    Tech stack: ${getPromptForMobileStack(input.techStack as IMobileTechStackOptions)}.
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
    Tech stack: ${getPromptForWebStack(input.techStack as IWebTechStackOptions)}.
    This component is part of an web app. Design of the app as a mermaid diagram: ${input.design}.
    Generate code in typescript and make sure the code is properly typed, functional and error free.
    Do not create placeholder code. Write the actual code that will be used in production.
    If the code uses any media like image or sound, do not generate the media. Just use placeholder text and include the media as asset in the response.
    If the code uses any external libraries, include the libraries in the response so they can be installed later.
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
