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
import {
  APP_ARCHITECTURE_DIAGRAM_FILE,
  APP_CONVERSATION_FILE,
  ISSUE_REPORT_URL,
  SUPA_SQL_FILE_PATH,
  TOOL_IMAGE_ANALYZER,
  TOOL_PEXEL_IMAGE_SEARCH,
} from './constants';
import { Backend, IBackendDetails } from './backend/serviceStack';
import { SupabaseService } from './backend/supabase/service';
import { checkNodeInstallation } from './utils/nodeUtil';
import { createSupaFiles } from './backend/supabase/helper';
import {
  FixIssuePrompt,
  FixBatchIssuePrompt,
  getPromptForTools,
} from './prompt';
import { createAppConfig, AppType } from './utils/appconfigHelper';
import { IMobileTechStackOptions } from './mobile/mobileTechStack';
import { IWebTechStackOptions } from './web/webTechStack';
import { installNPMDependencies } from './terminalHelper';
import {
  convertToMermaidMarkdown,
  isMermaidMarkdown,
} from './utils/contentUtil';

export enum AppStage {
  None,
  PreCheck,
  Initialize,
  Design,
  GenerateCode,
  Fix, // Added Fix stage
  Build,
  Run,
  Deploy,
  Cancelled,
}

const MAX_RETRIES = 5;

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
    // Add Fix stage after GenerateCode
    return [
      AppStage.PreCheck,
      AppStage.Initialize,
      AppStage.GenerateCode,
      AppStage.Fix,
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
      let stageOutput: IAppStageOutput<any> | undefined = undefined;
      let generatedCodeOutput:
        | IAppStageOutput<ZGenerateCodeResponseType>
        | undefined = undefined;
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
            generatedCodeOutput = currentOutput;
            break;
          case AppStage.Fix:
            if (!generatedCodeOutput) {
              this.setStage(AppStage.Cancelled);
              this.isExecuting = false;
              throw new Error('No generated code to fix');
            }
            await this.fix(generatedCodeOutput.output);
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
      if (
        error.message &&
        (error.message.includes('Server error') ||
          error.message.includes('Response contained no choices'))
      ) {
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
      await FileUtil.createFiles(
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

  /**
   * Common initialize logic for all app types. Calls overridable methods for app-specific behavior.
   */
  protected async baseInitialize(
    userMessage: string | undefined,
    getPrompt: (hasBackend: boolean) => any,
    handleCreateApp: (responseObj: ZInitializeAppResponseType) => Promise<void>,
    appType: AppType,
    techStack: IMobileTechStackOptions | IWebTechStackOptions,
  ): Promise<IAppStageOutput<ZInitializeAppResponseType>> {
    if (!userMessage) {
      this.logMessage(
        `Please provide a valid input to start building a ${appType} app`,
      );
      this.setStage(AppStage.Cancelled);
      throw new Error('Invalid input');
    }
    this.setStage(AppStage.Initialize);
    this.logMessage(`Lets start building a ${appType} app`);

    const useExistingBackend = techStack.backendConfig.useExisting;

    if (useExistingBackend) {
      try {
        const backendDetails = await this.getExistingBackendDetails();
        techStack.backendConfig.details = backendDetails;
      } catch (error) {
        console.error(`Error getting backend details`, error);
        this.logMessage(
          'Error getting backend details. Will continue without backend.',
        );
      }
    }

    const initializeAppPrompt = getPrompt(this.hasBacked());

    const initializeAppMessages = [
      this.createSystemMessage(initializeAppPrompt.getInstructionsPrompt()),
      this.createUserMessage(`Create app for: ${userMessage}`),
    ];

    this.logProgress('Analyzing app requirements');
    try {
      let tools: string[] | undefined = undefined;
      const designConfig = techStack.designConfig;
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
          tools,
        });
      initializeAppMessages.push(
        this.createAssistantMessage(createAppResponse.content),
      );

      const toolPrompt = createAppResponse.toolResults
        ? getPromptForTools(createAppResponse.toolResults)
        : '';
      if (toolPrompt) {
        initializeAppMessages.push(this.createUserMessage(toolPrompt));
      }

      this.logInitialResponse(createAppResponseObj);

      this.logProgress(`Creating app ${createAppResponseObj.name}`);
      const formattedAppName = createAppResponseObj.name
        .replace(/\s/g, '-')
        .toLowerCase();
      createAppResponseObj.name = formattedAppName;
      this.setAppName(formattedAppName);
      this.setAppTitle(createAppResponseObj.title);

      await this.postInitialize(createAppResponseObj, handleCreateApp);

      // Create app config
      const modelConfig = this.languageModelService.getModelConfig();
      await createAppConfig({
        name: createAppResponseObj.name,
        title: createAppResponseObj.title,
        initialPrompt: userMessage,
        components: createAppResponseObj.components,
        features: createAppResponseObj.features,
        techStack: techStack,
        type: appType,
        modelProvider: modelConfig.modelProvider,
        languageModel: modelConfig.model,
        figmaUrl: this.getTechStackOptions().designConfig.figmaFileUrl,
      });

      return {
        messages: initializeAppMessages,
        output: createAppResponseObj,
        toolCalls: createAppResponse.toolCalls,
        toolResults: createAppResponse.toolResults,
      };
    } catch (error) {
      console.error(`Error parsing response`, error);
      throw error;
    }
  }

  /**
   * Common post-initialize logic for all app types. Calls overridable methods for app-specific behavior.
   */
  protected async postInitialize(
    createAppResponseObj:
      | ZInitializeAppResponseType
      | ZInitializeAppWithBackendResponseType,
    handleCreateApp: (responseObj: ZInitializeAppResponseType) => Promise<void>,
  ): Promise<void> {
    // Create app
    await handleCreateApp(createAppResponseObj);

    // save architecture of the app
    this.logProgress('Writing architecture diagram to file');
    let architectureDiagram = createAppResponseObj.architecture;
    if (!isMermaidMarkdown(architectureDiagram)) {
      architectureDiagram = convertToMermaidMarkdown(architectureDiagram);
    }
    await FileUtil.parseAndCreateFiles(
      [
        {
          path: APP_ARCHITECTURE_DIAGRAM_FILE,
          content: architectureDiagram,
        },
      ],
      createAppResponseObj.name,
    );

    // Backend setup
    await this.handleBackend(createAppResponseObj);
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
      this.logError('No projects found in Supabase');
      throw new Error('No projects found in Supabase');
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

      // Run script to create tables
      const sqlSuccess = await this.runSQLScripts(
        projectId,
        createAppResponseObj,
      );
      if (!sqlSuccess) {
        throw new Error('Failed to create tables in supabase');
      }
      // Save the SQL scripts to file
      this.logProgress('Saving SQL scripts to file');
      await FileUtil.parseAndCreateFiles(
        [
          {
            path: SUPA_SQL_FILE_PATH,
            content: createAppResponseObj.sqlScripts,
          },
        ],
        createAppResponseObj.name,
      );

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

  async runSQLScripts(
    projectId: string,
    createAppResponseObj: ZInitializeAppResponseType,
    retryCount = 0,
  ): Promise<boolean> {
    if (!this.backendService) {
      throw new Error('Backend service not initialized');
    }
    if (!createAppResponseObj.sqlScripts) {
      this.logMessage('No SQL scripts found');
      return false;
    }
    // Create tables
    this.logProgress('Creating tables in supabase');
    const sqlScripts = createAppResponseObj.sqlScripts;
    try {
      await this.backendService.runQuery(projectId, sqlScripts);
    } catch (sqlError) {
      if (retryCount >= MAX_RETRIES) {
        this.logError(
          `Failed to create tables in supabase after ${MAX_RETRIES} attempts.`,
        );
        this.logMessage(
          'Maximum retry attempts reached. Please fix the SQL issue manually',
        );
        return false;
      }
      this.logError(
        'Failed to create tables in supabase.' +
          (sqlError instanceof Error ? sqlError.message : ''),
      );
      this.logMessage(
        `Retry attempt ${retryCount + 1}/${MAX_RETRIES}: Will try to fix the issue`,
      );
      // Try to fix the issue
      const fixSQLPrompt = new FixIssuePrompt({
        content: sqlScripts,
        contentType: 'sql',
        errorMessage:
          sqlError instanceof Error && sqlError.message
            ? sqlError.message
            : 'Error executing the query',
      });

      const fixIssueResponse = await this.languageModelService.generateObject({
        messages: [
          this.createUserMessage(fixSQLPrompt.getInstructionsPrompt()),
        ],
        schema: fixSQLPrompt.getResponseFormatSchema(),
        responseFormatPrompt: fixSQLPrompt.getResponseFormatPrompt(),
      });

      const fixedSQL = fixIssueResponse.object.fixedContent;
      if (!fixedSQL) {
        this.logError('Failed to fix the SQL issue.');
        this.logMessage(
          'Not able to fix the SQL issue. Please fix it manually',
        );
        return false;
      }
      // Update response object with fixed SQL
      createAppResponseObj.sqlScripts = fixedSQL;
      this.logMessage('SQL issue fixed. Creating tables again');

      return await this.runSQLScripts(
        projectId,
        createAppResponseObj,
        retryCount + 1,
      );
    }

    this.logMessage('Tables created in Supabase');
    return true;
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

  /**
   * Common generateCode logic for all app types. Calls overridable methods for app-specific behavior.
   */
  protected async baseGenerateCode(
    previousMessages: IModelMessage[],
    previousOutput: ZInitializeAppResponseType,
    libsForStack: string[],
    getPrompt: (
      component: any,
      dependencies: any[],
      architecture: string,
      design: string,
    ) => any,
    getDependenciesForCodeGeneration: () => Promise<any[]>,
  ): Promise<IAppStageOutput<ZGenerateCodeResponseType>> {
    const {
      name: appName,
      features,
      components,
      architecture,
      design,
    } = previousOutput;
    this.setStage(AppStage.GenerateCode);

    this.logProgress('Generating code for components');
    const sortedComponents = this.sortComponentsByDependency(components);
    const generatedCodeByComponent: Map<string, any> = new Map();
    let error = false;
    const installedDependencies: string[] = [];

    // Install default dependencies for the tech stack
    await installNPMDependencies(appName, libsForStack, installedDependencies);

    const codeGenerationMessages = [
      ...previousMessages,
      this.createUserMessage(
        `Lets start generating code for the components one by one.Do not create placeholder code.Write the actual code that will be used in production.Use typescript for the code.Wait for the code generation request.`,
      ),
    ];

    const totalComponents = sortedComponents.length;
    let componentIndex = 0;
    const predefinedDependencies = await getDependenciesForCodeGeneration();

    for (const component of sortedComponents) {
      const dependenciesWithContent = Array.from(
        generatedCodeByComponent.values(),
      );
      const codeGenerationPrompt = getPrompt(
        component,
        [...dependenciesWithContent, ...predefinedDependencies],
        architecture,
        design,
      );
      const messages = [
        ...codeGenerationMessages,
        this.createUserMessage(codeGenerationPrompt.getInstructionsPrompt()),
      ];
      let codeGenerationResponseObj;
      try {
        this.logProgress(
          `Generating code ${componentIndex + 1}/${totalComponents} for component ${component.name}`,
        );
        const { object } = await this.languageModelService.generateObject<any>({
          messages,
          schema: codeGenerationPrompt.getResponseFormatSchema(),
          responseFormatPrompt: codeGenerationPrompt.getResponseFormatPrompt(),
          tools: [TOOL_PEXEL_IMAGE_SEARCH],
        });
        codeGenerationResponseObj = object;
        generatedCodeByComponent.set(component.name, codeGenerationResponseObj);
        console.info(`Received code for component ${component.name}`);
      } catch (error) {
        console.error(
          'Error parsing code generation response for component',
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
      this.handleAssets(codeGenerationResponseObj, component, appName);
      const files = [
        {
          path: codeGenerationResponseObj.filePath,
          content: codeGenerationResponseObj.content,
        },
      ];
      await FileUtil.parseAndCreateFiles(files, appName);
      this.logProgress('Installing npm dependencies');
      const npmDependencies = codeGenerationResponseObj.libraries || [];
      installNPMDependencies(appName, npmDependencies, installedDependencies);
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
    // Further sort nodes based on dependency count
    sortedNodes.sort((a, b) => {
      const aDependencies = a.dependsOn || [];
      const bDependencies = b.dependsOn || [];
      return aDependencies.length - bDependencies.length;
    });
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

  /**
   * Fix stage: Identify and fix issues in generated code using Copilot's problems tool and fetch webpage.
   * Retries until code is error-free or max retries reached.
   */
  async fix(generateCodeOutput: ZGenerateCodeResponseType): Promise<void> {
    this.setStage(AppStage.Fix);
    this.logProgress('Checking for issues in generated code...');
    let retryCount = 0;
    let hasErrors = true;
    const MAX_FIX_RETRIES = 5;
    const generatedFiles = (generateCodeOutput.generatedCode || [])
      .map((c) => c.filePath)
      .filter(Boolean);
    if (generatedFiles.length === 0) {
      this.logMessage('No generated files to check.');
      return;
    }
    while (hasErrors && retryCount < MAX_FIX_RETRIES) {
      let totalProblems = 0;
      let fixedAny = false;
      // Collect all problems for all files in this round
      const fileProblems: {
        filePath: string;
        diagnostics: vscode.Diagnostic[];
      }[] = [];
      for (const filePath of generatedFiles) {
        const uri = await this.getFilePathUri(filePath);
        const diagnostics = vscode.languages.getDiagnostics(uri);
        if (diagnostics && diagnostics.length > 0) {
          fileProblems.push({ filePath, diagnostics });
          totalProblems += diagnostics.length;
        }
      }
      if (totalProblems === 0) {
        this.logMessage('No issues found in generated code.');
        hasErrors = false;
        break;
      }
      // Batch input for all files with problems
      const batchFiles = [];
      for (const { filePath, diagnostics } of fileProblems) {
        const uri = await this.getFilePathUri(filePath);
        let fileContent = '';
        try {
          const fileBytes = await vscode.workspace.fs.readFile(uri);
          fileContent = Buffer.from(fileBytes).toString('utf8');
        } catch (e) {
          this.logError(`Failed to read file for fixing: ${filePath}`);
          continue;
        }
        const contentType =
          filePath.endsWith('.ts') || filePath.endsWith('.tsx')
            ? 'typescript'
            : 'javascript';
        batchFiles.push({
          filePath,
          content: fileContent,
          errorMessages: diagnostics.map((d) => d.message),
          contentType,
        });
      }
      // Call the language model once for all files
      const fixBatchPrompt = new FixBatchIssuePrompt({ files: batchFiles });
      try {
        const { object: batchResponse } =
          await this.languageModelService.generateObject({
            messages: [
              this.createSystemMessage(fixBatchPrompt.getInstructionsPrompt()),
            ],
            schema: fixBatchPrompt.getResponseFormatSchema(),
            responseFormatPrompt: fixBatchPrompt.getResponseFormatPrompt(),
          });
        if (
          batchResponse &&
          batchResponse.fixedFiles &&
          batchResponse.fixedFiles.length > 0
        ) {
          for (const fixed of batchResponse.fixedFiles) {
            const uri = await this.getFilePathUri(fixed.filePath);
            await vscode.workspace.fs.writeFile(
              uri,
              Buffer.from(fixed.fixedContent, 'utf8'),
            );
            this.logMessage(`Applied batch fix to ${fixed.filePath}`);
            fixedAny = true;
          }
        } else {
          this.logError('No fixes returned for batch.');
        }
      } catch (e) {
        this.logError(`Failed to apply batch fix: ${e}`);
      }
      if (!fixedAny) {
        this.logError(
          'Some issues could not be fixed automatically. Please review manually.',
        );
        break;
      }
      retryCount++;
      this.logProgress(
        `Fix attempt ${retryCount} complete. Re-checking for issues in all files...`,
      );
      // Loop will re-check all files for new/remaining issues
    }
    if (!hasErrors) {
      this.logMessage('All issues fixed. Code is error-free.');
    }
  }
}
