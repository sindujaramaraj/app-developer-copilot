import * as vscode from 'vscode';
import { MobileApp } from './builder/mobile/mobileApp';
import { FileParser } from './builder/utils/fileParser';
import { APP_CONFIG_FILE } from './builder/constants';
import { runExpoProject } from './builder/terminalHelper';
import { readAppConfigFromFile } from './builder/utils/appconfigHelper';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  registerChatParticipants(context);
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
    } else if (request.command === 'design') {
      console.log('MobileBuilder: Design command called');
      let error: any;
      try {
        await handleDesignMobileApp(stream, request, token);
      } catch (error) {
        error = error;
      }

      return {
        errorDetails: error
          ? {
              message: error.message,
            }
          : undefined,
        metadata: { command: 'design' },
      };
    } else if (request.command === 'build') {
      console.log('MobileBuilder: Build command called');
      let error: any;
      try {
        await handleBuildMobileApp(stream, request, token);
      } catch (error) {
        error = error;
      }

      return {
        errorDetails: error
          ? {
              message: error.message,
            }
          : undefined,
        metadata: { command: 'build' },
      };
    } else if (request.command === 'deploy') {
      console.log('MobileBuilder: Deploy command called');
      let error: any;
      try {
        await handleDeployMobileApp(stream, request, token);
      } catch (error) {
        error = error;
      }

      return {
        errorDetails: error
          ? {
              message: error.message,
            }
          : undefined,
        metadata: { command: 'deploy' },
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
  mobileAppDeveloper.iconPath = path.join(
    context.extensionUri.fsPath,
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
  const app = new MobileApp(request.model, stream, token, request.prompt);
  await app.execute();
}

async function handleDesignMobileApp(
  stream: vscode.ChatResponseStream,
  request: vscode.ChatRequest,
  token: vscode.CancellationToken,
) {
  console.log('MobileBuilder: Design command called');
  const app = new MobileApp(request.model, stream, token, request.prompt);
  await app.execute();
}

async function handleBuildMobileApp(
  stream: vscode.ChatResponseStream,
  request: vscode.ChatRequest,
  token: vscode.CancellationToken,
) {
  console.log('MobileBuilder: Build command called');
  const app = new MobileApp(request.model, stream, token, request.prompt);
  await app.execute();
}

async function handleDeployMobileApp(
  stream: vscode.ChatResponseStream,
  request: vscode.ChatRequest,
  token: vscode.CancellationToken,
) {
  console.log('MobileBuilder: Deploy command called');
  const app = new MobileApp(request.model, stream, token, request.prompt);
  await app.execute();
}

export function deactivate() {}
