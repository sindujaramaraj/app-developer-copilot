import {
  ZInitializeAppResponseType,
  ZResponseBaseType,
  ZGenerateCodeResponseType,
  ZCodeComponentType,
} from './types';
import { IModelMessage, LanguageModelService } from '../service/languageModel';
import { StreamHandlerService } from '../service/streamHandler';

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
  protected languageModelService: LanguageModelService;

  protected streamService: StreamHandlerService;

  protected stage: AppStage;
  private isExecuting: boolean;
  private initialInput: string;

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
            break;
        }
        stageOutput = currentOutput;
      }
      // Handle completion
      this.isExecuting = false;
      this.streamService.message('App creation completed');
      this.streamService.close();
    } catch (error: any) {
      console.error('Error executing app:', error);
      this.logMessage('Error creating app');
      error.message && this.logMessage(error.message);
      this.stage = AppStage.Cancelled;
      this.isExecuting = false;
      this.streamService.close();
      throw error;
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

  setStage(stage: AppStage) {
    this.stage = stage;
  }

  logProgress(message: string) {
    this.streamService.progress(message);
  }

  logMessage(message: string) {
    this.streamService.message(message);
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
}
