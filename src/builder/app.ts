import * as vscode from 'vscode';
import {
  IGenericStack,
  ZCodeComponentType,
  ZGenerateCodeForComponentResponseType,
  ZGenerateCodeResponseType,
  ZInitializeAppResponseType,
  ZResponseBaseType,
} from './types';
import { IModelMessage, LanguageModelService } from '../service/languageModel';
import { StreamHandlerService } from '../service/streamHandler';
import { FileUtil } from './utils/fileUtil';
import { APP_CONVERSATION_FILE, ISSUE_REPORT_URL } from './constants';
import { Backend, IBackendDetails } from './backend/serviceStack';
import { SupabaseService } from './backend/supabase/service';
import { checkNodeInstallation } from './utils/nodeUtil';
import { get } from 'http';
import { createSupaFiles } from './backend/supabase/helper';

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

interface IAppStageInputOutputCommon<T extends ZResponseBaseType> {
  messages: IModelMessage[];
  output: T;
  toolCalls?: vscode.LanguageModelToolCallPart[];
  toolResults?: Record<string, vscode.LanguageModelToolResult>;
}

export interface IAppStageOutput<T extends ZResponseBaseType>
  extends IAppStageInputOutputCommon<T> {}

export interface IAppStageInput<T extends ZResponseBaseType>
  extends IAppStageInputOutputCommon<T> {}

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
              messages: stageOutput.messages,
              output: stageOutput.output as ZInitializeAppResponseType,
            });
            this.generatedFilesCount =
              currentOutput.output.generatedCode.length;
            this.componentsCount = currentOutput.output.components.length;
            break;
        }
        stageOutput = currentOutput;
      }
      // Handle completion
      // Check for number of files created
      if (this.getGeneratedFilesCount() > 0) {
        this.logMessage('App creation completed');
      } else {
        this.logMessage('Something went wrong. No files created');
        throw new Error('Something went wrong.No files created');
      }
    } catch (error: any) {
      console.error('Error creating app:', error);
      this.logError('Error creating app');
      error.message && this.logMessage(error.message);
      // check for VSCODE error
      if (error.message && error.message.includes('Server error')) {
        this.logMessage(
          'Looks like there is an issue with the copilot server. Please try again later',
        );
      } else {
        // Propose to report the issue
        this.logMessage('*Would you like to report this issue?*');
        this.logLink('Report issue', ISSUE_REPORT_URL);
      }
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

  initialize(
    _userMessage: string,
  ): Promise<IAppStageOutput<ZInitializeAppResponseType>> {
    // Initialize the application
    throw new Error('Method not implemented.');
  }

  // Construct details for existing backend
  async getExistingBackendDetails(): Promise<IBackendDetails> {
    // Construct details for existing backend

    if (!this.backendService) {
      throw new Error('Backend service not initialized');
    }
    // Check for connection
    const isConnected = await this.backendService.isConnected();
    if (!isConnected) {
      throw new Error('Connection is not established');
    }
    // Select projects
    const projects = await this.backendService.getProjects();
    if (!projects || projects.length === 0) {
      this.logError('No projects found in supabase');
      throw new Error('No projects found in supabase');
    }
    this.logProgress('Select the Supabase project you want to use as backend');
    const selectedProject = await vscode.window.showQuickPick(
      projects.map((prj) => prj.id + '-' + prj.name),
      {
        placeHolder: 'Select the Supabase project you want to use as backend',
      },
    );
    if (!selectedProject) {
      throw new Error('Project not selected');
    }
    const selectedProjectId = selectedProject.split('-')[0];
    // Get project details
    const projectUrl = this.backendService.getProjectUrl(selectedProjectId);
    const projectAnonKey =
      await this.backendService.getProjectAnonKey(selectedProjectId);
    const projectAuthConfig =
      await this.backendService.getProjectAuthConfig(selectedProjectId);
    const projectTypes =
      await this.backendService.generateTypesForProject(selectedProjectId);
    return {
      type: Backend.SUPABASE,
      url: projectUrl,
      key: projectAnonKey,
      authConfig: projectAuthConfig,
      types: projectTypes?.types,
    };
  }

  async handleBackend(createAppResponseObj: ZInitializeAppResponseType) {
    this.logProgress('Setting up backend');
    const backendConfig = this.getTechStackOptions().backendConfig;
    if (backendConfig.backend === Backend.SUPABASE && this.backendService) {
      if (backendConfig.useExisting) {
        await this.handleExistingBackend(createAppResponseObj);
      } else {
        await this.handleCreateNewBackend(createAppResponseObj);
      }
    } else {
      this.logMessage('No backend setup required');
    }
  }

  async handleExistingBackend(
    createAppResponseObj: ZInitializeAppResponseType,
  ): Promise<void> {
    if (!this.backendService) {
      throw new Error('Backend service not initialized');
    }
    const existingBackendDetails =
      this.getTechStackOptions().backendConfig.details;

    if (!existingBackendDetails) {
      this.logMessage('No existing backend details found');
      return;
    }
    if (existingBackendDetails.type === Backend.SUPABASE) {
      // create env file
      const envLocalContent = this.getSupaEnvFile(
        existingBackendDetails.url,
        existingBackendDetails.key,
      );
      if (!existingBackendDetails.types) {
        this.logMessage('No types found for existing backend');
        return;
      }
      await createSupaFiles(
        envLocalContent,
        this.getSupaTypesFilePath(),
        existingBackendDetails.types,
        createAppResponseObj.name,
      );
    }
  }

  async handleCreateNewBackend(
    createAppResponseObj: ZInitializeAppResponseType,
  ): Promise<void> {
    if (!this.backendService) {
      throw new Error('Backend service not initialized');
    }
    if (!createAppResponseObj.sqlScripts) {
      this.logMessage('No SQL scripts found');
      return;
    }
    // Check for backend connectivity
    const isConnected = await this.backendService.isConnected();
    if (isConnected) {
      // Create project
      // Select organization to create project in
      const orgs = await this.backendService.getOrgs();
      if (!orgs || orgs.length === 0) {
        throw new Error('No organizations found in supabase');
      }

      this.logProgress('Select organization to create project in');
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
      let newProject;
      try {
        newProject = await this.backendService.createProject(
          projectName,
          'db123456', // TODO: use a random password
          selectedOrgId,
        );
      } catch (error) {
        this.logError('Failed to create project in supabase');
        console.error('Error creating project:', error);
        throw error;
      }

      if (!newProject) {
        this.logError('Failed to create project in supabase');
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
      const envLocalContent = this.getSupaEnvFile(projectUrl, anonKey);
      this.logMessage('Types generated for project');
      if (
        generatedTypes &&
        generatedTypes.types &&
        generatedTypes.types.length > 0
      ) {
        // Save types and api keys to file
        await createSupaFiles(
          envLocalContent,
          this.getSupaTypesFilePath(),
          generatedTypes.types,
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
  }

  async getCommonDependenciesForCodeGeneration() {
    let predefinedDependencies: ZGenerateCodeForComponentResponseType[] = [];
    if (this.hasBacked()) {
      // Add generated types to the dependencies
      const workspaceFolder = await FileUtil.getWorkspaceFolder();
      if (workspaceFolder) {
        const typesFilePath = await this.getFilePathUri(
          this.getSupaTypesFilePath(),
        );
        const typesFileContent = await FileUtil.readFile(typesFilePath.fsPath);
        predefinedDependencies.push({
          componentName: 'database',
          filePath: this.getSupaTypesFilePath(),
          content: typesFileContent,
          libraries: [],
          summary: 'Generated types for the database',
        });

        // add env.local file to the dependencies
        const envFilePath = await this.getFilePathUri('.env.local');
        const envFileContent = await FileUtil.readFile(envFilePath.fsPath);
        predefinedDependencies.push({
          componentName: 'env.local',
          filePath: '.env.local',
          content: envFileContent,
          libraries: [],
          summary: 'Environment variables for the database',
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

  getSupaTypesFilePath(): string {
    throw new Error('Method not implemented.');
  }

  hasBacked(): boolean {
    return (
      this.getTechStackOptions().backendConfig.backend !== Backend.None &&
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

  logLink(message: string, link: string) {
    this.streamService.link(message, link);
  }

  logError(message: string) {
    this.streamService.error(message);
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

  async getFilePathUri(relativePath: string): Promise<vscode.Uri> {
    const workspaceFolder = await FileUtil.getWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error('No workspace folder selected');
    }
    return vscode.Uri.joinPath(
      vscode.Uri.file(workspaceFolder),
      this.getAppName(),
      relativePath,
    );
  }

  getSupaEnvFile(_supaUrl: string, _supaAnonKey: string): string {
    throw new Error('Method not implemented.');
  }
}
