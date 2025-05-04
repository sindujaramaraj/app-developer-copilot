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
  ComponentType,
  ZGenerateCodeForComponentResponseSchema,
  ZGenerateCodeForComponentResponseType,
  ZGenerateCodeResponseType,
  ZInitializeAppResponseType,
  ZInitializeAppWithBackendResponseType,
} from '../types';
import {
  installNPMDependencies,
  runCommandWithPromise,
} from '../terminalHelper';
import { FileUtil, IFile } from '../utils/fileUtil';
import {
  APP_ARCHITECTURE_DIAGRAM_FILE,
  SUPA_SQL_FILE_PATH,
  SUPA_TYPES_WEB_FILE_PATH,
  TOOL_IMAGE_ANALYZER,
} from '../constants';
import { AppType, createAppConfig } from '../utils/appconfigHelper';
import {
  getLibsToInstallForStack,
  getWebAppCreationCommands,
  IWebTechStackOptions,
  WebFramework,
} from './webTechStack';

/**
 * Web app builder
 */
export class WebApp extends App {
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

    const useExistingBackend =
      this.getTechStackOptions().backendConfig.useExisting;

    if (useExistingBackend) {
      try {
        const backendDetails = await this.getExistingBackendDetails();
        this.techStackOptions.backendConfig.details = backendDetails;
      } catch (error) {
        console.error('Error getting backend details', error);
        this.logMessage(
          'Error getting backend details. Will continue without backend.',
        );
      }
    }

    const promptClass = this.hasBacked()
      ? InitializeWebAppWithBackendPrompt
      : InitializeWebAppPrompt;

    const initializeAppPrompt = new promptClass({
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
      let tools: string[] | undefined = undefined;
      const designConfig = this.getTechStackOptions().designConfig;
      if (designConfig?.images && designConfig.images.length > 0) {
        tools = [TOOL_IMAGE_ANALYZER];
      }

      let { response: createAppResponse, object: createAppResponseObj } =
        await this.languageModelService.generateObject<
          ZInitializeAppResponseType | ZInitializeAppWithBackendResponseType
        >({
          messages: initializeAppMessages,
          schema: initializeAppPrompt.getResponseFormatSchema(),
          responseFormatPrompt: initializeAppPrompt.getResponseFormatPrompt(),
          tools, // Pass tools if images are present
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
    if (this.hasBacked() && createAppResponseObj.sqlScripts) {
      files.push({
        path: SUPA_SQL_FILE_PATH,
        content: createAppResponseObj.sqlScripts,
      });
    }
    await FileUtil.parseAndCreateFiles(files, createAppResponseObj.name);

    this.logMessage('Initial files saved successfully');
    await this.handleBackend(createAppResponseObj);
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

    // Get content for pre defined dependencies
    const predefinedDependencies =
      await this.getCommonDependenciesForCodeGeneration();

    for (const component of sortedComponents) {
      // Just include all the previously generated components
      const dependenciesWithContent: ZGenerateCodeForComponentResponseType[] =
        Array.from(generatedCodeByComponent.values());

      // Generate code for the component
      const codeGenerationPrompt = new GenerateCodeForWebComponentPrompt({
        name: component.name,
        path: component.path,
        type: component.type as ComponentType,
        purpose: component.purpose,
        dependencies: [...dependenciesWithContent, ...predefinedDependencies],
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

      // Create files
      await FileUtil.parseAndCreateFiles(files, appName);

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

  async getCommonDependenciesForCodeGeneration(): Promise<
    ZGenerateCodeForComponentResponseType[]
  > {
    const commonDependencies: ZGenerateCodeForComponentResponseType[] =
      await super.getCommonDependenciesForCodeGeneration();

    const techStackOptions = this.getTechStackOptions();
    if (techStackOptions.framework === WebFramework.NEXT) {
      // This file is generated during project creation
      const NEXT_CSS_FILE = 'src/app/globals.css';
      const glocalCSSPath = await this.getFilePathUri(NEXT_CSS_FILE);
      const globalCSSContent = await FileUtil.readFile(glocalCSSPath.fsPath);
      // add the global.css file path
      commonDependencies.push({
        componentName: 'global.css',
        filePath: NEXT_CSS_FILE,
        content: globalCSSContent,
        libraries: [],
        summary: 'Global CSS file',
      });
    }

    return commonDependencies;
  }

  getTechStackOptions(): IWebTechStackOptions {
    return this.techStackOptions as IWebTechStackOptions;
  }

  getSupaTypesFilePath(): string {
    return SUPA_TYPES_WEB_FILE_PATH;
  }

  getSupaEnvFile(supaUrl: string, supaAnonKey: string): string {
    const envLocalContent = `
    NEXT_PUBLIC_SUPABASE_URL=${supaUrl}
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${supaAnonKey}
    `;
    return envLocalContent;
  }
}
