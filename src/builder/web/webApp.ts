import { App, IAppStageInput, IAppStageOutput } from '../app';
import {
  GenerateCodeForWebComponentPrompt,
  InitializeWebAppPrompt,
  InitializeWebAppWithBackendPrompt,
} from '../prompt';
import {
  ComponentType,
  ZGenerateCodeForComponentResponseType,
  ZGenerateCodeResponseType,
  ZInitializeAppResponseType,
} from '../types';
import { runCommandWithPromise } from '../terminalHelper';
import { FileUtil } from '../utils/fileUtil';
import { SUPA_TYPES_WEB_FILE_PATH } from '../constants';
import { AppType } from '../utils/appconfigHelper';
import {
  getLibsToInstallForStack,
  getWebAppCreationCommands,
  IWebTechStackOptions,
  WebFramework,
} from './webTechStack';

/**
 * Web app builder
 */
export class WebApp extends App {
  /**
   * Initialize the web app
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
          ? new InitializeWebAppWithBackendPrompt({
              techStack: this.getTechStackOptions(),
            })
          : new InitializeWebAppPrompt({
              techStack: this.getTechStackOptions(),
            }),
      async (responseObj) => {
        this.logProgress('Running commands to create project');
        const createWebAppCommands = getWebAppCreationCommands(
          this.getTechStackOptions(),
          responseObj.name,
        );
        // Run commands to create web app
        let useNewTerminal = true;
        for (const createWebAppCommand of createWebAppCommands) {
          this.logProgress('Running command that might need user input');
          await runCommandWithPromise(
            createWebAppCommand,
            undefined,
            useNewTerminal,
          );
          useNewTerminal = false;
        }

        this.logMessage(`Created web project: ${responseObj.name}`);
      },
      AppType.WEB,
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
        new GenerateCodeForWebComponentPrompt({
          name: component.name,
          path: component.path,
          type: component.type as ComponentType,
          purpose: component.purpose,
          dependencies,
          design,
          architecture,
          techStack: this.getTechStackOptions(),
        }),
      () => this.getDependenciesForCodeGeneration(),
    );
  }

  async getDependenciesForCodeGeneration(): Promise<
    ZGenerateCodeForComponentResponseType[]
  > {
    const commonDependencies: ZGenerateCodeForComponentResponseType[] =
      await super.getCommonDependenciesForCodeGeneration();

    const techStackOptions = this.getTechStackOptions();
    if (techStackOptions.framework === WebFramework.NEXT) {
      // This file is generated during project creation
      const NEXT_CSS_FILE = 'src/app/globals.css';
      const glocalCSSPath = await this.getFilePathUri(NEXT_CSS_FILE);
      const globalCSSContent = await FileUtil.readFile(glocalCSSPath.fsPath);
      // add the global.css file path
      commonDependencies.push({
        componentName: 'global.css',
        filePath: NEXT_CSS_FILE,
        content: globalCSSContent,
        libraries: [],
        summary: 'Global CSS file',
      });
    }

    return commonDependencies;
  }

  getTechStackOptions(): IWebTechStackOptions {
    return this.techStackOptions as IWebTechStackOptions;
  }

  getSupaTypesFilePath(): string {
    return SUPA_TYPES_WEB_FILE_PATH;
  }

  getSupaEnvFile(supaUrl: string, supaAnonKey: string): string {
    const envLocalContent = `
    NEXT_PUBLIC_SUPABASE_URL=${supaUrl}
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${supaAnonKey}
    `;
    return envLocalContent;
  }

  // Optionally override fix() here if web-specific fix logic is needed
}
