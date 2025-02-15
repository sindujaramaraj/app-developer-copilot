import * as vscode from 'vscode';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject, generateText, LanguageModel, tool } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { AppSettings, SettingsServie } from './settings';
import { convertStringToJSON } from '../builder/utils/contentUtil';
import { MAX_RETRY_COUNT } from '../builder/constants';
import { LLMCodeModel, LLMProvider } from './types';
import { runCommandWithPromise } from '../builder/terminalHelper';

export interface IModelMessage {
  content: string;
  role: 'assistant' | 'user' | 'system';
}

interface IGenerateObjectRequest<T> {
  messages: IModelMessage[];
  schema: z.ZodSchema<T>;
  responseFormatPrompt?: string;
}

export class LanguageModelService {
  private useOwnModel: boolean = false;
  private ownModel?: LanguageModel | undefined;
  private copilotModel?: vscode.LanguageModelChat;
  private token?: vscode.CancellationToken;
  private modelProvider: LLMProvider = 'copilot';
  private modelName: LLMCodeModel = 'claude-3-5-sonnet-latest';

  constructor(
    chatModel?: vscode.LanguageModelChat,
    token?: vscode.CancellationToken,
  ) {
    this.copilotModel = chatModel;
    this.token = token;
    if (this.copilotModel && !this.token) {
      throw new Error('Token is required for chat model');
    }
    if (this.copilotModel) {
      this.useOwnModel = false;
      this.modelProvider = 'copilot';
      this.modelName = this.copilotModel.id as LLMCodeModel;
    }
    if (!this.copilotModel) {
      const appSettings = SettingsServie.getAppSettings();
      this.useOwnModel = appSettings.useOwnModel;
      this.modelProvider = appSettings.apiProvider;
      this.modelName = appSettings.model;
      if (appSettings.useOwnModel) {
        this.ownModel = getModel(appSettings);
      } else {
        vscode.lm.selectChatModels().then((models) => {
          this.copilotModel = models[0];
        });
      }
    }
    if (!this.copilotModel && !this.ownModel) {
      throw new Error('No model available');
    }
  }

  createUserMessage(content: string): IModelMessage {
    return {
      content,
      role: 'user',
    };
  }

  createAssistantMessage(content: string): IModelMessage {
    return {
      content,
      role: 'assistant',
    };
  }

  createSystemMessage(content: string): IModelMessage {
    return {
      content,
      role: 'system',
    };
  }

  async generateTextWithTools<T>(
    options: IGenerateObjectRequest<T>,
  ): Promise<{ response: string; tools: string }> {
    if (this.useOwnModel && this.ownModel) {
      if (options.responseFormatPrompt) {
        options.messages.push({
          content: options.responseFormatPrompt,
          role: 'user',
        });
      }
      const { text } = await generateText<{}, T>({
        model: this.ownModel,
        tools: {
          initializeNextProject: tool({
            description: 'Initialize a Next.js project',
            parameters: z.object({
              projectName: z.string().describe('The name of the project'),
            }),
            execute: async ({ projectName }) => {
              await runCommandWithPromise(
                `npx create-next-app@latest ${projectName} --eslint --src-dir --tailwind --ts --app --turbopack --import-alias '@/*'`,
                undefined,
                true,
              );
              return `Created Next.js project: ${projectName}`;
            },
          }),
          installShadcnUIComponents: tool({
            description: 'Install shadcn UI components',
            parameters: z.object({
              components: z
                .array(z.string())
                .describe('List of shadcn UI components'),
            }),
            execute: async ({ components }) => {
              await runCommandWithPromise(
                `npm install shadcn ${components?.join(' ')}`,
              );
              return `Installed shadcn UI components: ${components}`;
            },
          }),
          runInTerminal: tool({
            description: 'Run a command in the terminal',
            parameters: z.object({
              commands: z
                .array(z.string())
                .describe('The commands to run in the terminal'),
            }),
            execute: async ({ commands }) => {
              let useNewTerminal = true;
              for (const command of commands) {
                // await runCommandWithPromise(command, undefined, useNewTerminal);
                useNewTerminal = false;
                console.log(`Executed command: ${command}`);
              }
            },
          }),
        },
        // prompt:
        //   'create a next.js hello world app and use available tools to create app, install shadcn UI components and run commands in terminal',
        messages: options.messages,
        headers: {
          'HTTP-Referer':
            'https://github.com/sindujaramaraj/app-developer-copilot', // Optional, for including your app on openrouter.ai rankings.
          'X-Title': 'app-developer-copilot', // Optional. Shows in rankings on openrouter.ai.
        },
      });
      return { response: text, tools: '' };
    } else if (this.copilotModel) {
      const messages = convertToCopilotMessages(options.messages);
      const response = await handleCopilotRequest(
        this.copilotModel,
        messages,
        this.token as vscode.CancellationToken,
        z.string(),
      );
      return { response: response.responseContent, tools: '' };
    } else {
      throw new Error('No model available');
    }
  }

