import * as vscode from 'vscode';
import {
  APP_CONFIG_FILE,
  ENABLE_WEB_APP,
  ENABLE_WEB_STACK_CONFIG,
} from '../builder/constants';
import { TelemetryService } from '../service/telemetry/telemetry';
import {
  AppConfig,
  AppType,
  readAppConfigFromFile,
} from '../builder/utils/appconfigHelper';
import { runExpoProject, runNextProject } from '../builder/terminalHelper';
import {
  getDefaultMobileTechStack,
  getPromptForMobileStack,
  IMobileTechStackOptions,
} from '../builder/mobile/mobileTechStack';
import { MobileApp } from '../builder/mobile/mobileApp';
import { FileUtil } from '../builder/utils/fileUtil';
import { LanguageModelService } from '../service/languageModel';
import { StreamHandlerService } from '../service/streamHandler';
import { WebApp } from '../builder/web/webApp';
import {
  getDefaultWebTechStack,
  getPromptForWebStack,
  IWebTechStackOptions,
} from '../builder/web/webTechStack';
import { Backend } from '../builder/backend/serviceStack';
import { IGenericStack } from '../builder/types';
import { SupabaseService } from '../builder/backend/supabase/service';
import {
  clearSupabaseTokens,
  connectToSupabase,
  isConnectedToSupabase,
} from '../builder/backend/supabase/oauth';
import { ConnectionTarget } from '../service/telemetry/types';
import { WebViewProvider, WebviewViewTypes } from '../webview/viewProvider';

enum ChatCommands {
  Create = 'create',
  Run = 'run',
  Help = 'help',
}

export function registerChatParticipants(context: vscode.ExtensionContext) {
  registerMobileChatParticipants(context);
  if (ENABLE_WEB_APP) {
    registerWebChatParticipants(context);
  }
}

function registerMobileChatParticipants(context: vscode.ExtensionContext) {
  const telemetry = TelemetryService.getInstance(context);

  const mobileAppHanlder: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> => {
    // Create a new stream handler service
    const streamService = new StreamHandlerService({
      useChatStream: true,
      chatStream: stream,
    });
    // Check for commands
    if (request.command === ChatCommands.Create) {
      // Check for a valid prompt
      if (!request.prompt) {
        stream.markdown('Enter a valid prompt');
        return {
          errorDetails: {
            message: 'Enter a valid prompt',
          },
        };
      }
      // Initialize model and stream services
      // Check and set a supported model
      const copilotModel = await LanguageModelService.getCopilotModel(
        request.model,
      );
      if (request.model.id !== copilotModel.id) {
        stream.markdown(
          `The model you selected is not supported for mobile app development. Switching to ${copilotModel.id} model.`,
        );
      }
      // Initialize model service
      const modelService = new LanguageModelService(copilotModel, token);

      // Handle create mobile app
      return await handleCreateMobileApp(
        context,
        request.prompt,
        'chat',
        modelService,
        streamService,
        telemetry,
      );
    } else if (request.command === ChatCommands.Run) {
      return await handleRunMobileApp(streamService, telemetry);
    } else {
      if (request.command === ChatCommands.Help) {
        telemetry.trackChatInteraction('mobile.help', {});
      } else {
        telemetry.trackChatInteraction('mobile.general', {
          input: request.prompt,
        });
      }
      stream.markdown(
        `Mobile App Developer agent is designed to create mobile apps. To create a mobile app, type \`@app-developer-mobile /create\` and follow the prompts. To run the app, type \`@app-developer-mobile /run.\``,
      );
      return {
        metadata: { command: 'help' },
      };
    }
  };

  const mobileAppDeveloper = vscode.chat.createChatParticipant(
    'app-developer.mobile',
    mobileAppHanlder,
  );
  mobileAppDeveloper.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    'media/icon.jpeg',
  );
  mobileAppDeveloper.followupProvider = getFollowUpProvider();
  context.subscriptions.push(mobileAppDeveloper);
}

