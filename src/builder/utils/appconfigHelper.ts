import * as vscode from 'vscode';
import * as path from 'path';

import { APP_CONFIG_FILE } from '../constants';
import { FileParser } from './fileParser';

export enum AppType {
  MOBILE = 'mobile',
  WEB = 'web',
  API = 'api',
}

export interface AppConfig {
  name: string;
  initialPrompt: string;
  type: AppType;
  hasDatabase?: boolean;
  hasAuth?: boolean;
}

export async function createAppConfig(app: AppConfig) {
  // create a file with the app manifest
  const appManifest: AppConfig = {
    name: app.name,
    initialPrompt: app.initialPrompt,
    type: app.type,
  };
  const content = JSON.stringify(appManifest, null, 2);
  await FileParser.parseAndCreateFiles(
    [
      {
        path: APP_CONFIG_FILE,
        content,
      },
    ],
    app.name,
  );
}

export async function getAppConfig(appName: string): Promise<AppConfig> {
  const workspaceFolder = await FileParser.getWorkspaceFolder();
  if (!workspaceFolder) {
    throw new Error('No workspace folder selected');
  }
  try {
    const content = await FileParser.readFile(
      path.join(workspaceFolder, appName, APP_CONFIG_FILE),
    );
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to read app config:', error);
    return {} as AppConfig;
  }
}

export async function readAppConfigFromFile(
  appConfigFilePath: string,
): Promise<AppConfig> {
  const content = await FileParser.readFile(appConfigFilePath);
  return JSON.parse(content);
}
