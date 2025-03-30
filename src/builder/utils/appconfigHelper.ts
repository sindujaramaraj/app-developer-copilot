import * as path from 'path';

import { APP_CONFIG_FILE, APP_VERISON } from '../constants';
import { FileUtil } from './fileUtil';
import { LLMCodeModel, LLMProvider } from '../../service/types';
import { IMobileTechStackOptions } from '../mobile/mobileTechStack';
import { IWebTechStackOptions } from '../web/webTechStack';

export enum AppType {
  MOBILE = 'mobile',
  WEB = 'web',
  API = 'api',
}

export interface AppConfig {
  name: string;
  title: string;
  version: string;
  initialPrompt: string;
  modelProvider: LLMProvider;
  languageModel: LLMCodeModel;
  features: string[];
  components: Object;
  techStack: IMobileTechStackOptions | IWebTechStackOptions;
  type: AppType;
  hasDatabase?: boolean;
  hasAuth?: boolean;
}

export async function createAppConfig(
  app: Omit<AppConfig, 'version'>,
): Promise<void> {
  // create a file with the app manifest
  const appManifest: AppConfig = {
    ...app,
    version: APP_VERISON,
  };
  const content = JSON.stringify(appManifest, null, 2);
  await FileUtil.parseAndCreateFiles(
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
  const workspaceFolder = await FileUtil.getWorkspaceFolder();
  if (!workspaceFolder) {
    throw new Error('No workspace folder selected');
  }
  try {
    const content = await FileUtil.readFile(
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
  const content = await FileUtil.readFile(appConfigFilePath);
  return JSON.parse(content);
}
