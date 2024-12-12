import * as vscode from 'vscode';
import { PromptBase } from '../prompt';
import { ICodeComponent } from '../types';
import { isMarkdown, isMermaidMarkdown, convertToMermaidMarkdown } from './markdownUtil';
import { extractJsonFromMarkdown, extractCodeFromMarkdown } from './jsonUtil';
import { sortComponentsByDependency } from './componentSortUtil';

const MAX_RETRY_COUNT = 1;

const codeBlockRegex = /^```[\s\S]*(.+)```$/m;

export async function parseResponse<T>(
  model: vscode.LanguageModelChat,
  messages: vscode.LanguageModelChatMessage[],
  token: vscode.CancellationToken,
  prompt: PromptBase<{}, T>,
  retryCount: number = 0,
): Promise<[string, T]> {
  if (retryCount > MAX_RETRY_COUNT) {
    throw new Error('Failed to parse response after multiple attempts');
  }
  // make request to the LM
  const response = await model.sendRequest(messages, {}, token);

  let responseContent = '';
  for await (const fragment of response.text) {
    responseContent += fragment;
  }

  // Check if the response is in Markdown format
  let jsonResponse: any = null;
  try {
    jsonResponse = JSON.parse(responseContent);
  } catch (error) {
    console.warn('Failed to parse code response as JSON:', error);
    console.info('Checking if response is in Markdown format...');
    if (isMarkdown(responseContent)) {
      jsonResponse = extractJsonFromMarkdown(responseContent);
    } else {
      console.error(
        'Response is not in JSON markdown format. Attempting retry',
        responseContent,
      );
      // TODO: try adding a fix message here
      return parseResponse(model, messages, token, prompt, retryCount + 1);
    }
  }

  // check if response is valid schema
  const validationResult = prompt.validateResponse(jsonResponse);
  if (validationResult.error) {
    console.error('Invalid response schema:', validationResult.error.message);
    // Continue with the response even if it's not a valid schema
    //throw new Error('Invalid response schema');
    console.error(responseContent);
  }

  const parsedResponse = validationResult.value as T;
  return [responseContent, parsedResponse];
}
