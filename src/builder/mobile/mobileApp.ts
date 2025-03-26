import { App, AppStage, IAppStageInput, IAppStageOutput } from '../app';
import {
  convertToMermaidMarkdown,
  isMermaidMarkdown,
} from '../utils/contentUtil';
import {
  GenerateCodeForMobileComponentPrompt,
  InitializeMobileAppPrompt,
} from '../prompt';
import {
  ComponetType,
  ZGenerateCodeForComponentResponseSchema,
  ZGenerateCodeForComponentResponseType,
  ZGenerateCodeResponseType,
  ZInitializeAppResponseSchema,
  ZInitializeAppResponseType,
} from '../types';
import { createExpoApp, installNPMDependencies } from '../terminalHelper';
import { FileUtil } from '../utils/fileUtil';
import { APP_ARCHITECTURE_DIAGRAM_FILE } from '../constants';
import { checkNodeInstallation } from '../utils/nodeUtil';
import { AppType, createAppConfig } from '../utils/appconfigHelper';
import {
  getLibsToInstallForStack,
  IMobileTechStackOptions,
} from './mobileTechStack';

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

    const initializeAppPrompt = new InitializeMobileAppPrompt({
      techStack: this.getTechStackOptions(),
    });

    const initializeAppMessages = [
      this.createSystemMessage(initializeAppPrompt.getInstructionsPrompt()),
      // Add user's message
      this.createUserMessage(`Create a mobile app for: ${userMessage}`),
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
    // TODO: Commenting this out for now because behavior is not clear
    // Reset expo project
    // await resetExpoProject(createAppResponseObj.name);
    this.logMessage(`Created expo project: ${createAppResponseObj.name}`);
    // Design the app
    this.logProgress('Writing the design diagram to the file');
    let designDiagram = createAppResponseObj.design;
    if (!isMermaidMarkdown(designDiagram)) {
      designDiagram = convertToMermaidMarkdown(designDiagram);
    }
    await FileUtil.parseAndCreateFiles(
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
      // Use all previously generated code as dependencies
      const dependenciesWithContent = Array.from(
        generatedCodeByComponent.values(),
      );

      // Generate code for the component
      const codeGenerationPrompt = new GenerateCodeForMobileComponentPrompt({
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

  getTechStackOptions(): IMobileTechStackOptions {
    return this.techStackOptions as IMobileTechStackOptions;
  }
}
