import { App, IAppStageInput, IAppStageOutput } from '../app';

import {
  GenerateCodeForMobileComponentPrompt,
  InitializeMobileAppPrompt,
  InitializeMobileAppWithBackendPrompt,
} from '../prompt';
import {
  ComponentType,
  ZGenerateCodeResponseType,
  ZInitializeAppResponseType,
} from '../types';
import { createExpoApp } from '../terminalHelper';
import { SUPA_TYPES_MOBILE_FILE_PATH } from '../constants';
import { AppType } from '../utils/appconfigHelper';
import {
  getLibsToInstallForStack,
  IMobileTechStackOptions,
} from './mobileTechStack';

/**
 * Mobile app builder
 */
export class MobileApp extends App {
  /**
   * Initialize the mobile app
   * @param userMessage
   * @returns
   */
  async initialize(
    userMessage?: string,
  ): Promise<IAppStageOutput<ZInitializeAppResponseType>> {
    return this.baseInitialize(
      userMessage,
      (hasBackend) =>
        hasBackend
          ? new InitializeMobileAppWithBackendPrompt({
              techStack: this.getTechStackOptions(),
            })
          : new InitializeMobileAppPrompt({
              techStack: this.getTechStackOptions(),
            }),
      async (responseObj) => {
        // Create expo project
        await createExpoApp(responseObj.name);
        // TODO: Commenting this out for now because behavior is not clear
        // Reset expo project
        // await resetExpoProject(createAppResponseObj.name);
        this.logMessage(`Created expo project: ${responseObj.name}`);
      },
      AppType.MOBILE,
      this.getTechStackOptions(),
    );
  }

  async generateCode({
    messages: previousMessages,
    output: previousOutput,
  }: IAppStageInput<ZInitializeAppResponseType>): Promise<
    IAppStageOutput<ZGenerateCodeResponseType>
  > {
    return this.baseGenerateCode(
      previousMessages,
      previousOutput,
      getLibsToInstallForStack(this.getTechStackOptions()),
      (component, dependencies, architecture, design) =>
        new GenerateCodeForMobileComponentPrompt({
          name: component.name,
          path: component.path,
          type: component.type as ComponentType,
          purpose: component.purpose,
          dependencies,
          design,
          architecture,
          techStack: this.getTechStackOptions(),
        }),
      () => this.getCommonDependenciesForCodeGeneration(), // no custom dependencies for mobile
    );
  }

  getTechStackOptions(): IMobileTechStackOptions {
    return this.techStackOptions as IMobileTechStackOptions;
  }

  getSupaTypesFilePath(): string {
    return SUPA_TYPES_MOBILE_FILE_PATH;
  }

  getSupaEnvFile(supaUrl: string, supaAnonKey: string): string {
    const envLocalContent = `
    EXPO_PUBLIC_SUPABASE_URL=${supaUrl}
    EXPO_PUBLIC_SUPABASE_ANON_KEY=${supaAnonKey}
    `;
    return envLocalContent;
  }
}
