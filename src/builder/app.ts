import * as vscode from 'vscode';
import {
  IInitializeAppResponse,
  IResponseBase,
  IGenerateCodeResponse,
} from './types';
import { FileParser } from './utils/fileParser';
import { installNPMDependencies } from './terminalHelper';
import { APP_NAME } from './constants';

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

export interface IAppStageOutput<T extends IResponseBase> {
  messages: vscode.LanguageModelChatMessage[];
  output: T;
}

export interface IAppStageInput<T extends IResponseBase> {
  previousMessages: vscode.LanguageModelChatMessage[];
  previousOutput: T;
}

/**
 * Base class for the app builder. Works with copilot model to build app in stages.
 */

export class App {
  protected stage: AppStage;
  protected model: vscode.LanguageModelChat;
  protected stream: vscode.ChatResponseStream;
  protected token: vscode.CancellationToken;
  private isExecuting: boolean;
  private initialInput: string;

  constructor(
    model: vscode.LanguageModelChat,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
    initialInput: string,
  ) {
    this.model = model;
    this.stream = stream;
    this.token = token;
    this.initialInput = initialInput;
    this.stage = AppStage.None;
    this.isExecuting = false;
  }

  getStages(): AppStage[] {
    // TODO: Add more stages as we implement
    return [
      AppStage.PreCheck,
      AppStage.Initialize,
      AppStage.Design,
      AppStage.GenerateCode,
      AppStage.Build,
      AppStage.Deploy,
    ];
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

      let stageOutput: IAppStageOutput<IResponseBase> | undefined = undefined;

      for (const stage of stages) {
        if (stage === this.stage) {
          continue;
        }
        let currentOutput;
        switch (stage) {
          case AppStage.Initialize:
            currentOutput = await this.initialize(this.initialInput);
            break;
          case AppStage.Design:
            if (!stageOutput) {
              this.setStage(AppStage.Cancelled);
              this.isExecuting = false;
              throw new Error('No previous output to design');
            }
            currentOutput = await this.design({
              previousMessages: stageOutput.messages,
              previousOutput: stageOutput.output as IInitializeAppResponse,
            });
            break;
          case AppStage.GenerateCode:
            if (!stageOutput) {
              this.setStage(AppStage.Cancelled);
              this.isExecuting = false;
              throw new Error('No previous output to generate code');
            }
            currentOutput = await this.generateCode({
              previousMessages: stageOutput.messages,
              previousOutput: stageOutput.output as IInitializeAppResponse,
            });
            break;
          case AppStage.Build:
            if (!stageOutput) {
              this.setStage(AppStage.Cancelled);
              this.isExecuting = false;
              throw new Error('No previous output to build');
            }
            currentOutput = await this.build({
              previousMessages: stageOutput.messages,
              previousOutput: stageOutput.output as IInitializeAppResponse,
            });
            break;
          case AppStage.Deploy:
            if (!stageOutput) {
              this.setStage(AppStage.Cancelled);
              this.isExecuting = false;
              throw new Error('No previous output to deploy');
            }
            currentOutput = await this.deploy({
              previousMessages: stageOutput.messages,
              previousOutput: stageOutput.output as IInitializeAppResponse,
            });
            break;
        }
        stageOutput = currentOutput;
      }
      this.isExecuting = false;
    } catch (error) {
      console.error('Error executing app:', error);
      this.stage = AppStage.Cancelled;
      throw error;
    }
  }

  precheck(): Promise<boolean> {
    // Check for pre-requisites
    throw new Error('Method not implemented.');
  }

  initialize(
    _userMessage: string,
  ): Promise<IAppStageOutput<IInitializeAppResponse>> {
    // Initialize the application
    throw new Error('Method not implemented.');
  }

  design(
    _input: IAppStageInput<IInitializeAppResponse>,
  ): Promise<IAppStageOutput<IResponseBase>> {
    // Generate class diagram
    // Generate project structure
    throw new Error('Method not implemented.');
  }

  generateCode(
    _input: IAppStageInput<IInitializeAppResponse>,
  ): Promise<IAppStageOutput<IGenerateCodeResponse>> {
    // Generate code
    throw new Error('Method not implemented.');
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

  setStage(stage: AppStage) {
    this.stage = stage;
  }

  progress(message: string) {
    if (this.stream) {
      this.stream.progress(message);
    }
  }

  markdown(message: string) {
    if (this.stream) {
      this.stream.markdown(message);
    }
  }
}
