import * as vscode from "vscode";
import { TelemetryService } from "./service/telemetry/telemetry";
import { registerChatParticipants } from "./register/chatParticipants";
import { registerCommands } from "./register/commands";
import { registerWebview } from "./register/webviews";
import { registerTools } from "./register/tools";

export function activate(context: vscode.ExtensionContext) {
  // Initialize telemetry
  const telemetry = TelemetryService.getInstance(context);
  telemetry.trackActivation();
  context.subscriptions.push(telemetry);

  // Register extension commands and participants
  registerChatParticipants(context);
  registerTools(context);
  registerCommands(context);
  registerWebview(context);
}

export function deactivate() {}
