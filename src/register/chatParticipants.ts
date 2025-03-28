import * as vscode from 'vscode';
import {
  APP_CONFIG_FILE,
  ENABLE_WEB_APP,
  ENABLE_WEB_STACK_CONFIG,
} from '../builder/constants';
import { TelemetryService } from '../service/telemetry/telemetry';
import { readAppConfigFromFile } from '../builder/utils/appconfigHelper';
import { runExpoProject } from '../builder/terminalHelper';
import { MobileTechStackWebviewProvider } from '../webview/mobileTechStackWebview';
import { getDefaultMobileTechStack } from '../builder/mobile/mobileTechStack';
import { MobileApp } from '../builder/mobile/mobileApp';
import { FileUtil } from '../builder/utils/fileUtil';
import { LanguageModelService } from '../service/languageModel';
import { StreamHandlerService } from '../service/streamHandler';
import { WebApp } from '../builder/web/webApp';
import {
  getDefaultWebTechStack,
  getPromptForWebStack,
} from '../builder/web/webTechStack';
import { WebTechStackWebviewProvider } from '../webview/webTechStackWebview';
import { Backend } from '../builder/backend/serviceStack';
import { IGenericStack } from '../builder/types';
import { SupabaseService } from '../builder/backend/supabase/service';
import {
  clearSupabaseTokens,
  connectToSupabase,
  isConnectedToSupabase,
} from '../builder/backend/supabase/oauth';

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
      const modelService = new LanguageModelService(request.model, token);
      const streamService = new StreamHandlerService({
        useChatStream: true,
        chatStream: stream,
      });
      // Handle create mobile app
      return await handleCreateMobileApp(
        request.prompt,
        'chat',
        modelService,
        streamService,
        telemetry,
      );
    } else if (request.command === ChatCommands.Run) {
      return await handleRunMobileApp(stream, telemetry);
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
      const modelService = new LanguageModelService(request.model, token);
      const streamService = new StreamHandlerService({
        useChatStream: true,
        chatStream: stream,
      });
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
      return await handleRunMobileApp(stream, telemetry);
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
  let techStackOptions = await MobileTechStackWebviewProvider.createOrShow();
  if (!techStackOptions) {
    techStackOptions = getDefaultMobileTechStack();
    streamService.message(
      'Using default tech stack options: ' + JSON.stringify(techStackOptions),
    );
  } else {
    streamService.message(
      'Chosen tech stack options: ' + JSON.stringify(techStackOptions),
    );
    // Merge with default stack options
    techStackOptions = {
      ...getDefaultMobileTechStack(),
      ...techStackOptions,
    };
  }

  try {
    app = new MobileApp(
      modelService,
      streamService,
      userInput,
      techStackOptions,
      null,
    );
    await app.execute();
    telemetry.trackAppCreation(
      {
        input: userInput,
        success: true,
        source,
        appType: 'mobile',
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
  stream: vscode.ChatResponseStream,
  telemetry: TelemetryService,
) {
  telemetry.trackChatInteraction('mobile.run');
  const startTime = Date.now();

  try {
    const workspaceFolder = await FileUtil.getWorkspaceFolder();
    if (!workspaceFolder) {
      stream.markdown('No workspace folder selected');
      telemetry.trackError(
        'mobile.run',
        'mobile',
        'chat',
        undefined,
        {
          error: 'no_workspace_folder',
        },
        {
          duration: Date.now() - startTime,
        },
      );
      return {
        errorDetails: {
          message: 'No workspace folder selected',
        },
        metadata: { command: 'run' },
      };
    }

    const files = await vscode.workspace.findFiles(`**/${APP_CONFIG_FILE}`);
    if (files.length === 0) {
      stream.markdown('Not able to locate a appdev.json file');
      telemetry.trackError(
        'mobile.run',
        'mobile',
        'chat',
        undefined,
        {
          error: 'no_app_json',
        },
        {
          duration: Date.now() - startTime,
        },
      );
      return {
        errorDetails: {
          message: 'No app.json found',
        },
        metadata: { command: 'run' },
      };
    }

    const appJsonPath = files[0].fsPath;
    const appJson = await readAppConfigFromFile(appJsonPath);
    const appName = appJson.name;
    stream.markdown(`Running app ${appName}`);
    runExpoProject(appName);

    telemetry.trackChatInteraction('mobile.run', {
      success: String(true),
      duration: String(Date.now() - startTime),
    });

    return {
      metadata: { command: 'run' },
    };
  } catch (error) {
    telemetry.trackError('mobile.run', 'mobile', 'chat', error as Error);
    return {
      errorDetails: {
        message: (error as Error).message,
      },
      metadata: { command: 'run' },
    };
  }
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
    techStackOptions = await WebTechStackWebviewProvider.createOrShow();
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

  try {
    // Check for backend
    const backend = await getBackend(context, techStackOptions);
    if (techStackOptions.backend === Backend.None || !backend) {
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
        appType: 'web',
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
): Promise<SupabaseService | null> {
  const backend = techStackOptions.backend;

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
      return supabaseService;
    } catch (error) {
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
        return getBackend(context, techStackOptions);
      } else {
        return null;
      }
    }
  }
  return null;
}
