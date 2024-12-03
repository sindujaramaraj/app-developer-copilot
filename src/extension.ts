import * as vscode from 'vscode';
import { MobileApp } from './builder/mobile/mobileApp';
import { FileParser } from './builder/utils/fileParser';
import { APP_CONFIG_FILE } from './builder/constants';
import { runExpoProject } from './builder/terminalHelper';
import { readAppConfigFromFile } from './builder/utils/appconfigHelper';

export function activate(context: vscode.ExtensionContext) {
  registerChatParticipants(context);
}

function registerChatParticipants(context: vscode.ExtensionContext) {
  const mobileAppHanlder: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken,
  ) => {
    if (request.command === 'create') {
      console.log('MobileBuilder: Create command called');
      await handleCreateMobileApp(stream, request, token);
    } else if (request.command === 'run') {
      const workspaceFolder = await FileParser.getWorkspaceFolder();
      if (!workspaceFolder) {
        stream.markdown('MobileBuilder: No workspace folder selected');
        return;
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
    }
    return;
  };

  const mobileBuilder = vscode.chat.createChatParticipant(
    'app-developer.mobile',
    mobileAppHanlder,
  );
  mobileBuilder.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    'builder.jpeg',
  );
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

export function deactivate() {}