function registerWebChatParticipants(context: vscode.ExtensionContext) {
  const telemetry = TelemetryService.getInstance(context);

  const webAppHandler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> => {
    // Create a new stream handler service
    const streamService = new StreamHandlerService({
      useChatStream: true,
      chatStream: stream,
    });
    // Check for commands
    if (request.command === ChatCommands.Create) {
      // Check for a valid prompt
      if (!request.prompt) {
        stream.markdown('Enter a valid prompt');
        return {
          errorDetails: {
            message: 'Enter a valid prompt',
          },
        };
      }
      // Initialize model and stream services
      // Check and set a supported model
      const copilotModel = await LanguageModelService.getCopilotModel(
        request.model,
      );
      if (request.model.id !== copilotModel.id) {
        stream.markdown(
          `The model you selected is not supported for mobile app development. Switching to ${copilotModel.id} model.`,
        );
      }
      // Initialize model service
      const modelService = new LanguageModelService(copilotModel, token);

      // Handle create web app
      return await handleCreateWebApp(
        context,
        request.prompt,
        'chat',
        modelService,
        streamService,
        telemetry,
      );
    } else if (request.command === ChatCommands.Run) {
      return await handleRunWebApp(streamService, telemetry);
    } else {
      if (request.command === ChatCommands.Help) {
        telemetry.trackChatInteraction('web.help', {});
      } else {
        telemetry.trackChatInteraction('web.general', {
          input: request.prompt,
        });
      }
      stream.markdown(
        `Web App Developer agent is designed to create web apps. To create a web app, type \`@app-developer-web /create\` and follow the prompts. To run the app, type \`@app-developer-web /run.\``,
      );
      return {
        metadata: { command: 'help' },
      };
    }
  };

  const webAppDeveloper = vscode.chat.createChatParticipant(
    'app-developer.web',
    webAppHandler,
  );
  webAppDeveloper.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    'media/icon.jpeg',
  );
  webAppDeveloper.followupProvider = getFollowUpProvider();
  context.subscriptions.push(webAppDeveloper);
}

export async function handleCreateMobileApp(
  context: vscode.ExtensionContext,
  userInput: string,
  source: 'chat' | 'command',
  modelService: LanguageModelService,
  streamService: StreamHandlerService,
  telemetry: TelemetryService,
) {
  telemetry.trackChatInteraction('mobile.create', {});
  console.log('MobileBuilder: Create command called');
  let error: any;
  let app = null;
  const startTime = Date.now();

  // Get tech stack options
  streamService.progress('Waiting for tech stack options input');
  let techStackOptions =
    await WebViewProvider.createOrShow<IMobileTechStackOptions>(
      context,
      WebviewViewTypes.MobileTechStack,
    );
  if (!techStackOptions) {
    techStackOptions = getDefaultMobileTechStack();
    streamService.message(
      'Using default tech stack options: ' +
        getPromptForMobileStack(techStackOptions),
    );
  } else {
    streamService.message(
      'Chosen tech stack options: ' + getPromptForMobileStack(techStackOptions),
    );
    // Merge with default stack options
    techStackOptions = {
      ...getDefaultMobileTechStack(),
      ...techStackOptions,
    };
  }
  const backendConfig = techStackOptions.backendConfig;

  try {
    // Check for backend
    const backend = await getBackend(context, techStackOptions, telemetry);
    if (backendConfig.backend === Backend.None || !backend) {
      streamService.message('Continuing app creation without backend');
    }
    app = new MobileApp(
      modelService,
      streamService,
      userInput,
      techStackOptions,
      backend,
    );
    await app.execute();
    telemetry.trackAppCreation(
      {
        input: userInput,
        success: true,
        source,
        appType: 'mobile',
        techStack: JSON.stringify(techStackOptions),
        hasBackend: backendConfig.backend !== Backend.None && !!backend,
        ...modelService.getModelConfig(),
      },
      {
        duration: Date.now() - startTime,
        totalFilesCount: app.getComponentsCount(),
        createdFilesCount: app.getGeneratedFilesCount(),
      },
    );
  } catch (error: any) {
    telemetry.trackAppCreation(
      {
        input: userInput,
        success: false,
        source,
        appType: 'mobile',
        techStack: JSON.stringify(techStackOptions),
        hasBackend: backendConfig.backend !== Backend.None,
        error: error,
        errorMessage: error.message,
        errorReason: 'execution_error',
        ...modelService.getModelConfig(),
      },
      {
        duration: Date.now() - startTime,
        totalFilesCount: app ? app.getComponentsCount() : 0,
        createdFilesCount: app ? app.getGeneratedFilesCount() : 0,
      },
    );
  }

  return {
    errorDetails: error
      ? {
          message: error.message,
        }
      : undefined,
    metadata: { command: 'create' },
  };
}

