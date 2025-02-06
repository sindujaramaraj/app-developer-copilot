import { App, AppStage, IAppStageInput, IAppStageOutput } from '../app';
import {
  convertToMermaidMarkdown,
  isMermaidMarkdown,
} from '../utils/contentUtil';
import { GenerateCodeForComponentPrompt, InitializeAppPrompt } from '../prompt';
import {
  ComponetType,
  ZGenerateCodeForComponentResponseSchema,
  ZGenerateCodeForComponentResponseType,
  ZGenerateCodeResponseType,
  ZInitializeAppResponseSchema,
  ZInitializeAppResponseType,
} from '../types';
import {
  createExpoApp,
  installNPMDependencies,
  resetExpoProject,
} from '../terminalHelper';
import { FileParser } from '../utils/fileParser';
import { APP_ARCHITECTURE_DIAGRAM_FILE } from '../constants';
import { checkNodeInstallation } from '../utils/nodeUtil';
import { AppType, createAppConfig } from '../utils/appconfigHelper';
import {
  DataFetching,
  getDefaultStack,
  getLibsToInstallForStack,
  getPromptForStack,
  Navigation,
  StateManagement,
  Storage,
  Testing,
  UILibrary,
} from './mobileTechStack';

const MOBILE_BUILDER_INSTRUCTION = `You are an expert at building mobile apps using react native and expo based on the requested tech stack.
You will write a very long answer. Make sure that every detail of the architecture is, in the end, implemented as code.
Make sure the architecure is simple and straightforward. Do not respond until you receive the request.
User will first request app design and then code generation.
If the user asks a non-programming question, politely decline to respond.`;

/**
 * Mobile app builder
 */
export class MobileApp extends App {
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
        'Please provide a valid input to start building a mobile app',
      );
      this.setStage(AppStage.Cancelled);
      throw new Error('Invalid input');
    }
    this.setStage(AppStage.Initialize);
    this.logMessage('Lets start building a mobile app');

    const initializeAppPrompt = new InitializeAppPrompt({
      userMessage: userMessage,
      techStack: getPromptForStack(this.getTechStack()),
    });

    const initializeAppMessages = [
      this.createSystemMessage(MOBILE_BUILDER_INSTRUCTION),
      // Add user's message
      this.createUserMessage(initializeAppPrompt.getInstructionsPrompt()),
    ];

    // send the request
    this.logProgress('Analyzing app requirements');
    try {
      let { response: createAppResponse, object: createAppResponseObj } =
        await this.languageModelService.generateObject<ZInitializeAppResponseType>(
          {
            messages: initializeAppMessages,
            schema: ZInitializeAppResponseSchema,
            responseFormatPrompt: initializeAppPrompt.getResponseFormatPrompt(),
          },
        );
      initializeAppMessages.push(
        this.createAssistantMessage(createAppResponse),
      );

      this.logMessage(`Let's call the app: ${createAppResponseObj.name}`);
      console.warn(`${JSON.stringify(createAppResponseObj.components)}`);
      this.logProgress(`Creating app ${createAppResponseObj.name}`);
      const formattedAppName = createAppResponseObj.name
        .replace(/\s/g, '-')
        .toLowerCase();
      // fix app name
      createAppResponseObj.name = formattedAppName;
      // set app name
      this.setAppName(formattedAppName);

      await this.postInitialize(createAppResponseObj);

      // Create app config
      const modelConfig = this.languageModelService.getModelConfig();
      await createAppConfig({
        name: createAppResponseObj.name,
        initialPrompt: userMessage,
        components: createAppResponseObj.components,
        features: createAppResponseObj.features,
        tectStack: getPromptForStack(this.getTechStack()),
        type: AppType.MOBILE,
        modelProvider: modelConfig.modelProvider,
        languageModel: modelConfig.model,
      });

      return {
        messages: initializeAppMessages,
        output: createAppResponseObj,
      };
    } catch (error) {
      console.error('MobileBuilder: Error parsing response', error);
      throw error;
    }
  }

  async postInitialize(createAppResponseObj: ZInitializeAppResponseType) {
    // Create expo project
    await createExpoApp(createAppResponseObj.name);
    //reset expo project
    await resetExpoProject(createAppResponseObj.name);
    this.logMessage(`Created expo project: ${createAppResponseObj.name}`);
    // Design the app
    this.logProgress('Writing the design diagram to the file');
    let designDiagram = createAppResponseObj.design;
    if (!isMermaidMarkdown(designDiagram)) {
      designDiagram = convertToMermaidMarkdown(designDiagram);
    }
    await FileParser.parseAndCreateFiles(
      [
        {
          path: APP_ARCHITECTURE_DIAGRAM_FILE,
          content: designDiagram,
        },
      ],
      createAppResponseObj.name,
    );
    this.logMessage('Design Diagram saved successfully');
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
    const libsForStack = getLibsToInstallForStack(this.getTechStack());
    installNPMDependencies(appName, libsForStack, installedDependencies);

    const codeGenerationMessages = [
      ...previousMessages,
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
      const dependenciesWithContent = [];
      // Get dependencies content
      for (const dependency of dependentComponents) {
        const dependencyContent = generatedCodeByComponent.get(dependency);
        if (dependencyContent) {
          dependenciesWithContent.push(dependencyContent);
        }
      }
      // Generate code for the component
      const codeGenerationPrompt = new GenerateCodeForComponentPrompt({
        name: component.name,
        path: component.path,
        type: component.type as ComponetType,
        purpose: component.purpose,
        dependencies: dependenciesWithContent,
        design,
        techStack: getPromptForStack(this.getTechStack()),
      });
      const messages = [
        ...codeGenerationMessages,
        this.createUserMessage(codeGenerationPrompt.getInstructionsPrompt()),
      ];

      let codeGenerationResponse, codeGenerationResponseObj;
      try {
        this.logProgress(
          `Generating code ${componentIndex + 1}/${totalComponents} for component ${component.name}`,
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
          'MobileBuilder: Error parsing code generation response for component',
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
      if (
        codeGenerationResponseObj.updatedDependencies &&
        codeGenerationResponseObj.updatedDependencies.length > 0
      ) {
        console.warn('*** Updated dependencies found ***');
        for (const updatedDependency of codeGenerationResponseObj.updatedDependencies) {
          files.push({
            path: updatedDependency.filePath,
            content: updatedDependency.content,
          });
        }
      }
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

  getTechStack() {
    return {
      stateManagement: StateManagement.ZUSTAND,
      uiLibrary: UILibrary.NATIVE_BASE,
      navigation: Navigation.EXPO_ROUTER,
      dataFetching: DataFetching.APOLLO,
      storage: Storage.ASYNC_STORAGE,
      testing: [Testing.DETOX],
    };
  }
}
