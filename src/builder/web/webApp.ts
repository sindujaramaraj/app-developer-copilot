import { App, AppStage, IAppStageInput, IAppStageOutput } from '../app';
import {
  convertToMermaidMarkdown,
  isMermaidMarkdown,
} from '../utils/contentUtil';
import {
  GenerateCodeForWebComponentPrompt,
  InitializeWebAppPrompt,
  InitializeWebAppWithBackendPrompt,
} from '../prompt';
import {
  ComponetType,
  ZGenerateCodeForComponentResponseSchema,
  ZGenerateCodeForComponentResponseType,
  ZGenerateCodeResponseType,
  ZInitializeAppResponseSchema,
  ZInitializeAppResponseType,
  ZInitializeAppWithBackendResponseSchema,
  ZInitializeAppWithBackendResponseType,
} from '../types';
import {
  installNPMDependencies,
  runCommandWithPromise,
} from '../terminalHelper';
import { FileParser, IFile } from '../utils/fileParser';
import {
  APP_ARCHITECTURE_DIAGRAM_FILE,
  SUPA_SQL_FILE,
  SUPA_TYPES_FILE,
} from '../constants';
import { checkNodeInstallation } from '../utils/nodeUtil';
import { AppType, createAppConfig } from '../utils/appconfigHelper';
import {
  getLibsToInstallForStack,
  getWebAppCreationCommands,
  IWebTechStackOptions,
} from './webTechStack';

const WEB_BUILDER_INSTRUCTION = `You are an expert at building full stack web applications using nextjs.
You will write a very long answer. Make sure that every detail of the architecture is, in the end, implemented as code.
Make sure the architecure is simple and straightforward. Do not respond until you receive the request.
User will first request app design and then code generation.
If the user asks a non-programming question, politely decline to respond.`;

/**
 * Web app builder
 */
export class WebApp extends App {
  async precheck(): Promise<boolean> {
    this.setStage(AppStage.PreCheck);
    // Check if node is installed
    const nodeCheck = await checkNodeInstallation();
    if (!nodeCheck.installed) {
      this.logMessage(
        'Node.js is not installed. Please install Node.js to proceed',
      );
      this.setStage(AppStage.Cancelled);
      return false;
    }
    if (!nodeCheck.meetsMinimum) {
      this.logMessage(
        `Node.js version ${nodeCheck.version} is not supported. Please install Node.js version 16.0.0 or higher to proceed`,
      );
      this.setStage(AppStage.Cancelled);
      return false;
    }
    return true;
  }

  async initialize(
    userMessage?: string,
  ): Promise<IAppStageOutput<ZInitializeAppResponseType>> {
    if (!userMessage) {
      this.logMessage(
        'Please provide a valid input to start building a web app',
      );
      this.setStage(AppStage.Cancelled);
      throw new Error('Invalid input');
    }
    this.setStage(AppStage.Initialize);
    this.logMessage('Lets start building a web app');

    const promptClass = this.getTechStackOptions().backend
      ? InitializeWebAppWithBackendPrompt
      : InitializeWebAppPrompt;

    const responseSchema = this.getTechStackOptions().backend
      ? ZInitializeAppWithBackendResponseSchema
      : ZInitializeAppResponseSchema;

    const initializeAppPrompt = new promptClass({
      userMessage: userMessage,
      techStack: this.getTechStackOptions(),
    });

    const initializeAppMessages = [
      this.createSystemMessage(initializeAppPrompt.getInstructionsPrompt()),
      // Add user's message
      this.createUserMessage(`Create app for: ${userMessage}`),
    ];

    // send the request
    this.logProgress('Analyzing app requirements');
    try {
      let { response: createAppResponse, object: createAppResponseObj } =
        await this.languageModelService.generateObject<
          ZInitializeAppResponseType | ZInitializeAppWithBackendResponseType
        >({
          messages: initializeAppMessages,
          schema: responseSchema,
          responseFormatPrompt: initializeAppPrompt.getResponseFormatPrompt(),
        });
      initializeAppMessages.push(
        this.createAssistantMessage(createAppResponse),
      );

      this.logInitialResponse(createAppResponseObj);

      this.logProgress(`Creating app ${createAppResponseObj.name}`);
      const formattedAppName = createAppResponseObj.name
        .replace(/\s/g, '-')
        .toLowerCase();
      // fix app name
      createAppResponseObj.name = formattedAppName;
      // set app name
      this.setAppName(formattedAppName);
      this.setAppTitle(createAppResponseObj.title);

      await this.postInitialize(createAppResponseObj);

      // Create app config
      const modelConfig = this.languageModelService.getModelConfig();
      await createAppConfig({
        name: createAppResponseObj.name,
        title: createAppResponseObj.title,
        initialPrompt: userMessage,
        components: createAppResponseObj.components,
        features: createAppResponseObj.features,
        techStack: this.getTechStackOptions(),
        type: AppType.WEB,
        modelProvider: modelConfig.modelProvider,
        languageModel: modelConfig.model,
      });

      return {
        messages: initializeAppMessages,
        output: createAppResponseObj,
      };
    } catch (error) {
      console.error('WebBuilder: Error parsing response', error);
      throw error;
    }
  }