async function handleRunMobileApp(
  streamService: StreamHandlerService,
  telemetry: TelemetryService,
) {
  telemetry.trackChatInteraction('mobile.run');
  const startTime = Date.now();
  let appConfig: AppConfig;

  try {
    appConfig = await getAppToRun(AppType.MOBILE, streamService);
  } catch (error: any) {
    telemetry.trackError('mobile.run', 'mobile', 'chat', error as Error);
    return {
      errorDetails: {
        message: error.message ? error.message : 'Something went wrong',
      },
      metadata: { command: 'run' },
    };
  }

  const appName = appConfig.name;
  streamService.message(`Running app ${appName}`);
  runExpoProject(appName);

  telemetry.trackChatInteraction('mobile.run', {
    success: String(true),
    duration: String(Date.now() - startTime),
  });

  return {
    metadata: { command: 'run' },
  };
}

async function handleRunWebApp(
  streamService: StreamHandlerService,
  telemetry: TelemetryService,
) {
  telemetry.trackChatInteraction('web.run');
  const startTime = Date.now();
  let appConfig: AppConfig;

  try {
    appConfig = await getAppToRun(AppType.WEB, streamService);
  } catch (error) {
    telemetry.trackError('web.run', 'web', 'chat', error as Error);
    return {
      errorDetails: {
        message: 'No workspace folder selected',
      },
      metadata: { command: 'run' },
    };
  }

  const appName = appConfig.name;
  streamService.message(`Running app ${appName}`);
  runNextProject(appName); // TODO: check for framework

  telemetry.trackChatInteraction('web.run', {
    success: String(true),
    duration: String(Date.now() - startTime),
  });

  return {
    metadata: { command: 'run' },
  };
}

function getFollowUpProvider() {
  return {
    provideFollowups(
      result: vscode.ChatResult,
      _context: vscode.ChatContext,
      _token: vscode.CancellationToken,
    ) {
      if (!result.metadata) {
        return [];
      }
      if (result.metadata.command === 'create') {
        return [
          {
            prompt: 'Run the app',
            command: 'run',
          } satisfies vscode.ChatFollowup,
        ];
      } else if (result.metadata.command === 'help') {
        return [
          {
            prompt: 'Create a notes app',
            label: 'Try a sample to create a notes app',
            command: 'create',
          } satisfies vscode.ChatFollowup,
          {
            label: 'If you have already created an app, run it',
            prompt: 'Run app',
            command: 'run',
          } satisfies vscode.ChatFollowup,
        ];
      }
      return [];
    },
  };
}

export async function handleCreateWebApp(
  context: vscode.ExtensionContext,
  userInput: string,
  source: 'chat' | 'command',
  modelService: LanguageModelService,
  streamService: StreamHandlerService,
  telemetry: TelemetryService,
) {
  telemetry.trackChatInteraction('web.create', {});
  console.log('WebBuilder: Create command called');
  let error: any;
  let app = null;
  const startTime = Date.now();

  // Get tech stack options
  streamService.progress('Waiting for tech stack options input');
  let techStackOptions;
  if (ENABLE_WEB_STACK_CONFIG) {
    techStackOptions = await WebViewProvider.createOrShow<IWebTechStackOptions>(
      context,
      WebviewViewTypes.WebTechStack,
    );
  }
  if (!techStackOptions) {
    techStackOptions = getDefaultWebTechStack();
    streamService.message(
      'Using default tech stack options: ' +
        getPromptForWebStack(techStackOptions),
    );
  } else {
    // Merge with default stack options
    techStackOptions = {
      ...getDefaultWebTechStack(),
      ...techStackOptions,
    };
    streamService.message(
      'Chosen tech stack options: ' + getPromptForWebStack(techStackOptions),
    );
  }

  const backendConfig = techStackOptions.backendConfig;

  try {
    // Check for backend
    const backend = await getBackend(context, techStackOptions, telemetry);
    if (backendConfig.backend === Backend.None || !backend) {
      streamService.message('Continuing app creation without backend');
    }
    app = new WebApp(
      modelService,
      streamService,
      userInput,
      techStackOptions,
      backend,
    );
    await app.execute();
    telemetry.trackAppCreation(
      {
        input: userInput,
        success: true,
        source,
        appType: 'web',
        techStack: JSON.stringify(techStackOptions),
        hasBackend: backendConfig.backend !== Backend.None && !!backend,
        ...modelService.getModelConfig(),
      },
      {
        duration: Date.now() - startTime,
        totalFilesCount: app.getComponentsCount(),
        createdFilesCount: app.getGeneratedFilesCount(),
      },
    );
    console.log('App created successfully');
  } catch (error: any) {
    console.error('Error creating app', error);
    telemetry.trackAppCreation(
      {
        input: userInput,
        success: false,
        source,
        appType: 'web',
        techStack: JSON.stringify(techStackOptions),
        hasBackend: backendConfig.backend !== Backend.None,
        error: error,
        errorMessage: error.message,
        errorReason: 'execution_error',
        ...modelService.getModelConfig(),
      },
      {
        duration: Date.now() - startTime,
        totalFilesCount: app ? app.getComponentsCount() : 0,
        createdFilesCount: app ? app.getGeneratedFilesCount() : 0,
      },
    );
  }

  return {
    errorDetails: error
      ? {
          message: error.message,
        }
      : undefined,
    metadata: { command: 'create' },
  };
}

