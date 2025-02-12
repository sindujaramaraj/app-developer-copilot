import * as vscode from 'vscode';
import { MobileTechStackWebviewProvider } from '../webview/mobileTechStackWebview';

export function registerWebview(context: vscode.ExtensionContext) {
  const provider = new MobileTechStackWebviewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MobileTechStackWebviewProvider.viewType,
      provider,
    ),
  );
}
