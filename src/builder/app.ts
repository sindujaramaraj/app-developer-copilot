import {
  ZInitializeAppResponseType,
  ZResponseBaseType,
  ZGenerateCodeResponseType,
  ZCodeComponentType,
  ZGenerateCodeForComponentResponseType,
} from './types';
import { IModelMessage, LanguageModelService } from '../service/languageModel';
import { StreamHandlerService } from '../service/streamHandler';
import { FileParser } from './utils/fileParser';
import { APP_CONVERSATION_FILE } from './constants';

export enum AppStage {
  None,
  PreCheck,
  Initialize,
  Design,
  GenerateCode,
  Build,
  Run,
  Deploy,
  Cancelled,
}

export interface IAppStageOutput<T extends ZResponseBaseType> {
  messages: IModelMessage[];
  output: T;
}

export interface IAppStageInput<T extends ZResponseBaseType> {
  previousMessages: IModelMessage[];
  previousOutput: T;
}

/**
 * Base class for the app builder. Works with copilot model to build app in stages.
 */

export class App {
  protected appName: string = '';
  protected languageModelService: LanguageModelService;
  protected streamService: StreamHandlerService;
  protected stage: AppStage;
  private isExecuting: boolean;
  private initialInput: string;
  private componentsCount: number = 0;
  private generatedFilesCount: number = 0;
  private conversations: IModelMessage[] = [];

  constructor(
    languageModelService: LanguageModelService,
    streamService: StreamHandlerService,
    initialInput: string,
  ) {
    this.languageModelService = languageModelService;
    this.streamService = streamService;
    this.initialInput = initialInput;
    this.stage = AppStage.None;
    this.isExecuting = false;
  }

  getStages(): AppStage[] {
    // TODO: Add more stages as we implement
    return [AppStage.PreCheck, AppStage.Initialize, AppStage.GenerateCode];
  }

  async execute(): Promise<void> {
    if (this.isExecuting) {
      console.warn('Execution already in progress');
      return;
    }
    const stages = this.getStages();
    // check if current stage is the last stage
    if (this.stage === stages[stages.length - 1]) {
      console.warn('Execution already completed');
      return;
    }
    if (this.stage === AppStage.Cancelled) {
      console.warn('Execution cancelled');
      return;
    }
    if (this.stage === AppStage.None) {
      this.isExecuting = true;
    }
    // start executing stages
    try {
      const success = await this.precheck();
      if (!success) {
        console.error('Precheck failed');
        this.isExecuting = false;
        this.setStage(AppStage.Cancelled);
        return;
      }

      let stageOutput: IAppStageOutput<ZResponseBaseType> | undefined =
        undefined;

      for (const stage of stages) {
        if (stage === this.stage) {
          continue;
        }
        let currentOutput;
        switch (stage) {
          case AppStage.Initialize:
            currentOutput = await this.initialize(this.initialInput);
            this.componentsCount = currentOutput.output.components.length;
            break;
          case AppStage.GenerateCode:
            if (!stageOutput) {
              this.setStage(AppStage.Cancelled);
              this.isExecuting = false;
              throw new Error('No previous output to generate code');
            }
            currentOutput = await this.generateCode({
              previousMessages: stageOutput.messages,
              previousOutput: stageOutput.output as ZInitializeAppResponseType,
            });
            this.generatedFilesCount =
              currentOutput.output.generatedCode.length;
            this.componentsCount = currentOutput.output.components.length;
            break;
        }
        stageOutput = currentOutput;
      }
      // Handle completion
      this.streamService.message('App creation completed');
    } catch (error: any) {
      console.error('Error executing app:', error);
      this.logMessage('Error creating app');
      error.message && this.logMessage(error.message);
      this.stage = AppStage.Cancelled;
      throw error;
    } finally {
      this.isExecuting = false;
      this.streamService.close();
      // store conversations in a file
      await FileParser.parseAndCreateFiles(
        [
          {
            content: JSON.stringify(this.conversations, null, 2),
            path: APP_CONVERSATION_FILE,
          },
        ],
        this.getAppName(),
        false,
      );
    }
  }

  precheck(): Promise<boolean> {
    // Check for pre-requisites
    throw new Error('Method not implemented.');
  }

