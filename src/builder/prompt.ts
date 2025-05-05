import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  IBackendDetails,
  IGenerateCodeForComponentInput,
  IGenericStack,
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
import { getPromptForAuthenticationMethod } from './backend/serviceStack';
import { TOOL_IMAGE_ANALYZER } from './constants';

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

  getResponseFormatSchema(): z.ZodSchema<TOutput> {
    return this.responseSchema;
  }

  getResponseFormatPrompt(): string {
    const responseSchema = zodResponseFormat(this.responseSchema, 'json');
    return `I need you to generate a JSON response based on the following schema:
    ${JSON.stringify(responseSchema)}`;
  }

  validateResponse(response: any): TOutput {
    return this.responseSchema.parse(response);
  }
}

function getPromptForDesignConfig(
  designConfig: IGenericStack['designConfig'],
): string {
  let imageInstructions = '';
  if (designConfig.images && designConfig.images.length > 0) {
    imageInstructions = `User has provided some image urls as design references. Image references to be used for design: ${JSON.stringify(designConfig.images)}. Use the ${TOOL_IMAGE_ANALYZER} tool to understand the images and incorporate the design elements into the app.`;
  }
  return imageInstructions;
}

export class InitializeMobileAppWithBackendPrompt extends PromptBase<
  IInitializeAppInput,
  ZInitializeAppWithBackendResponseType
> {
  constructor(input: IInitializeAppInput) {
    const backendConfig = input.techStack.backendConfig;
    let instructions;
    const imageInstructions = getPromptForDesignConfig(
      input.techStack.designConfig,
    );

    if (backendConfig.useExisting && backendConfig.details) {
      instructions = `
      You are an expert at building fullstack mobile applications using Supabase as backend and Expo + React Native for frontend.
      User has an existing supabase backend and wants to build a mobile app using the existing backend. Here are the backend details:
      ${getPromptForExistingBackend(backendConfig.details)}
      ${imageInstructions}
      Given request for creating an app, use the backend details to understand the backend and the database schema using the types definition.
      Now architect the frontend of the system using the existing backend. You will first think through the problem and come up with an extensive list of features for the app.
      Represent the archietcture as a mermaid diagram. Keep it simple and functional. Do not generate the SQL scripts for the database.

      Then to implement the app, come up with the list of components that can be derived from the app architecture. For now components are just placeholders and code for the components will be requested later.

      Assume the project code will be created using 'npx create-expo-app' and uses expo-router with typescript template.
      This is the tech stack that will be used: ${getPromptForMobileStack(
        input.techStack as IMobileTechStackOptions,
      )}

      Authentication: ${getPromptForAuthenticationMethod(input.techStack)}.

      ${getPromptForComponentDesign(input.techStack.framework)}

      User will first request architecture and design for the app and request code the components one by one sequentially.
      If the user asks a non-programming question, politely decline to respond.
      `;
    } else {
      instructions = `
      You are an expert at building fullstack mobile applications using Supabase as backend and Expo + React Native for frontend.
      ${imageInstructions}
      Given a request for creating an app, you will first think through the problem and come up with an extensive list of features for the app.
      You will first architect the app using database, data and UI components that will enable the functionality of the app. Represent the architecture as a mermaid diagram. Keep it simple and functional.
      Then to implement the app, come up with the list of components that can be derived from the app architecture. For now components are just placeholders and code for the components will be requested later.

      Assume the project code will be created using 'npx create-expo-app' and uses expo-router with typescript template.
      This is the tech stack that will be used: ${getPromptForMobileStack(
        input.techStack as IMobileTechStackOptions,
      )}

      Authentication: ${getPromptForAuthenticationMethod(input.techStack)}.

      ${getPromptForComponentDesign(input.techStack.framework)}

      User will first request architecture and design for the app and request code the components one by one sequentially.
      If the user asks a non-programming question, politely decline to respond.
      `;
    }
    super(input, instructions, ZInitializeAppWithBackendResponseSchema);
  }
}

function getPromptForExistingBackend(backendDetails: IBackendDetails) {
  // TODO
  return `The backend uses ${backendDetails.type} as the backend. Here are the details:\
  ----------------------------------------\
  authConfig: ${backendDetails.authConfig || 'none'}\
  -----------------------------------------\
  types: ${backendDetails.types || 'none'}\
  -----------------------------------------\
  docs: ${backendDetails.docs || 'none'}\
  -----------------------------------------\
  `;
}

export class InitializeMobileAppPrompt extends PromptBase<
  IInitializeAppInput,
  ZInitializeAppResponseType
> {
  constructor(input: IInitializeAppInput) {
    const designConfig = input.techStack.designConfig;
    const imageInstructions = getPromptForDesignConfig(designConfig);
    const instructions = `
    You are an expert at building mobile apps using react native and expo. For simplicity, we are not using a backend for this app.
    
    Given a request for creating an app, you will first think through the problem and come up with an extensive list of features for the app.
    ${imageInstructions}
    You will first architect the app components that will enable the functionality of the app. Represent the architecture as a mermaid diagram. Keep it simple and functional.
    Then to implement the app, come up with the list of components that can be derived from the app architecture. For now components are just placeholders and code for the components will be requested later.

    Assume the project code will be initialized using 'npx create-expo-app' and uses expo-router with typescript template.
    This is the tech stack that will be used: ${getPromptForMobileStack(
      input.techStack as IMobileTechStackOptions,
    )}

    ${getPromptForComponentDesign(input.techStack.framework)}

    User will first request architecture and design for the app and request code the components one by one sequentially.
    If the user asks a non-programming question, politely decline to respond.`;
    super(input, instructions, ZInitializeAppResponseSchema);
  }
}

