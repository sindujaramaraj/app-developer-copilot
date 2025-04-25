import * as vscode from 'vscode';
import { getHtmlForWebview } from './viewUtils';

export enum WebviewViewTypes {
  MobileTechStack = 'mobileTechStackView', // Web pack config will generate a file with this name
  WebTechStack = 'webTechStackView', // Web pack config will generate a file with this name
}

export class WebViewProvider {
  private static panel: vscode.WebviewPanel;

  public static async createOrShow<T>(
    context: vscode.ExtensionContext,
    viewType: WebviewViewTypes,
  ): Promise<T> {
    // If we already have a panel, destroy it
    if (WebViewProvider.panel) {
      WebViewProvider.panel.dispose();
    }

    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      viewType,
      'Choose Tech Stack',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      },
    );
    WebViewProvider.panel = panel;

    // Set html
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', `${viewType}.js`),
    );
    panel.webview.html = getHtmlForWebview(scriptUri);

    let result: T;

    // Handle events
    const onSubmitCallback = async (options: T) => {
      result = options;
      panel.dispose();
    };

    panel.webview.onDidReceiveMessage(
      (message: { type: string; options: T }) => {
        switch (message.type) {
          case 'submit':
            onSubmitCallback(message.options);
            return;
        }
      },
    );

    const promise = new Promise<T>((resolve) => {
      panel.onDidDispose(
        () => {
          resolve(result);
        },
        null,
        context.subscriptions,
      );
    });

    return promise;
  }
}