  initialize(
    _userMessage: string,
  ): Promise<IAppStageOutput<ZInitializeAppResponseType>> {
    // Initialize the application
    throw new Error('Method not implemented.');
  }

  // design(
  //   _input: IAppStageInput<IInitializeAppResponse>,
  // ): Promise<IAppStageOutput<IAppDesignResponse>> {
  //   // Generate class diagram
  //   // Generate projet structure
  //   throw new Error('Method not implemented.');
  // }

  generateCode(
    _input: IAppStageInput<ZInitializeAppResponseType>,
  ): Promise<IAppStageOutput<ZGenerateCodeResponseType>> {
    // Generate code
    throw new Error('Method not implemented.');
  }

  build() {
    // Check for errors
    throw new Error('Method not implemented.');
  }

  run() {
    // Run the application
    throw new Error('Method not implemented.');
  }

  deploy() {
    // Deploy the application
    throw new Error('Method not implemented.');
  }

  setAppName(appName: string) {
    this.appName = appName;
  }

  getAppName(): string {
    return this.appName;
  }

  setStage(stage: AppStage) {
    this.stage = stage;
  }

  logProgress(message: string) {
    this.streamService.progress(message);
  }

  logMessage(message: string) {
    this.streamService.message(message);
  }

  createUserMessage(content: string): IModelMessage {
    const message = this.languageModelService.createUserMessage(content);
    this.logConversation(message);
    return message;
  }

  createAssistantMessage(content: string): IModelMessage {
    const message = this.languageModelService.createAssistantMessage(content);
    this.logConversation(message);
    return message;
  }

  createSystemMessage(content: string): IModelMessage {
    const message = this.languageModelService.createSystemMessage(content);
    this.logConversation(message);
    return message;
  }

  logConversation(message: IModelMessage) {
    this.conversations.push(message);
  }

  async handleAssets(
    codeGenerationResponseObj: ZGenerateCodeForComponentResponseType,
    component: ZCodeComponentType,
    appName: string,
  ) {
    if (
      codeGenerationResponseObj.assets &&
      codeGenerationResponseObj.assets.length > 0
    ) {
      console.info(`Component ${component.name} has assets`);
      // Save assets
      this.logProgress(`Saving assets for component: ${component.name}`);
      const files = [];
      for (const asset of codeGenerationResponseObj.assets) {
        files.push({
          path: asset.filePath,
          content: asset.content,
        });
        this.logMessage(
          `Component ${component.name} uses asset: ${asset.filePath}. We are not able to ensure asset generation right now. Please make sure to fix the asset before running the app.`,
        );
      }
      await FileParser.parseAndCreateFiles(files, appName, true);
      // Update generated files count
      this.incrementGeneratedFilesCount();
    }
  }

  sortComponentsByDependency(
    nodes: ZCodeComponentType[],
  ): ZCodeComponentType[] {
    const componentMap = new Map<string, ZCodeComponentType>();
    nodes.forEach((node) => {
      componentMap.set(node.name, node);
    });

    const sortedNodes: ZCodeComponentType[] = [];
    while (nodes.length > sortedNodes.length) {
      for (const node of nodes) {
        // Check if the node is sorted
        if (sortedNodes.find((sortedNode) => node.name === sortedNode.name)) {
          continue;
        }

        const dependencies = node.dependsOn || [];
        if (!dependencies || dependencies.length === 0) {
          sortedNodes.push(node);
          continue;
        }
        let dependeciesFound = true;
        for (const dependency of dependencies) {
          // check if the dependency is on one of the nodes
          if (!componentMap.has(dependency)) {
            continue; // External dependency. Skip checking in sorted nodes
          }
          // check if the dependency is already sorted
          if (
            sortedNodes.some((sortedNode) => sortedNode.name === dependency)
          ) {
            continue;
          }
          dependeciesFound = false;
          break; // dependency not sorted yet
        }
        if (dependeciesFound) {
          sortedNodes.push(node);
        }
      }
    }
    return sortedNodes;
  }

  getComponentsCount(): number {
    return this.componentsCount;
  }

  incrementGeneratedFilesCount() {
    this.generatedFilesCount++;
  }

  getGeneratedFilesCount(): number {
    return this.generatedFilesCount;
  }
}
