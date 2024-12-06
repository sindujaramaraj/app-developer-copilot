import * as vscode from 'vscode';
import {
  IInitializeAppResponse,
  IResponseBase,
  IGenerateCodeResponse,
} from './types';
import { checkNodeInstallation } from './utils/nodeUtil';
import { validateUserInput } from './utils/validationUtil';
import { logStage } from './utils/loggingUtil';

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

  async precheck(): Promise<boolean> {
    this.setStage(AppStage.PreCheck);
    logStage(this.stage);

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

    // Add more comprehensive pre-checks and validations here
    // For example, check for npm installation, environment variables, etc.

    return true;
  }

  async initialize(
    userMessage: string,
  ): Promise<IAppStageOutput<IInitializeAppResponse>> {
    this.setStage(AppStage.Initialize);
    logStage(this.stage);

    // Validate user input
    const validationResult = validateUserInput(userMessage);
    if (!validationResult.isValid) {
      this.markdown(validationResult.errorMessage);
      this.setStage(AppStage.Cancelled);
      throw new Error('Invalid input');
    }

    // Initialize the application
    // Add your initialization logic here

    return {
      messages: [],
      output: {} as IInitializeAppResponse,
    };
  }

  // design(
  //   _input: IAppStageInput<IInitializeAppResponse>,
  // ): Promise<IAppStageOutput<IAppDesignResponse>> {
  //   // Generate class diagram
  //   // Generate projet structure
  //   throw new Error('Method not implemented.');
  // }

  async generateCode(
    input: IAppStageInput<IInitializeAppResponse>,
  ): Promise<IAppStageOutput<IGenerateCodeResponse>> {
    this.setStage(AppStage.GenerateCode);
    logStage(this.stage);

    // Generate code
    // Add your code generation logic here

    return {
      messages: input.previousMessages,
      output: {} as IGenerateCodeResponse,
    };
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
