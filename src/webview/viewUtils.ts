import * as vscode from 'vscode';

export function getHtmlForWebview(scriptUri: vscode.Uri) {
  return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Web Tech Stack</title>
          <style>
            body { padding: 10px; }
            select { width: 100%; margin: 5px 0; padding: 5px; }
            button { margin-top: 10px; width: 100%; padding: 8px; }
            input[type="text"] { width: 100%; padding: 5px; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" src="${scriptUri}"></script>
        </body>
      </html>
    `;
}
