import * as vscode from 'vscode';

export function registerTools(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.lm.registerTool(
      'app_developer_runInTerminal',
      new RunInTerminalTool(),
    ),
  );
}

interface IRunInTerminalParameters {
  command: string;
}

export class RunInTerminalTool
  implements vscode.LanguageModelTool<IRunInTerminalParameters>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IRunInTerminalParameters>,
    _token: vscode.CancellationToken,
  ) {
    const params = options.input as IRunInTerminalParameters;

    const terminal = vscode.window.createTerminal('Language Model Tool User');
    terminal.show();
    try {
      await waitForShellIntegration(terminal, 5000);
    } catch (e) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart((e as Error).message),
      ]);
    }

    const execution = terminal.shellIntegration!.executeCommand(params.command);
    const terminalStream = execution.read();

    let terminalResult = '';
    for await (const chunk of terminalStream) {
      terminalResult += chunk;
    }

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(terminalResult),
    ]);
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IRunInTerminalParameters>,
    _token: vscode.CancellationToken,
  ) {
    const confirmationMessages = {
      title: 'Run command in terminal',
      message: new vscode.MarkdownString(
        `Run this command in a terminal?` +
          `\n\n\`\`\`\n${options.input.command}\n\`\`\`\n`,
      ),
    };

    return {
      invocationMessage: `Running command in terminal`,
      confirmationMessages,
    };
  }
}

async function waitForShellIntegration(
  terminal: vscode.Terminal,
  timeout: number,
): Promise<void> {
  let resolve: () => void;
  let reject: (e: Error) => void;
  const p = new Promise<void>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  const timer = setTimeout(
    () =>
      reject(
        new Error(
          'Could not run terminal command: shell integration is not enabled',
        ),
      ),
    timeout,
  );

  const listener = vscode.window.onDidChangeTerminalShellIntegration((e) => {
    if (e.terminal === terminal) {
      clearTimeout(timer);
      listener.dispose();
      resolve();
    }
  });

  await p;
}
