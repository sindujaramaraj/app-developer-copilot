import * as vscode from 'vscode';
import { App, AppStage, IAppStageInput, IAppStageOutput } from '../app';
import {
  convertToMermaidMarkdown,
  isMermaidMarkdown,
  parseResponse,
  sortComponentsByDependency,
} from '../utils/contentUtil';
import { GenerateCodeForComponentPrompt, InitializeAppPrompt } from '../prompt';
import {
  IGenerateCodeForComponentResponse,
  IGenerateCodeResponse,
  IInitializeAppResponse,
} from '../types';
import {
  createExpoApp,
  installNPMDependencies,
  resetExpoProject,
} from '../terminalHelper';
import { FileParser } from '../utils/fileParser';
import {
  APP_ARCHITECTURE_DIAGRAM_FILE,
  CLASS_DIAGRAM_FILE,
} from '../constants';
import { checkNodeInstallation } from '../utils/nodeUtil';
import { AppType, createAppConfig } from '../utils/appconfigHelper';

const MOBILE_BUILDER_INSTRUCTION = `You are an expert at building mobile apps using react native and expo.
You create apps that uses local storage and doesn't require authentication.
You will write a very long answer. Make sure that every detail of the architecture is, in the end, implemented as code.
Make sure the architecure is simple and straightforward. Use expo-router for navigation.
Do not respond until you receive the request. User will first request design and then code generation.
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
      this.markdown(
        'Node.js is not installed. Please install Node.js to proceed',
      );
      this.setStage(AppStage.Cancelled);
      return false;
    }
    if (!nodeCheck.meetsMinimum) {
      this.markdown(
        `Node.js version ${nodeCheck.version} is not supported. Please install Node.js version 16.0.0 or higher to proceed`,
      );
      this.setStage(AppStage.Cancelled);
      return false;
    }
    return true;
  }

  async initialize(
    userMessage?: string,
  ): Promise<IAppStageOutput<IInitializeAppResponse>> {
    if (!userMessage) {
      this.markdown(
        'Please provide a valid input to start building a mobile app',
      );
      this.setStage(AppStage.Cancelled);
      throw new Error('Invalid input');
    }
    this.setStage(AppStage.Initialize);
    this.markdown('Lets start building a mobile app');

    const initializeAppPrompt = new InitializeAppPrompt({
      userMessage: userMessage,
    });

    const initializeAppMessages = [
      vscode.LanguageModelChatMessage.Assistant(MOBILE_BUILDER_INSTRUCTION),
      // Add the user's message
      vscode.LanguageModelChatMessage.User(initializeAppPrompt.getPromptText()),
    ];

    // send the request
    this.progress('Analyzing app requirements');
    let createAppResponse, createAppResponseObj;
    try {
      [createAppResponse, createAppResponseObj] =
        await parseResponse<IInitializeAppResponse>(
          this.model,
          initializeAppMessages,
          this.token,
          initializeAppPrompt,
        );
      initializeAppMessages.push(
        vscode.LanguageModelChatMessage.Assistant(createAppResponse),
      );
    } catch (error) {
      console.error('MobileBuilder: Error parsing response', error);
      throw error;
    }

    this.markdown(`Let's call the app: ${createAppResponseObj.name}`);
    console.warn(`${JSON.stringify(createAppResponseObj.components)}`);

    this.progress(`Creating app ${createAppResponseObj.name}`);
    const formattedAppName = createAppResponseObj.name
      .replace(/\s/g, '-')
      .toLowerCase();
    // fix app name
    createAppResponseObj.name = formattedAppName;

    await this.postInitialize(createAppResponseObj);

    // Create app config
    await createAppConfig({
      name: createAppResponseObj.name,
      initialPrompt: userMessage,
      type: AppType.MOBILE,
    });

    return {
      messages: initializeAppMessages,
      output: createAppResponseObj,
    };
  }

  async postInitialize(createAppResponseObj: IInitializeAppResponse) {
    // Create expo project
    await createExpoApp(createAppResponseObj.name);
    //reset expo project
    await resetExpoProject(createAppResponseObj.name);
    this.markdown(`Created expo project: ${createAppResponseObj.name}`);
    // Design the app
    this.progress('Writing the design diagram to the file');
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
    this.markdown('Design Diagram saved successfully');
  }

  async generateCode({
    previousMessages,
    previousOutput,
  }: IAppStageInput<IInitializeAppResponse>): Promise<
    IAppStageOutput<IGenerateCodeResponse>
  > {
    const { name: appName, features, components, design } = previousOutput;
    this.setStage(AppStage.GenerateCode);

    // Generate code for each component
    this.progress('Generating code for components');
    // Generate code for individual components first
    const sortedComponents = sortComponentsByDependency(components);

    // Generate code for all components
    const generatedCodeByComponent: Map<
      string,
      IGenerateCodeForComponentResponse
    > = new Map();
    let error = false;
    const installedDependencies: string[] = [];

    const codeGenerationMessages = [
      ...previousMessages,
      vscode.LanguageModelChatMessage.Assistant(
        `Lets start generating code for the components one by one.
        Do not create placeholder code.
        Write the actual code that will be used in production.
        Use typescript for the code.
        Wait for the code generation request.`,
      ),
    ];

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
        type: component.type,
        purpose: component.purpose,
        dependencies: dependenciesWithContent,
        design,
        techStack:
          'For navigation, we will use expo-router. For theming, we will use react-native-paper.  Use default theme for the app. For storage, we will use AsyncStorage.',
      });
      const messages = [
        ...codeGenerationMessages,
        vscode.LanguageModelChatMessage.User(
          codeGenerationPrompt.getPromptText(),
        ),
      ];

      let codeGenerationResponse, codeGenerationResponseObj;
      try {
        this.progress(`Generating code for component ${component.name}`);
        [codeGenerationResponse, codeGenerationResponseObj] =
          await parseResponse<IGenerateCodeForComponentResponse>(
            this.model,
            messages,
            this.token,
            codeGenerationPrompt,
          );
        generatedCodeByComponent.set(component.name, codeGenerationResponseObj);
        // codeGenerationMessages.push(
        //   vscode.LanguageModelChatMessage.Assistant(codeGenerationResponse),
        // );
        console.info(`Received code for component ${component.name}`);
        // Handle assets
        if (
          codeGenerationResponseObj.assets &&
          codeGenerationResponseObj.assets.length > 0
        ) {
          console.info(`Component ${component.name} has assets`);
          // Save assets
          this.progress('Saving assets');
          const files = [];
          for (const asset of codeGenerationResponseObj.assets) {
            files.push({
              path: asset.filePath,
              content: asset.content,
            });
          }
          await FileParser.parseAndCreateFiles(files, appName);
          this.markdown(
            'Assets saved successfully for component: ' + component.name,
          );
        }
        console.info(
          `Component path: ${component.path} \n Received path: ${codeGenerationResponseObj.filePath}`,
        );
        //console.info(codeGenerationResponse);
      } catch (error) {
        console.error(
          'MobileBuilder: Error parsing code generation response for component',
          component.name,
          error,
        );
        this.markdown(`Error generating code for component ${component.name}`);
        throw error;
      }

      this.markdown(
        `Successfully generated the code for component ${component.name}`,
      );
      this.progress(
        `Writing the code to the file for component ${component.name}`,
      );

      const files = [
        {
          path: codeGenerationResponseObj.filePath,
          content: codeGenerationResponseObj.content,
        },
      ];
      await FileParser.parseAndCreateFiles(files, appName);

      // Install npm dependencies
      this.progress('Installing npm dependencies');
      const npmDependencies = codeGenerationResponseObj.libraries || [];
      installNPMDependencies(appName, npmDependencies, installedDependencies);

      // TODO: Check if there are any errors
    }
    this.progress('Components created successfully');

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

  async design(
    input: IAppStageInput<IInitializeAppResponse>,
  ): Promise<IAppStageOutput<IResponseBase>> {
    this.setStage(AppStage.Design);
    this.progress('Designing the application');
    const { previousMessages, previousOutput } = input;
    const { name: appName, design, components } = previousOutput;

    // Generate a detailed roadmap or build plan
    const roadmap = `
# Roadmap for ${appName}

## Initialization
- Set up the project structure
- Create configuration files

## Design
- Generate class diagrams
- Create project structure
- Identify dependencies

## Dependency Management
- List all dependencies required for the application
- Ensure automated installation of dependencies during the build stage

## Code Generation
- Generate code for application components
- Order component creation based on dependencies

## Build
- Check for errors
- Compile the application

## Deployment
- Configure deployment settings
- Deploy the application to the target environment

## User Prompts
- Consolidate information requests during the design stage
- Minimize user input in subsequent stages

## Error Handling and Feedback
- Implement robust error handling
- Provide clear feedback to the user

## User-Friendly Interface
- Ensure intuitive and easy-to-navigate user interface
- Provide clear and concise instructions for each stage
`;

    // Save the roadmap to a file
    await FileParser.parseAndCreateFiles(
      [
        {
          path: 'roadmap.md',
          content: roadmap,
        },
      ],
      appName,
    );

    this.markdown('Roadmap saved successfully');

    return {
      messages: previousMessages,
      output: {
        summary: 'Design completed successfully',
      },
    };
  }

  async build(
    input: IAppStageInput<IInitializeAppResponse>,
  ): Promise<IAppStageOutput<IResponseBase>> {
    this.setStage(AppStage.Build);
    this.progress('Building the application');
    const { previousMessages, previousOutput } = input;
    const { name: appName } = previousOutput;

    // Install dependencies
    this.progress('Installing dependencies');
    const installedDependencies: string[] = [];
    for (const component of previousOutput.components) {
      const npmDependencies = component.dependsOn || [];
      await installNPMDependencies(appName, npmDependencies, installedDependencies);
    }

    this.markdown('Build completed successfully');
    return {
      messages: previousMessages,
      output: {
        summary: 'Build completed successfully',
      },
    };
  }

  async deploy(
    input: IAppStageInput<IInitializeAppResponse>,
  ): Promise<IAppStageOutput<IResponseBase>> {
    this.setStage(AppStage.Deploy);
    this.progress('Deploying the application');
    const { previousMessages, previousOutput } = input;
    const { name: appName } = previousOutput;

    // Deploy the application
    this.progress('Deploying the application');
    // Add deployment logic here

    this.markdown('Deployment completed successfully');
    return {
      messages: previousMessages,
      output: {
        summary: 'Deployment completed successfully',
      },
    };
  }
}
