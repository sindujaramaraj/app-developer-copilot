import * as vscode from 'vscode';
import { MobileApp } from './builder/mobile/mobileApp';
import { FileParser } from './builder/utils/fileParser';
import { APP_CONFIG_FILE, APP_DISPLAY_NAME } from './builder/constants';
import { runExpoProject } from './builder/terminalHelper';
import { readAppConfigFromFile } from './builder/utils/appconfigHelper';
import { LanguageModelService } from './service/languageModel';
import { StreamHandlerService } from './service/streamHandler';
import { TelemetryService } from './service/telemetry/telemetry';
import { TechStackWebviewProvider } from './webview/techStackWebview';
import { getDefaultStack } from './builder/mobile/mobileTechStack';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  // Initialize output channel
  outputChannel = vscode.window.createOutputChannel(APP_DISPLAY_NAME);
  outputChannel.appendLine(`${APP_DISPLAY_NAME} activated`);
  context.subscriptions.push(outputChannel);

  // Initialize telemetry
  const telemetry = TelemetryService.getInstance(context);
  telemetry.trackActivation();
  context.subscriptions.push(telemetry);

  // Register extension commands and participants
  registerChatParticipants(context);
  registerCommands(context);
  //registerWebview(context);
}

// function registerWebview(context: vscode.ExtensionContext) {
//   // Add to registerCommands function:

//   const provider = new TechStackWebviewProvider(context.extensionUri);

//   context.subscriptions.push(
//     vscode.window.registerWebviewViewProvider(
//       TechStackWebviewProvider.viewType,
//       provider,
//     ),
//   );
// }

function registerCommands(context: vscode.ExtensionContext) {
  const telemetry = TelemetryService.getInstance(context);

  vscode.commands.registerCommand('app-developer.mobile.create', () => {
    telemetry.trackCommandPanelInteraction('mobile.create');

    vscode.window
      .showInputBox({
        prompt: 'What would you like to create?',
        placeHolder: 'A notes app',
      })
      .then(async (userInput) => {
        if (!userInput) {
          vscode.window.showErrorMessage('Enter a valid prompt');
          return;
        }

        const startTime = Date.now();
        const modelService = new LanguageModelService();
        const streamService = new StreamHandlerService({
          useChatStream: false,
          outputChannel,
        });
        streamService.progress('Waiting for tech stack options input');
        let tectStackOptions = await TechStackWebviewProvider.createOrShow();
        if (!tectStackOptions) {
          streamService.message(
            'Using default tech stack options: ' +
              JSON.stringify(getDefaultStack()),
          );
        } else {
          streamService.message(
            'Chosen tech stack options: ' + JSON.stringify(tectStackOptions),
          );
          // Merge with default stack options
          tectStackOptions = {
            ...getDefaultStack(),
            ...tectStackOptions,
          };
        }

        // Initialize the app builder
        const app = new MobileApp(
          modelService,
          streamService,
          userInput,
          tectStackOptions,
        );
        app
          .execute()
          .then(() => {
            const duration = Date.now() - startTime;
            telemetry.trackAppCreation(
              {
                input: userInput,
                success: true,
                source: 'command',
                ...modelService.getModelConfig(),
              },
              {
                duration,
                totalFilesCount: app.getComponentsCount(),
                createdFilesCount: app.getGeneratedFilesCount(),
              },
            );
          })
          .catch((error) => {
            telemetry.trackAppCreation(
              {
                input: userInput,
                success: false,
                source: 'command',
                error: error,
                errorMessage: error.message,
                errorReason: 'execution_error',
                ...modelService.getModelConfig(),
              },
              {
                duration: Date.now() - startTime,
                totalFilesCount: app.getComponentsCount(),
                createdFilesCount: app.getGeneratedFilesCount(),
              },
            );
          });
      });
  });
}

function registerChatParticipants(context: vscode.ExtensionContext) {
  const telemetry = TelemetryService.getInstance(context);

  const mobileAppHanlder: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> => {
    if (request.command === 'create') {
      return await handleCreateMobileApp(stream, request, token, telemetry);
    } else if (request.command === 'run') {
      return await handleRunMobileApp(stream, telemetry);
    } else {
      if (request.command === 'help') {
        telemetry.trackChatInteraction('mobile.help', {});
      } else {
        telemetry.trackChatInteraction('mobile.general', {
          input: request.prompt,
        });
      }
      stream.markdown(
        `${APP_DISPLAY_NAME} is deigned to create mobile apps. To create a mobile app, type \`@app-developer-mobile /create\` and follow the prompts. To run the app, type \`@app-developer-mobile /run.\``,
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
  mobileAppDeveloper.followupProvider = {
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

async function handleCreateMobileApp(
  stream: vscode.ChatResponseStream,
  request: vscode.ChatRequest,
  token: vscode.CancellationToken,
  telemetry: TelemetryService,
) {
  telemetry.trackChatInteraction('mobile.create', {});
  console.log('MobileBuilder: Create command called');
  let error: any;
  let app = null;
  const startTime = Date.now();
  const modelService = new LanguageModelService(request.model, token);
  const streamService = new StreamHandlerService({
    useChatStream: true,
    chatStream: stream,
  });
  // Get tech stack options
  streamService.progress('Waiting for tech stack options input');
  let techStackOptions = await TechStackWebviewProvider.createOrShow();
  if (!techStackOptions) {
    techStackOptions = getDefaultStack();
    streamService.message(
      'Using default tech stack options: ' + JSON.stringify(techStackOptions),
    );
  } else {
    streamService.message(
      'Chosen tech stack options: ' + JSON.stringify(techStackOptions),
    );
    // Merge with default stack options
    techStackOptions = {
      ...getDefaultStack(),
      ...techStackOptions,
    };
  }

  try {
    app = new MobileApp(
      modelService,
      streamService,
      request.prompt,
      techStackOptions,
    );
    await app.execute();
    telemetry.trackAppCreation(
      {
        input: request.prompt,
        success: true,
        source: 'chat',
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
        input: request.prompt,
        success: false,
        source: 'chat',
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
    const workspaceFolder = await FileParser.getWorkspaceFolder();
    if (!workspaceFolder) {
      stream.markdown('No workspace folder selected');
      telemetry.trackError(
        'mobile.run',
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
    telemetry.trackError('mobile.run', 'chat', error as Error);
    return {
      errorDetails: {
        message: (error as Error).message,
      },
      metadata: { command: 'run' },
    };
  }
}

export function deactivate() {
  outputChannel.appendLine(`${APP_DISPLAY_NAME} deactivated`);
}
