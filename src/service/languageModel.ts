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

const SUPPORTED_COPILOT_MODELS = [
  'gpt-4.1',
  'gpt-4o',
  'claude-3.5-sonnet',
  'gemini-2.5-pro',
];

export interface IModelMessage {
  content: string;
  role: 'assistant' | 'user' | 'system';
}

export interface IModelResponse {
  content: string;
  toolCalls?: vscode.LanguageModelToolCallPart[];
  toolResults?: Record<string, vscode.LanguageModelToolResult>;
}

interface IGenerateObjectRequest<T> {
  messages: IModelMessage[];
  schema: z.ZodSchema<T>;
  responseFormatPrompt?: string;
  tools?: string[]; // list of tools to use
}

export class LanguageModelService {
  private useOwnModel: boolean = false;
  private ownModel?: LanguageModel | undefined;
  private copilotModel?: vscode.LanguageModelChat;
  private token?: vscode.CancellationToken;
  private toolInvocationToken?: vscode.ChatParticipantToolToken;
  private modelProvider: LLMProvider = 'copilot';
  private modelName: LLMCodeModel = 'claude-3-5-sonnet-latest';

  constructor(
    chatModel?: vscode.LanguageModelChat,
    token?: vscode.CancellationToken,
    toolInvocationToken?: vscode.ChatParticipantToolToken,
  ) {
    if (chatModel && !token && !toolInvocationToken) {
      // If a chat model is provided, but no token or toolInvocationToken, throw an error
      throw new Error('Token is required for chat model');
    }
    if (chatModel) {
      this.copilotModel = chatModel;
      this.token = token;
      this.toolInvocationToken = toolInvocationToken;
      this.useOwnModel = false;
      this.modelProvider = 'copilot';
      this.modelName = this.copilotModel.id as LLMCodeModel;
    }
    if (!chatModel) {
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

  static async getCopilotModel(
    model: vscode.LanguageModelChat,
  ): Promise<vscode.LanguageModelChat> {
    if (SUPPORTED_COPILOT_MODELS.includes(model.id)) {
      return model;
    }
    // Default to claude-3-5-sonnet-latest if the model is not supported
    const claudeModels = await vscode.lm.selectChatModels({
      family: 'claude-3.5-sonnet',
    });
    //const claudeModels = await vscode.lm.selectChatModels();
    if (claudeModels.length > 0) {
      return claudeModels[0];
    }
    // If no default model is found, throw an error
    throw new Error(
      `Model ${model.id} is not supported. Please select a supported model.`,
    );
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
        this.toolInvocationToken as vscode.ChatParticipantToolToken,
        z.string(),
      );
      return response.responseObject;
    } else {
      throw new Error('No model available');
    }
  }

