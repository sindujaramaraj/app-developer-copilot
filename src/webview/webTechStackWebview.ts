import * as vscode from 'vscode';
import {
  BuildTools,
  getDefaultWebTechStack,
  StateManagement,
  Styling,
  UILibrary,
  IWebTechStackOptions,
} from '../builder/web/webTechStack';
import { AuthenticationMethod, Backend } from '../builder/backend/serviceStack';
import { ENABLE_AUTHENTICATION } from '../builder/constants';

export class WebTechStackWebviewProvider {
  public static viewType = 'webTechStack.webview';
  private _view?: vscode.WebviewView;
  private static _panel: vscode.WebviewPanel;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = WebTechStackWebviewProvider._getHtmlForWebview();
  }

  public static async createOrShow(): Promise<IWebTechStackOptions> {
    WebTechStackWebviewProvider._panel?.dispose();

    const panel = vscode.window.createWebviewPanel(
      WebTechStackWebviewProvider.viewType,
      'Choose Tech Stack',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      },
    );
    let result: IWebTechStackOptions;

    const onSubmitCallback = async (options: IWebTechStackOptions) => {
      result = options;
      panel.dispose();
    };

    WebTechStackWebviewProvider.setWebviewMessageListener(
      panel.webview,
      onSubmitCallback,
    );

    panel.webview.html = WebTechStackWebviewProvider._getHtmlForWebview();
    const promise = new Promise<IWebTechStackOptions>((resolve) => {
      panel.onDidDispose(() => {
        resolve(result);
      });
    });

    WebTechStackWebviewProvider._panel = panel;

    return promise;
  }

  private static _getHtmlForWebview() {
    const defaultOptions: IWebTechStackOptions = getDefaultWebTechStack();
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
              .map(
                (value) =>
                  `<option value="${value}" ${
                    defaultOptions.stateManagement === value ? 'selected' : ''
                  } >${value}</option>`,
              )
              .join('')}
          </select>

          <label>UI Library:</label>
          <select id="uiLibrary">
            ${Object.values(UILibrary)
              .map(
                (value) =>
                  `<option value="${value}" ${
                    defaultOptions.uiLibrary === value ? 'selected' : ''
                  }>${value}</option>`,
              )
              .join('')}
          </select>

          <label>Styling:</label>
            <select id="styling">
            ${Object.values(Styling).map(
              (value) =>
                `<option value="${value}" ${
                  defaultOptions.styling === value ? 'selected' : ''
                }>${value}</option>`,
            )}
            </select>

          <label>Build:</label>
          <select id="buildTool">
          ${Object.values(BuildTools)
            .map(
              (value) =>
                `<option value="${value}" ${
                  defaultOptions.buildTool === value ? 'selected' : ''
                }>${value}</option>`,
            )
            .join('')}
          </select>

          <label>Backend:</label>
          <select id="backend">
          ${Object.values(Backend).map(
            (value) =>
              `<option value="${value}" ${
                defaultOptions.backend === value ? 'selected' : ''
              }>${value}</option>`,
          )}
          </select>

          ${
            ENABLE_AUTHENTICATION
              ? `
                    <label>Authentication:</label>
                    <select id="authentication">
                      ${Object.values(AuthenticationMethod)
                        .map(
                          (value) =>
                            `<option value="${value}" ${defaultOptions.authentication === value ? 'selected' : ''}>${value}</option>`,
                        )
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
                styling: document.getElementById('styling').value,
                buildTool: document.getElementById('buildTool').value,
                backend: document.getElementById('backend').value,
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
    onSubmit: (options: IWebTechStackOptions) => void,
  ) {
    webview.onDidReceiveMessage(
      (message: { type: string; options: IWebTechStackOptions }) => {
        switch (message.type) {
          case 'submit':
            onSubmit(message.options);
            return;
        }
      },
    );
  }
}
