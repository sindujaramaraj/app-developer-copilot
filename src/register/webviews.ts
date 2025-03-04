import * as vscode from 'vscode';
import { MobileTechStackWebviewProvider } from '../webview/mobileTechStackWebview';
import { WebTechStackWebviewProvider } from '../webview/webTechStackWebview';
import { ENABLE_WEB_APP } from '../builder/constants';

export function registerWebview(context: vscode.ExtensionContext) {
  const mobileProvider = new MobileTechStackWebviewProvider(
    context.extensionUri,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MobileTechStackWebviewProvider.viewType,
      mobileProvider,
    ),
  );

  if (ENABLE_WEB_APP) {
    const webProvider = new WebTechStackWebviewProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        WebTechStackWebviewProvider.viewType,
        webProvider,
      ),
    );
  }
}
