import * as vscode from 'vscode';
import { MobileApp } from './builder/mobile/mobileApp';
import { FileParser } from './builder/utils/fileParser';
import { APP_CONFIG_FILE } from './builder/constants';
import { runExpoProject } from './builder/terminalHelper';
import { readAppConfigFromFile } from './builder/utils/appconfigHelper';
import { LanguageModelService } from './service/languageModel';
import { StreamHandlerService } from './service/streamHandler';

export function activate(context: vscode.ExtensionContext) {
  registerChatParticipants(context);
  registerCommands(context);
}

function registerCommands(_context: vscode.ExtensionContext) {
  vscode.commands.registerCommand('app-developer.mobile.create', () => {
    vscode.window
      .showInputBox({
        prompt: 'What would you like to create?',
        placeHolder: 'A notes app',
      })
      .then((userInput) => {
        if (!userInput) {
          return;
        }
        const modelService = new LanguageModelService();
        const streamService = new StreamHandlerService(false);
        const app = new MobileApp(modelService, streamService, userInput);
        app.execute();
      });
  });
}

function registerChatParticipants(context: vscode.ExtensionContext) {
  const mobileAppHanlder: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ): Promise<vscode.ChatResult> => {
    if (request.command === 'create') {
      console.log('MobileBuilder: Create command called');
      let error: any;
      try {
        await handleCreateMobileApp(stream, request, token);
      } catch (error) {
        error = error;
      }

      return {
        errorDetails: error
          ? {
              message: error.message,
            }
          : undefined,
        metadata: { command: 'create' },
      };
    } else if (request.command === 'run') {
      const workspaceFolder = await FileParser.getWorkspaceFolder();
      if (!workspaceFolder) {
        stream.markdown('MobileBuilder: No workspace folder selected');
        return {
          errorDetails: {
            message: 'No workspace folder selected',
          },
          metadata: { command: 'run' },
        };
      }
      await vscode.workspace
        .findFiles(`**/${APP_CONFIG_FILE}`)
        .then(async (files) => {
          if (files.length === 0) {
            stream.markdown('MobileBuilder: No app.json found');
            return;
          }
          const appJsonPath = files[0].fsPath;
          const appJson = await readAppConfigFromFile(appJsonPath);
          const appName = appJson.name;
          stream.markdown(`MobileBuilder: Running app ${appName}`);
          runExpoProject(appName);
        });
      return {
        metadata: { command: 'run' },
      };
    } else {
      console.log('MobileBuilder: No command found');
      const chatResponse = await request.model.sendRequest(
        [vscode.LanguageModelChatMessage.User(request.prompt)],
        {},
        token,
      );
      for await (const fragment of chatResponse.text) {
        stream.markdown(fragment);
      }
      return {};
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
      }
      return [];
    },
  };
}

async function handleCreateMobileApp(
  stream: vscode.ChatResponseStream,
  request: vscode.ChatRequest,
  token: vscode.CancellationToken,
) {
  console.log('MobileBuilder: Create command called');
  const modelService = new LanguageModelService(request.model, token);
  const streamService = new StreamHandlerService(true, stream);
  const app = new MobileApp(modelService, streamService, request.prompt);
  await app.execute();
}

export function deactivate() {}