async function getBackend(
  context: vscode.ExtensionContext,
  techStackOptions: IGenericStack,
  telemetry: TelemetryService,
  retryCount = 0,
): Promise<SupabaseService | null> {
  const backendConfig = techStackOptions.backendConfig;
  const backend = backendConfig.backend;

  if (backend === Backend.SUPABASE) {
    try {
      // await clearSupabaseTokens(context);
      const isConnected = await isConnectedToSupabase(context);
      if (!isConnected) {
        console.log('Not connected to Supabase. Will try connecting first.');
        await connectToSupabase(context);
      }
      const supabaseService = await SupabaseService.getInstance(context);
      if (!supabaseService) {
        throw new Error('Failed to get instance of Supabase service');
      }
      telemetry.trackConnection({
        target: ConnectionTarget.Supabase,
        success: true,
        retryCount,
      });
      return supabaseService;
    } catch (error: any) {
      console.error('Failed to get Supabase service', error);

      // Try again
      const options: vscode.MessageOptions = {
        detail: 'Message Description',
        modal: true,
      };
      const userResponse = await vscode.window.showInformationMessage(
        'Failed to get Supabase service. Would you like to try connecting to Supabase again?',
        options,
        'Yes',
        'No',
      );
      if (userResponse === 'Yes') {
        // Clear supabase tokens. Caution: This will clear all tokens
        console.log('Clearing Supabase tokens before retrying');
        await clearSupabaseTokens(context);
        return getBackend(context, techStackOptions, telemetry, retryCount + 1);
      } else {
        telemetry.trackConnection({
          target: ConnectionTarget.Supabase,
          success: false,
          retryCount,
          error: error.message ? error.message : error,
        });
        return null;
      }
    }
  }
  return null;
}

async function getAppToRun(
  appType: AppType,
  streamService: StreamHandlerService,
): Promise<AppConfig> {
  try {
    const workspaceFolder = await FileUtil.getWorkspaceFolder();
    if (!workspaceFolder) {
      streamService.error('No workspace folder selected');
      throw new Error('No workspace folder selected');
    }
    streamService.progress('Searching for app to run');
    const files = await vscode.workspace.findFiles(`**/${APP_CONFIG_FILE}`);
    if (files.length === 0) {
      streamService.error(
        'Not able to locate a appdev.json file. Have you created an app yet?',
      );
      throw new Error('No app.json found');
    }

    // filter for appType
    const appConfigs = await Promise.all(
      files.map(async (file) => {
        const appConfig = await readAppConfigFromFile(file.fsPath);
        return appConfig;
      }),
    );
    const filteredAppConfigs = appConfigs.filter(
      (appConfig) => appConfig.type === appType,
    );
    if (filteredAppConfigs.length === 0) {
      streamService.error(
        'Not able to locate a appdev.json file for the selected app type',
      );
      throw new Error('No appdev.json found for the selected app type');
    }
    if (filteredAppConfigs.length === 1) {
      return filteredAppConfigs[0];
    }
    // Show quick pick for multiple app configs
    streamService.progress('Waiting for user to select app to run');
    const quickPickItems = filteredAppConfigs.map((appConfig) => ({
      label: appConfig.name,
      description: appConfig.title,
    }));

    const selectedFile = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: 'Select the app to run',
    });
    if (!selectedFile) {
      streamService.error('No appdev.json file selected');
      throw new Error('No appdev.json file selected');
    }
    return (
      filteredAppConfigs.find(
        (appConfig) => appConfig.name === selectedFile.label,
      ) || filteredAppConfigs[0]
    );
  } catch (error: any) {
    streamService.error(
      'Error getting app to run: ' + error.message ? error.message : error,
    );
    throw error;
  }
}
