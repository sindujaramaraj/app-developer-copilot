import * as vscode from 'vscode';
import { LanguageModelService } from '../service/languageModel';
import { StreamHandlerService } from '../service/streamHandler';
import { TelemetryService } from '../service/telemetry/telemetry';
import { APP_DISPLAY_NAME } from '../builder/constants';
import { handleCreateMobileApp, handleCreateWebApp } from './chatParticipants';

let outputChannel: vscode.OutputChannel;

export function registerCommands(context: vscode.ExtensionContext) {
  // Initialize output channel
  outputChannel = vscode.window.createOutputChannel(APP_DISPLAY_NAME);
  outputChannel.appendLine(`${APP_DISPLAY_NAME} activated`);
  context.subscriptions.push(outputChannel);

  registerMobileCommands(context);
  registerWebCommands(context);
}

function registerMobileCommands(context: vscode.ExtensionContext) {
  const telemetry = TelemetryService.getInstance(context);
  context.subscriptions.push(
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
          // Initialize model and stream services
          const modelService = new LanguageModelService();
          const streamService = new StreamHandlerService({
            useChatStream: false,
            outputChannel,
          });
          // Handle create mobile app
          await handleCreateMobileApp(
            context,
            userInput,
            'command',
            modelService,
            streamService,
            telemetry,
          );
        });
    }),
  );
}

function registerWebCommands(context: vscode.ExtensionContext) {
  const telemetry = TelemetryService.getInstance(context);
  context.subscriptions.push(
    vscode.commands.registerCommand('app-developer.web.create', () => {
      telemetry.trackCommandPanelInteraction('web.create');

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
          // Initialize model and stream services
          const modelService = new LanguageModelService();
          const streamService = new StreamHandlerService({
            useChatStream: false,
            outputChannel,
          });
          // Handle create mobile app
          await handleCreateWebApp(
            context,
            userInput,
            'command',
            modelService,
            streamService,
            telemetry,
          );
        });
    }),
  );
}
