import * as vscode from 'vscode';
import { LLMCodeModel, LLMProvider } from './types';

export interface AppSettings {
  useOwnModel: boolean;
  apiProvider: LLMProvider;
  apiKey: string;
  model: LLMCodeModel;
}

export class SettingsServie {
  static getAppSettings(): AppSettings {
    const settings = vscode.workspace.getConfiguration('app-developer-copilot');
    return {
      useOwnModel: settings.get('useOwnModel') as boolean,
      apiProvider: settings.get('apiProvider') as LLMProvider,
      apiKey: settings.get('apiKey') as string,
      model: settings.get('model') as LLMCodeModel,
    };
  }
}
