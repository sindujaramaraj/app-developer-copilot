import * as vscode from 'vscode';
import {
  TechStackOptions,
  StateManagement,
  UILibrary,
  Navigation,
  Storage,
  Authentication,
} from '../builder/mobile/mobileTechStack';
import { ENABLE_AUTHENTICATION } from '../builder/constants';

export class TechStackWebviewProvider {
  public static viewType = 'techStack.webview';
  private _view?: vscode.WebviewView;
  private static _panel: vscode.WebviewPanel;

  public dispose() {
    TechStackWebviewProvider._panel?.dispose();
  }

  public static async createOrShow(): Promise<TechStackOptions> {
    TechStackWebviewProvider._panel?.dispose();

    const panel = vscode.window.createWebviewPanel(
      TechStackWebviewProvider.viewType,
      'Choose Tech Stack',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      },
    );
    let result: TechStackOptions;

    const onSubmitCallback = async (options: TechStackOptions) => {
      result = options;
      panel.dispose();
    };

    TechStackWebviewProvider.setWebviewMessageListener(
      panel.webview,
      onSubmitCallback,
    );

    panel.webview.html = TechStackWebviewProvider._getHtmlForWebview();
    const promise = new Promise<TechStackOptions>((resolve) => {
      panel.onDidDispose(() => {
        resolve(result);
      });
    });

    TechStackWebviewProvider._panel = panel;

    return promise;
  }

  private static _getHtmlForWebview() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { padding: 10px; }
            select { width: 100%; margin: 5px 0; padding: 5px; }
            button { margin-top: 10px; width: 100%; padding: 8px; }
          </style>
        </head>
        <body>
          <h3>Configure Tech Stack</h3>
          
          <label>State Management:</label>
          <select id="stateManagement">
            ${Object.values(StateManagement)
              .map((value) => `<option value="${value}">${value}</option>`)
              .join('')}
          </select>

          <label>UI Library:</label>
          <select id="uiLibrary">
            ${Object.values(UILibrary)
              .map((value) => `<option value="${value}">${value}</option>`)
              .join('')}
          </select>

          <!--<label>Navigation:</label>
          <select id="navigation">
            ${Object.values(Navigation)
              .map((value) => `<option value="${value}">${value}</option>`)
              .join('')}
          </select>-->

          <label>Storage:</label>
          <select id="storage">
            ${Object.values(Storage)
              .map((value) => `<option value="${value}">${value}</option>`)
              .join('')}
          </select>
              
          ${
            ENABLE_AUTHENTICATION
              ? `
          <label>Authentication:</label>
          <select id="authentication">
            ${Object.values(Authentication)
              .map((value) => `<option value="${value}">${value}</option>`)
              .join('')}
          </select>`
              : ''
          }

          <button id="techstack-button-submit">Done</button>

          <script>
          (function() {
            const vscode = acquireVsCodeApi();
            const button = document.getElementById('techstack-button-submit');
            button.addEventListener('click', (e) => {
              submit();
            });

            function submit() {
              const authentication = document.getElementById('authentication');
              const options = {
                stateManagement: document.getElementById('stateManagement').value,
                uiLibrary: document.getElementById('uiLibrary').value,
                storage: document.getElementById('storage').value,
                authentication: authentication ? authentication.value : 'none',
              };
              vscode.postMessage({ type: 'submit', options });
            }
          })();
          </script>
        </body>
      </html>
    `;
  }

  private static setWebviewMessageListener(
    webview: vscode.Webview,
    onSubmit: (options: TechStackOptions) => void,
  ) {
    webview.onDidReceiveMessage(
      (message: { type: string; options: TechStackOptions }) => {
        switch (message.type) {
          case 'submit':
            onSubmit(message.options);
            return;
        }
      },
    );
  }
}