  async postInitialize(
    createAppResponseObj:
      | ZInitializeAppResponseType
      | ZInitializeAppWithBackendResponseType,
  ) {
    // Create web app
    this.logProgress('Running commands to create project');
    const createWebAppCommands = getWebAppCreationCommands(
      this.getTechStackOptions(),
      createAppResponseObj.name,
    );
    // Run commands to create web app
    let useNewTerminal = true;
    for (const createWebAppCommand of createWebAppCommands) {
      this.logProgress('Running command that might need user input');
      await runCommandWithPromise(
        createWebAppCommand,
        undefined,
        useNewTerminal,
      );
      useNewTerminal = false;
    }
    console.log(
      'initialization commands',
      createAppResponseObj.commands?.length,
    );
    // TODO: Not able to ensure the correctness of this commands. Lets enable later and just use the web stack creation commands
    // await this.runInitializationCommands(
    //   createAppResponseObj.commands || [],
    //   createAppResponseObj.name,
    // );

    this.logMessage(`Created web project: ${createAppResponseObj.name}`);

    // Create files
    const files: IFile[] = [];
    // Design of the app
    this.logProgress('Writing design diagram to file');
    let designDiagram = createAppResponseObj.design;
    if (!isMermaidMarkdown(designDiagram)) {
      designDiagram = convertToMermaidMarkdown(designDiagram);
    }
    files.push({
      path: APP_ARCHITECTURE_DIAGRAM_FILE,
      content: designDiagram,
    });
    // SQL scripts
    if (createAppResponseObj.sqlScripts) {
      files.push({
        path: SUPA_SQL_FILE,
        content: createAppResponseObj.sqlScripts,
      });
    }
    await FileParser.parseAndCreateFiles(files, createAppResponseObj.name);

    this.logMessage('Initial files saved successfully');
    await this.handleBackend(createAppResponseObj);
  }

  async runInitializationCommands(
    initializationCommands: string[],
    folderName: string,
  ) {
    if (initializationCommands && initializationCommands.length > 0) {
      this.logProgress('Running initialization commands');
      let useNewTerminal = true;
      for (const command of initializationCommands) {
        if (command.startsWith('npx create-next-app')) {
          // Project is already initialized
          console.log('Skipping create next app command', command);
          continue;
        }
        if (
          command.startsWith('npx shadcn@latest init') ||
          command.startsWith('npx shadcn-ui@latest init')
        ) {
          // Porject is already initialized
          console.log('Skipping initializing shadcn command', command);
          continue;
        }
        console.log('Running command', command);
        await runCommandWithPromise(command, folderName, useNewTerminal);
        useNewTerminal = false;
      }
    }
  }