  async generateText(options: IModelMessage[]): Promise<string> {
    if (this.useOwnModel && this.ownModel) {
      const { text } = await generateText({
        model: this.ownModel,
        tools: {
          runInTerminal: tool({
            description: 'Run a command in the terminal',
            parameters: z.object({
              command: z.string().describe('The command to run'),
            }),
            execute: async ({ command }) => {
              await runCommandWithPromise(command);
              return `Executed command: ${command}`;
            },
          }),
        },
        messages: options,
        headers: {
          'HTTP-Referer':
            'https://github.com/sindujaramaraj/app-developer-copilot', // Optional, for including your app on openrouter.ai rankings.
          'X-Title': 'app-developer-copilot', // Optional. Shows in rankings on openrouter.ai.
        },
      });
      return text;
    } else if (this.copilotModel) {
      const messages = convertToCopilotMessages(options);
      const response = await handleCopilotRequest(
        this.copilotModel,
        messages,
        this.token as vscode.CancellationToken,
        z.string(),
      );
      return response.responseObject;
    } else {
      throw new Error('No model available');
    }
  }

  async generateObject<T>(options: IGenerateObjectRequest<T>): Promise<{
    response: string;
    object: T;
  }> {
    const useTools = false;
    if (this.useOwnModel && this.ownModel) {
      if (useTools) {
        const { response } = await this.generateTextWithTools(options);
        const object = convertStringToJSON(response);
        return {
          response,
          object,
        };
      }
      const { object } = await generateObject<T>({
        model: this.ownModel,
        schema: options.schema,
        messages: options.messages,
        headers: {
          'HTTP-Referer':
            'https://github.com/sindujaramaraj/app-developer-copilot', // Optional, for including your app on openrouter.ai rankings.
          'X-Title': 'app-developer-copilot', // Optional. Shows in rankings on openrouter.ai.
        },
      });
      return {
        response: JSON.stringify(object, null, 2),
        object,
      };
    } else if (this.copilotModel) {
      const messages = convertToCopilotMessages(options.messages);
      if (options.responseFormatPrompt) {
        messages.push(
          vscode.LanguageModelChatMessage.User(options.responseFormatPrompt),
        );
      }
      const response = await handleCopilotRequest(
        this.copilotModel,
        messages,
        this.token as vscode.CancellationToken,
        options.schema,
      );
      return {
        response: response.responseContent,
        object: response.responseObject,
      };
    } else {
      throw new Error('No model available');
    }
  }

  getModel(): vscode.LanguageModelChat | LanguageModel | undefined {
    return this.useOwnModel ? this.ownModel : this.copilotModel;
  }

  getModelConfig(): { modelProvider: LLMProvider; model: LLMCodeModel } {
    return {
      modelProvider: this.modelProvider,
      model: this.modelName,
    };
  }
}

export function getModel(appSettings: AppSettings): LanguageModel {
  let model: LanguageModel;
  switch (appSettings.apiProvider.toLowerCase()) {
    case 'openai':
      const openAIProvider = createOpenAI({ apiKey: appSettings.apiKey });
      return openAIProvider(appSettings.model);
    case 'anthropic':
      const anthropicProvider = createAnthropic({ apiKey: appSettings.apiKey });
      return anthropicProvider(appSettings.model);
    case 'openrouter':
      const router = createOpenRouter({ apiKey: appSettings.apiKey });
      return router(appSettings.model);
    default:
      console.error(`Provider: ${appSettings.apiProvider} not supported`);
      throw new Error('Invalid API provider');
  }
}

function convertToCopilotMessages(
  messages: IModelMessage[],
): vscode.LanguageModelChatMessage[] {
  return messages.map((message) => {
    if (message.role === 'user') {
      return vscode.LanguageModelChatMessage.User(message.content);
    } else {
      // Copilot does not have a system role. So, we will treat system messages as assistant messages
      return vscode.LanguageModelChatMessage.Assistant(message.content);
    }
  });
}

export async function handleCopilotRequest<T>(
  model: vscode.LanguageModelChat,
  messages: vscode.LanguageModelChatMessage[],
  token: vscode.CancellationToken,
  schema: Zod.Schema<T>,
  useJson: boolean = true,
  retryCount: number = 0,
): Promise<{ responseContent: string; responseObject: T }> {
  if (retryCount > MAX_RETRY_COUNT) {
    throw new Error('Failed to parse response after multiple attempts');
  }
  // make request to the LM
  const response = await model.sendRequest(messages, {}, token);

  let responseContent = '';
  for await (const fragment of response.text) {
    responseContent += fragment;
  }

  if (useJson) {
    // Process the response as JSON
    // Check if the response is in Markdown format
    let jsonResponse: any = null;
    try {
      jsonResponse = convertStringToJSON(responseContent);
    } catch (error) {
      console.warn(
        'Attempting retry. Failed to parse code response as JSON:',
        error,
      );
      // TODO: try adding a fix message here
      return handleCopilotRequest(
        model,
        messages,
        token,
        schema,
        useJson,
        retryCount + 1,
      );
    }
    // check if response is valid schema
    const validationResult = schema.safeParse(jsonResponse);
    if (validationResult.error) {
      console.error(
        'Attempting retry. Invalid response schema:',
        validationResult.error.message,
      );
      return handleCopilotRequest(
        model,
        messages,
        token,
        schema,
        useJson,
        retryCount + 1,
      );
    }

    const parsedResponse = validationResult.data as T;
    return {
      responseContent,
      responseObject: parsedResponse,
    };
  } else {
    // return the response as is as a string
    return {
      responseContent,
      responseObject: responseContent as T,
    };
  }
}