export class InitializeWebAppWithBackendPrompt extends PromptBase<
  IInitializeAppInput,
  ZInitializeAppWithBackendResponseType
> {
  constructor(input: IInitializeAppInput) {
    const backendConfig = input.techStack.backendConfig;
    const designConfig = input.techStack.designConfig;
    let instructions;
    const imageInstructions = getPromptForDesignConfig(designConfig);

    if (backendConfig.useExisting && backendConfig.details) {
      instructions = `
      You are an expert at building fullstack web applications using Supabase as backend and Next.js as the web framework.
      User has an existing supabase backend and wants to build a web app using the existing backend. Here are the backend details:
      ${getPromptForExistingBackend(backendConfig.details)}
      ${imageInstructions}
      Given request for creating an app, use the backend details to understand the backend and the database schema using the types definition.
      Now architect the frontend of the system using the existing backend. You will first think through the problem and come up with an extensive list of features for the app.
      Represent the architecture as a mermaid diagram. Keep it simple and functional. Do not generate the SQL scripts for the database.
      Then to implement the app, come up with the list of components that can be derived from the app architecture. For now components are just placeholders and code for the components will be requested later.

      Assume web app will be built using nextjs with typescript template by running command 'npx create-next-app@latest {PROJECT_NAME} --eslint --src-dir --tailwind --ts --app --turbopack --import-alias '@/*'.
      This is the tech stack that will be used: ${getPromptForWebStack(
        input.techStack as IWebTechStackOptions,
      )}.

      Authentication: ${getPromptForAuthenticationMethod(input.techStack)}.

      ${getPromptForComponentDesign(input.techStack.framework)}

      User will first request architecture and design for the app and request code the components one by one sequentially.
      If the user asks a non-programming question, politely decline to respond.`;
    } else {
      instructions = `
      You are an expert at building fullstack web applications using Supabase as the backend and Next.js as the web framweork.
      ${imageInstructions}
      Given a request for creating an app, you will first think through the problem and come up with an extensive list of features for the app.
      You will first architect the app using database, server and client components that will enable the functionality of the app. Represent the architecture as a mermaid diagram. Keep it simple and functional.
      Then to implement the app, come up with the list of components that can be derived from the app architecture. For now components are just placeholders and code for the components will be requested later.

      Assume web app will be built using nextjs with typescript template by running command 'npx create-next-app@latest {PROJECT_NAME} --eslint --src-dir --tailwind --ts --app --turbopack --import-alias '@/*'.
      This is the tech stack that will be used: ${getPromptForWebStack(input.techStack as IWebTechStackOptions)}.

      Authentication: ${getPromptForAuthenticationMethod(input.techStack)}.

      ${getPromptForComponentDesign(input.techStack.framework)}

      User will first request architecture and design for the app and request code the components one by one sequentially.
      If the user asks a non-programming question, politely decline to respond.`;
    }

    super(input, instructions, ZInitializeAppWithBackendResponseSchema);
  }
}

export class InitializeWebAppPrompt extends PromptBase<
  IInitializeAppInput,
  ZInitializeAppResponseType
> {
  constructor(input: IInitializeAppInput) {
    const designConfig = input.techStack.designConfig;
    const imageInstructions = getPromptForDesignConfig(designConfig);
    const instructions = `
      You are an expert at building web applications. For simplicity, we are not using a backend for this app.
      ${imageInstructions}
      Given a request for creating an app, you will first think through the problem and come up with an extensive list of features for the app.
      You will first architect the app components that will enable the functionality of the app. Represent the architecture as a mermaid diagram. Keep it simple and functional.
      Then to implement the app, come up with the list of components that can be derived from the app architecture. For now components are just placeholders and code for the components will be requested later.

      Assume the webapp will be built using next.js with typescript template by running command 'npx create-next-app@latest {PROJECT_NAME} --eslint --src-dir --tailwind --ts --app --turbopack --import-alias '@/*'.
      This is the tech stack that will be used: ${getPromptForWebStack(input.techStack as IWebTechStackOptions)}.

      ${getPromptForComponentDesign(input.techStack.framework)}

      User will first request architecture and design for the app and request code the components one by one sequentially.
      If the user asks a non-programming question, politely decline to respond.`;

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
    This component is part of an react native app. Architecture of the app as a mermaid diagram: ${input.architecture}.
    Design used for the app: ${input.design}.
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
    This component is part of an web app. Architecture of the app as a mermaid diagram: ${input.architecture}.
    Design used for the app: ${input.design}.
    Generate code in typescript and make sure the code is properly typed, functional and error free.
    Do not create placeholder code. Write the actual code that will be used in production.
    If the code uses any media like image or sound, do not generate the media. Just use placeholder text and include the media as asset in the response.
    If the code uses any external libraries, include the libraries in the response so they can be installed later.
    Specify "use client" directive in the code if the component is a client component.
    When using code from dependencies, make sure to import the dependencies correctly based on path.
    Code for dependent components:
    ${getPromptForDependentCode(input.dependencies)}.`;
    super(input, instructions, ZGenerateCodeForComponentResponseSchema);
  }
}

function getPromptForDependentCode(
  dependencies: ZGenerateCodeForComponentResponseType[],
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

function getPromptForComponentDesign(framework: string) {
  return `
  Things to keep in mind when designing the app:
  1. Code for components will be requested later so all components must be listed in the response.
  2. A component can be dependent on another component. If a component is dependent on another component, make sure to list the components as dependents in the response.
  3. There should be no circular dependencies between components.
  4. Make sure the app has a home page which acts as the entry point of the app.
  5. Make sure the components design adhere to the framework we are using and the file path of the components are consistent.
  6. Use the best practices suggested by the ${framework} framework.
  `;
}
