import * as vscode from 'vscode';
import {
  IMobileTechStackOptions,
  StateManagement,
  UILibrary,
  Navigation,
  Storage,
  getDefaultMobileTechStack,
} from '../builder/mobile/mobileTechStack';
import { ENABLE_AUTHENTICATION, ENABLE_BACKEND } from '../builder/constants';
import { AuthenticationMethod, Backend } from '../builder/backend/serviceStack';

export class MobileTechStackWebviewProvider {
  public static viewType = 'mobileTechStack.webview';
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

    webviewView.webview.html =
      MobileTechStackWebviewProvider._getHtmlForWebview();
  }

  public static async createOrShow(): Promise<IMobileTechStackOptions> {
    MobileTechStackWebviewProvider._panel?.dispose();

    const panel = vscode.window.createWebviewPanel(
      MobileTechStackWebviewProvider.viewType,
      'Choose Tech Stack',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      },
    );
    let result: IMobileTechStackOptions;

    const onSubmitCallback = async (options: IMobileTechStackOptions) => {
      result = options;
      panel.dispose();
    };

    MobileTechStackWebviewProvider.setWebviewMessageListener(
      panel.webview,
      onSubmitCallback,
    );

    panel.webview.html = MobileTechStackWebviewProvider._getHtmlForWebview();
    const promise = new Promise<IMobileTechStackOptions>((resolve) => {
      panel.onDidDispose(() => {
        resolve(result);
      });
    });

    MobileTechStackWebviewProvider._panel = panel;

    return promise;
  }

  private static _getHtmlForWebview() {
    const defaultOptions: IMobileTechStackOptions = getDefaultMobileTechStack();
    const backendConfig = defaultOptions.backendConfig;
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
                  `<option value="${value}" ${defaultOptions.stateManagement === value ? 'selected' : ''} >${value}</option>`,
              )
              .join('')}
          </select>

          <label>UI Library:</label>
          <select id="uiLibrary">
            ${Object.values(UILibrary)
              .map(
                (value) =>
                  `<option value="${value}" ${defaultOptions.uiLibrary === value ? 'selected' : ''}>${value}</option>`,
              )
              .join('')}
          </select>

          <!--<label>Navigation:</label>
          <select id="navigation">
            ${Object.values(Navigation)
              .map(
                (value) =>
                  `<option value="${value}" ${defaultOptions.navigation === value ? 'selected' : ''}>${value}</option>`,
              )
              .join('')}
          </select>-->

          <label>Storage:</label>
          <select id="storage">
            ${Object.values(Storage)
              .map(
                (value) =>
                  `<option value="${value}" ${defaultOptions.storage === value ? 'selected' : ''}>${value}</option>`,
              )
              .join('')}
          </select>

          ${
            ENABLE_BACKEND
              ? `
              <div>      
                <label>Backend:</label>
                <select id="backend">
                ${Object.values(Backend).map(
                  (value) =>
                    `<option value="${value}" ${
                      backendConfig.backend === value ? 'selected' : ''
                    }>${value}</option>`,
                )}
                </select>
              </div>
              <div>
                <input type="checkbox" id="useExistingBackend" ${backendConfig.useExisting ? 'checked' : ''}>
                <label for="useExistingBackend">Use Existing Backend</label>
              </div>
              `
              : ''
          }
              
          ${
            ENABLE_BACKEND && ENABLE_AUTHENTICATION
              ? `
          <label>Authentication: Experimental</label>
          <select id="authentication">
            ${Object.values(AuthenticationMethod)
              .map(
                (value) =>
                  `<option value="${value}" ${backendConfig.authentication === value ? 'selected' : ''}>${value}</option>`,
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
              const backend = document.getElementById('backend');
              const useExistingBackend = document.getElementById('useExistingBackend');

              const options = {
                stateManagement: document.getElementById('stateManagement').value,
                uiLibrary: document.getElementById('uiLibrary').value,
                storage: document.getElementById('storage').value,
                backendConfig: {
                  backend: backend ? backend.value : 'none',
                  authentication: authentication ? authentication.value : 'none',
                  useExisting: useExistingBackend ? useExistingBackend.checked : false,
            } 
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
    onSubmit: (options: IMobileTechStackOptions) => void,
  ) {
    webview.onDidReceiveMessage(
      (message: { type: string; options: IMobileTechStackOptions }) => {
        switch (message.type) {
          case 'submit':
            onSubmit(message.options);
            return;
        }
      },
    );
  }
}