  async generateObject<T>(options: IGenerateObjectRequest<T>): Promise<{
    response: IModelResponse;
    object: T;
  }> {
    if (this.useOwnModel && this.ownModel) {
      const { object } = await generateObject<T>({
        model: this.ownModel,
        schema: options.schema,
        messages: options.messages,
        // TODO: Add tools support for own model if needed
        headers: {
          'HTTP-Referer': 'https://appdevelopercode.github.io/', // Optional, for including your app on openrouter.ai rankings.
          'X-Title': 'app-developer-copilot', // Optional. Shows in rankings on openrouter.ai.
        },
      });
      return {
        response: {
          content: JSON.stringify(object, null, 2),
        },
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
        this.toolInvocationToken as vscode.ChatParticipantToolToken,
        options.schema,
        true, // useJson is true for generateObject
        options.tools, // Pass tools here
      );
      return {
        response: response.modelResponse,
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

async function sendRequest(
  model: vscode.LanguageModelChat,
  messages: vscode.LanguageModelChatMessage[],
  token: vscode.CancellationToken,
  toolInvocationToken: vscode.ChatParticipantToolToken,
  tools: vscode.LanguageModelChatTool[],
): Promise<IModelResponse> {
  let responseContent = '';
  let accumuldatedToolCalls: vscode.LanguageModelToolCallPart[] = [];
  const toolResults: Record<string, vscode.LanguageModelToolResult> = {};
  // Use default tools if no tools are provided
  const defautlToolNames = ['copilot_fetchWebPage'];
  const defaultTools =
    tools.length === 0
      ? vscode.lm.tools.filter((tool) => defautlToolNames.includes(tool.name))
      : [];
  messages.push(
    vscode.LanguageModelChatMessage.User(
      `You have access to the following tools: ${defaultTools.join(', ')}`,
    ),
  );
  async function runWithTools() {
    let tokenCount = 0;
    for await (const message of messages) {
      tokenCount += await model.countTokens(message, token);
    }
    console.debug('Token count for messages:', tokenCount);

    const response = await model.sendRequest(
      messages,
      {
        toolMode: getToolMode(model, tools),
        tools: [...defaultTools, ...tools],
      },
      token,
    );
    try {
      if (response) {
        const toolCalls: vscode.LanguageModelToolCallPart[] = [];
        responseContent = '';
        for await (const part of response.stream) {
          if (part instanceof vscode.LanguageModelTextPart) {
            responseContent += part.value;
          } else if (part instanceof vscode.LanguageModelToolCallPart) {
            toolCalls.push(part);
          }
        }

        if (toolCalls.length) {
          if (responseContent) {
            messages.push(
              vscode.LanguageModelChatMessage.Assistant(responseContent),
            );
          }
          messages.push(vscode.LanguageModelChatMessage.Assistant(toolCalls));
          accumuldatedToolCalls = accumuldatedToolCalls.concat(toolCalls);
          // Process tool calls

          const toolResultParts: vscode.LanguageModelToolResultPart[] = [];
          for (const call of toolCalls) {
            console.log('Invoking tool:', call.name);
            const toolResult = await vscode.lm.invokeTool(call.name, {
              input: call.input,
              toolInvocationToken,
            });
            toolResults[call.name] = toolResult;
            toolResultParts.push(
              new vscode.LanguageModelToolResultPart(
                call.callId,
                toolResult.content,
              ),
            );

            console.debug(
              `Tool result received for ${call.name}: ${JSON.stringify(toolResult)}`,
            );

            // Remove the tool from tools list
            // const toolIndex = tools.findIndex(
            //   (tool) => tool.name === call.name,
            // );
            // if (toolIndex !== -1) {
            //   tools.splice(toolIndex, 1);
            // }
          }

          messages.push(vscode.LanguageModelChatMessage.User(toolResultParts));

          messages.push(
            vscode.LanguageModelChatMessage.User(
              'Tool result is now available. Proceed with the next steps.',
            ),
          );

          // This loops until the model doesn't want to call any more tools, then the request is done.
          await runWithTools();
        }
      } else {
        throw new Error('No response from model');
      }
    } catch (error) {
      console.log('Error processing response from model: ' + error);
      throw error;
    }
  }
  await runWithTools();
  return {
    content: responseContent,
    toolCalls: accumuldatedToolCalls,
    toolResults,
  };
}

export async function handleCopilotRequest<T>(
  model: vscode.LanguageModelChat,
  messages: vscode.LanguageModelChatMessage[],
  token: vscode.CancellationToken,
  toolInvocationToken: vscode.ChatParticipantToolToken,
  schema: Zod.Schema<T>,
  useJson: boolean = true,
  tools: string[] = [],
  retryCount: number = 0,
): Promise<{ modelResponse: IModelResponse; responseObject: T }> {
  if (retryCount > MAX_RETRY_COUNT) {
    throw new Error('Failed to parse response after multiple attempts');
  }
  // make request to the LM
  let requestedTools: (vscode.LanguageModelToolInformation | undefined)[] = [];
  if (tools.length) {
    requestedTools = tools.map((tool) => {
      return vscode.lm.tools.find((t) => t.name === tool);
    });
  }

  const modelResponse = await sendRequest(
    model,
    messages,
    token,
    toolInvocationToken,
    requestedTools.filter(
      (tool): tool is vscode.LanguageModelToolInformation => !!tool,
    ),
  );

  if (useJson) {
    // Process the response as JSON
    // Check if the response is in Markdown format
    let jsonResponse: any = null;
    try {
      jsonResponse = convertStringToJSON(modelResponse.content);
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
        toolInvocationToken,
        schema,
        useJson,
        tools,
        retryCount + 1,
      );
    }
    jsonResponse = fixResponseFromModel(jsonResponse);
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
        toolInvocationToken,
        schema,
        useJson,
        tools,
        retryCount + 1,
      );
    }

    const parsedResponse = validationResult.data as T;
    return {
      modelResponse: modelResponse,
      responseObject: parsedResponse,
    };
  } else {
    // return the response as is as a string
    return {
      modelResponse: modelResponse,
      responseObject: modelResponse as T,
    };
  }
}

function fixResponseFromModel(jsonResponse: any): any {
  // Check if the response is an array
  if (Array.isArray(jsonResponse)) {
    // If it's an array, return the first element
    return jsonResponse[0];
  }
  if (jsonResponse && jsonResponse['json_schema']) {
    // If it has a json_schema property, return the json_schema property
    // Note: This is a workaround for response received from openai models
    return jsonResponse['json_schema'];
  }
  if (jsonResponse && jsonResponse['schema']) {
    // If it has a schema property, return the schema property
    // Note: This is a workaround for response received from openai models
    return jsonResponse['schema'];
  }

  if (
    jsonResponse &&
    jsonResponse.design &&
    typeof jsonResponse.design !== 'string'
  ) {
    // If it has a design property, return the design property as string
    // Note: This is a workaround for response received from models
    jsonResponse.design = JSON.stringify(jsonResponse.design);
  }

  // In any other scenario, return the response as is
  return jsonResponse;
}

function getToolMode(
  model: vscode.LanguageModelChat,
  tools: vscode.LanguageModelChatTool[],
) {
  if (model.id === 'claude-3.5-sonnet' && tools.length > 0) {
    // If the model is Claude and there are tools, use Required mode
    return vscode.LanguageModelChatToolMode.Required;
  }
  // In any other case, use Auto mode
  return vscode.LanguageModelChatToolMode.Auto;
}
