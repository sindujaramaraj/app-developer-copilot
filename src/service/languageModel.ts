import * as vscode from 'vscode';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject, generateText, LanguageModel } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { AppSettings, SettingsServie } from './settings';
import { convertStringToJSON } from '../builder/utils/contentUtil';
import { MAX_RETRY_COUNT } from '../builder/constants';
import { LLMCodeModel, LLMProvider } from './types';

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

  async generateText(options: IModelMessage[]): Promise<string> {
    if (this.useOwnModel && this.ownModel) {
      const { text } = await generateText({
        model: this.ownModel,
        messages: options,
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
    if (this.useOwnModel && this.ownModel) {
      const { object } = await generateObject<T>({
        model: this.ownModel,
        schema: options.schema,
        messages: options.messages,
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
