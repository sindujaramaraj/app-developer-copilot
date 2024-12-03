import * as vscode from 'vscode';

export async function installNPMDependencies(
  folderName: string,
  dependencies: string[],
  installedDependencies: string[],
): Promise<void> {
  vscode.window.showInformationMessage('Installing dependencies...');
  for (const dependency of dependencies) {
    if (installedDependencies.includes(dependency)) {
      console.info(`Dependency ${dependency} already installed`);
      continue;
    }
    await runCommandWithPromise(`npm install ${dependency}`, folderName);
    installedDependencies.push(dependency);
  }
}

export async function createExpoApp(appName: string): Promise<void> {
  return runCommandWithPromise(`npx create-expo-app ${appName}`);
}

export async function resetExpoProject(folderName: string): Promise<void> {
  return runCommandWithPromise(`npm run reset-project`, folderName);
}

export async function runExpoProject(folderName: string): Promise<void> {
  return runCommandWithPromise(`npm run start`, folderName);
}

function runCommandWithPromise(
  command: string,
  folder?: string,
): Promise<void> {
  const terminal = vscode.window.createTerminal();
  terminal.show();
  if (folder) {
    terminal.sendText(`cd ${folder}`);
  }
  terminal.sendText(command);
  return new Promise((resolve) => {
    const disposable = vscode.window.onDidEndTerminalShellExecution((e) => {
      if (e.exitCode === 0 && e.terminal.processId === terminal.processId) {
        disposable.dispose();
        resolve();
      } else {
        throw new Error('Failed to run command: ' + command);
      }
    });
  });
}