  async generateCode({
    previousMessages,
    previousOutput,
  }: IAppStageInput<ZInitializeAppResponseType>): Promise<
    IAppStageOutput<ZGenerateCodeResponseType>
  > {
    const { name: appName, features, components, design } = previousOutput;
    this.setStage(AppStage.GenerateCode);

    // Generate code for each component
    this.logProgress('Generating code for components');
    // Generate code for individual components first
    const sortedComponents = this.sortComponentsByDependency(components);

    // Generate code for all components
    const generatedCodeByComponent: Map<
      string,
      ZGenerateCodeForComponentResponseType
    > = new Map();
    let error = false;
    const installedDependencies: string[] = [];
    // Install default dependencies for the tech stack
    const libsForStack = getLibsToInstallForStack(this.getTechStackOptions());
    await installNPMDependencies(appName, libsForStack, installedDependencies);

    const codeGenerationMessages = [
      ...previousMessages,
      // TODO: Try switching to a system message with coder role with design generated with architect role
      this.createUserMessage(
        `Lets start generating code for the components one by one.
        Do not create placeholder code.
        Write the actual code that will be used in production.
        Use typescript for the code.
        Wait for the code generation request.`,
      ),
    ];

    const totalComponents = sortedComponents.length;
    let componentIndex = 0;

    for (const component of sortedComponents) {
      const dependentComponents = component.dependsOn || [];
      const dependenciesWithContent: ZGenerateCodeForComponentResponseType[] =
        [];
      // Get dependencies content
      for (const dependency of dependentComponents) {
        const dependencyContent = generatedCodeByComponent.get(dependency);
        if (dependencyContent) {
          dependenciesWithContent.push(dependencyContent);
        }
      }

      if (previousOutput.sqlScripts) {
        // Add generated types to the dependencies
        dependenciesWithContent.push({
          componentName: 'database',
          filePath: SUPA_TYPES_FILE,
          content: previousOutput.sqlScripts,
          libraries: [],
          summary: 'Generated types for the database',
        });
      }

      // Generate code for the component
      const codeGenerationPrompt = new GenerateCodeForWebComponentPrompt({
        name: component.name,
        path: component.path,
        type: component.type as ComponetType,
        purpose: component.purpose,
        dependencies: dependenciesWithContent,
        design,
        techStack: this.getTechStackOptions(),
      });
      const messages = [
        ...codeGenerationMessages,
        this.createUserMessage(codeGenerationPrompt.getInstructionsPrompt()),
      ];

      let codeGenerationResponse, codeGenerationResponseObj;
      try {
        this.logProgress(
          `Generating code ${
            componentIndex + 1
          }/${totalComponents} for component ${component.name}`,
        );
        const { response, object } =
          await this.languageModelService.generateObject<ZGenerateCodeForComponentResponseType>(
            {
              messages,
              schema: ZGenerateCodeForComponentResponseSchema,
              responseFormatPrompt:
                codeGenerationPrompt.getResponseFormatPrompt(),
            },
          );
        codeGenerationResponse = response;
        codeGenerationResponseObj = object;
        generatedCodeByComponent.set(component.name, codeGenerationResponseObj);
        // codeGenerationMessages.push(
        //   vscode.LanguageModelChatMessage.Assistant(codeGenerationResponse),
        // );
        console.info(`Received code for component ${component.name}`);
      } catch (error) {
        console.error(
          'WebBuilder: Error parsing code generation response for component',
          component.name,
          error,
        );
        this.logMessage(
          `Error generating code for component ${component.name}`,
        );
        throw error;
      }

      this.logMessage(
        `Successfully generated code for component ${component.name}`,
      );
      this.logProgress(`Writing code to for component ${component.name}`);

      componentIndex++;

      if (codeGenerationResponseObj.filePath !== component.path) {
        console.error(
          `Component path mismatch for component ${component.name}. Expected: ${component.path}, Received: ${codeGenerationResponseObj.filePath}`,
        );
      }

      // Handle assets
      this.handleAssets(codeGenerationResponseObj, component, appName);

      const files = [
        {
          path: codeGenerationResponseObj.filePath,
          content: codeGenerationResponseObj.content,
        },
      ];
      // Check for updated dependencies
      // if (
      //   codeGenerationResponseObj.updatedDependencies &&
      //   codeGenerationResponseObj.updatedDependencies.length > 0
      // ) {
      //   console.warn('*** Updated dependencies found ***');
      //   for (const updatedDependency of codeGenerationResponseObj.updatedDependencies) {
      //     files.push({
      //       path: updatedDependency.filePath,
      //       content: updatedDependency.content,
      //     });
      //   }
      // }
      // Create files
      await FileParser.parseAndCreateFiles(files, appName);

      // Install npm dependencies
      this.logProgress('Installing npm dependencies');
      const npmDependencies = codeGenerationResponseObj.libraries || [];
      installNPMDependencies(appName, npmDependencies, installedDependencies);

      // TODO: Check if there are any errors
    }
    this.logMessage('Components created successfully');

    return {
      messages: codeGenerationMessages,
      output: {
        appName,
        features,
        design,
        components,
        generatedCode: Array.from(generatedCodeByComponent.values()),
        error: error ? 'Error generating code for components' : undefined,
        summary: 'Successfully generated code for all components',
      },
    };
  }

  getTechStackOptions(): IWebTechStackOptions {
    return this.techStackOptions as IWebTechStackOptions;
  }
}
