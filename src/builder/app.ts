import * as vscode from 'vscode';
import {
  IGenericStack,
  ZCodeComponentType,
  ZGenerateCodeForComponentResponseType,
  ZGenerateCodeResponseType,
  ZInitializeAppResponseType,
  ZInitializeAppWithBackendResponseType,
  ZResponseBaseType,
} from './types';
import { IModelMessage, LanguageModelService } from '../service/languageModel';
import { StreamHandlerService } from '../service/streamHandler';
import { FileUtil } from './utils/fileUtil';
import { APP_CONVERSATION_FILE, SUPA_TYPES_FILE } from './constants';
import { Backend } from './backend/serviceStack';
import { SupabaseService } from './backend/supabase/service';

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
  protected appTitle: string = '';
  protected languageModelService: LanguageModelService;
  protected streamService: StreamHandlerService;
  protected backendService: SupabaseService | null;
  protected stage: AppStage;
  private isExecuting: boolean;
  private initialInput: string;
  protected techStackOptions: IGenericStack;
  private componentsCount: number = 0;
  private generatedFilesCount: number = 0;
  private conversations: IModelMessage[] = [];

  constructor(
    languageModelService: LanguageModelService,
    streamService: StreamHandlerService,
    initialInput: string,
    techStackOptions: IGenericStack,
    backendService: SupabaseService | null,
  ) {
    this.languageModelService = languageModelService;
    this.streamService = streamService;
    this.initialInput = initialInput;
    this.techStackOptions = techStackOptions;
    this.stage = AppStage.None;
    this.isExecuting = false;
    this.backendService = backendService;
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
      await FileUtil.parseAndCreateFiles(
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

  async handleBackend(createAppResponseObj: ZInitializeAppResponseType) {
    this.logProgress('Setting up backend');
    if (
      this.getTechStackOptions().backend === Backend.SUPABASE &&
      this.backendService &&
      createAppResponseObj.sqlScripts
    ) {
      // Check for backend connectivity
      const isConnected = await this.backendService.isConnected();
      if (isConnected) {
        // Create project
        // Select organization to create project in
        const orgs = await this.backendService.getOrgs();
        if (!orgs || orgs.length === 0) {
          throw new Error('No organizations found in supabase');
        }

        this.logMessage('Select organization to create project in');
        const selectedOrg = await vscode.window.showQuickPick(
          orgs.map((org) => org.id + '-' + org.name),
          {
            placeHolder: 'Select organization to create project in',
          },
        );
        if (!selectedOrg) {
          throw new Error('Organization not selected');
        }
        const selectedOrgId = selectedOrg.split('-')[0];
        // Create project in the selected org
        this.logProgress('Creating project in supabase');
        const projectName = createAppResponseObj.name + '-backend';
        const newProject = await this.backendService.createProject(
          projectName,
          'db123456', // TODO: use a random password
          selectedOrgId,
        );
        if (!newProject) {
          this.logMessage('Failed to create project in supabase');
          throw new Error('Failed to create project in supabase');
        }
        this.logMessage(`Project ${newProject.name} created in supabase`);

        const projectId = newProject.id;

        // Create tables
        this.logProgress('Creating tables in supabase');
        await this.backendService.runQuery(
          projectId,
          createAppResponseObj.sqlScripts,
        );
        this.logMessage('Tables created in supabase');

        // Generate types
        this.logProgress('Generating types for project');
        const generatedTypes =
          await this.backendService.generateTypesForProject(projectId);
        // Get keys
        const anonKey = await this.backendService.getProjectAnonKey(projectId);
        const projectUrl = this.backendService.getProjectUrl(projectId);
        // Create env.local file with keys
        const envLocalContent = `NEXT_PUBLIC_SUPABASE_URL=${projectUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`;
        this.logMessage('Types generated for project');
        if (
          generatedTypes &&
          generatedTypes.types &&
          generatedTypes.types.length > 0
        ) {
          // Save types and api keys to file
          FileUtil.parseAndCreateFiles(
            [
              {
                path: SUPA_TYPES_FILE,
                content: generatedTypes.types,
              },
              {
                path: '.env.local',
                content: envLocalContent,
              },
            ],
            createAppResponseObj.name,
          );
        } else {
          this.logMessage(
            'No types generated for project. Try generating them manually',
          );
        }
      } else {
        this.logMessage(
          'Not able to connect to supabase. Proceeding without backend',
        );
      }
    } else {
      this.logMessage('No backend setup required');
    }
  }

  async getPredefinedDependenciesForCodeGeneration() {
    let predefinedDependencies: ZGenerateCodeForComponentResponseType[] = [];
    if (this.hasBacked()) {
      // Add generated types to the dependencies
      const workspaceFolder = await FileUtil.getWorkspaceFolder();
      if (workspaceFolder) {
        const typesFilePath = vscode.Uri.joinPath(
          vscode.Uri.file(workspaceFolder),
          this.getAppName(),
          SUPA_TYPES_FILE,
        );
        const typesFileContent = await FileUtil.readFile(typesFilePath.fsPath);
        predefinedDependencies.push({
          componentName: 'database',
          filePath: SUPA_TYPES_FILE,
          content: typesFileContent,
          libraries: [],
          summary: 'Generated types for the database',
        });
      } else {
        console.error('WebBuilder: Error getting workspace folder');
      }
    }
    return predefinedDependencies;
  }

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

  setAppTitle(appTitle: string) {
    this.appTitle = appTitle;
  }

  getAppTitle(): string {
    return this.appTitle;
  }

  setStage(stage: AppStage) {
    this.stage = stage;
  }

  getTechStackOptions(): IGenericStack {
    return this.techStackOptions;
  }

  hasBacked(): boolean {
    return (
      this.getTechStackOptions().backend !== Backend.None &&
      this.backendService !== null
    );
  }

  logInitialResponse(createAppResponseObj: ZInitializeAppResponseType) {
    this.logMessage(`Let's call the app: ${createAppResponseObj.title}`);
    this.logMessages(
      createAppResponseObj.features,
      'App will have the following features:',
    );
  }

  logProgress(message: string) {
    this.streamService.progress(message);
  }

  logMessage(message: string) {
    this.streamService.message(message);
  }

  logMessages(messages: string[], title?: string) {
    this.streamService.messages(messages, title);
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
      await FileUtil.parseAndCreateFiles(files, appName, true);
      // Update generated files count
      this.incrementGeneratedFilesCount();
    }
  }

  sortComponentsByDependency(
    nodes: ZCodeComponentType[],
  ): ZCodeComponentType[] {
    // Creata a map of components
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
