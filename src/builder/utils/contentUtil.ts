import * as vscode from 'vscode';
import { PromptBase } from '../prompt';
import { ICodeComponent } from '../types';

const MAX_RETRY_COUNT = 1;

export function isMarkdown(response: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s+/m, // Headers (e.g., # Header, ## Header)
    /```[\s\S]*?```/m, // Code blocks (e.g., ```code```)
    /^\s*[-*+]\s+/m, // Unordered lists (e.g., - item, * item, + item)
    /^\s*\d+\.\s+/m, // Ordered lists (e.g., 1. item, 2. item)
    /\[.*?\]\(.*?\)/m, // Links (e.g., [text](url))
    /!\[.*?\]\(.*?\)/m, // Images (e.g., ![alt](url))
    />\s+/m, // Blockquotes (e.g., > quote)
    /`[^`]*`/m, // Inline code (e.g., `code`)
  ];

  return markdownPatterns.some((pattern) => pattern.test(response));
}

const codeBlockRegex = /^```[\s\S]*(.+)```$/m;

export function isCodeBlock(response: string): boolean {
  return codeBlockRegex.test(response);
}

export function extractJsonFromMarkdown(markdown: string): any {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```(?![\s\S]*```)/;

  const match = markdown.match(jsonRegex);

  if (match && match[1]) {
    try {
      const jsonString = match[1].trim();
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      return null;
    }
  }

  console.error('No JSON found in the Markdown string.');
  return null;
}

export function extractCodeFromMarkdown(markdown: string): string {
  const match = markdown.match(codeBlockRegex);

  if (match && match[1]) {
    return match[1].trim();
  }

  console.error('No code block found in the Markdown string.');
  return '';
}

export function isMermaidMarkdown(response: string): boolean {
  return response.trim().startsWith('```mermaid');
}

export function convertToMermaidMarkdown(diagram: string): string {
  const mermaidMarkdown = '```mermaid\n' + diagram + '\n```';
  return mermaidMarkdown;
}

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

export function sortComponentsByDependency(
  nodes: ICodeComponent[],
): ICodeComponent[] {
  const componentMap = new Map<string, ICodeComponent>();
  nodes.forEach((node) => {
    componentMap.set(node.name, node);
  });

  const sortedNodes: ICodeComponent[] = [];
  while (nodes.length > sortedNodes.length) {
    for (const node of nodes) {
      // Check if the node is sorted
      if (sortedNodes.find((sortedNode) => node.name === sortedNode.name)) {
        continue;
      }

      const dependencies = node.dependsOn || [];
      if (!dependencies || dependencies.length === 0) {
        sortedNodes.push(node);
        continue;
      }
      let dependeciesFound = true;
      for (const dependency of dependencies) {
        // check if the dependency is on one of the nodes
        if (!componentMap.has(dependency)) {
          continue; // External dependency. Skip checking in sorted nodes
        }
        // check if the dependency is already sorted
        if (sortedNodes.some((sortedNode) => sortedNode.name === dependency)) {
          continue;
        }
        dependeciesFound = false;
        break; // dependency not sorted yet
      }
      if (dependeciesFound) {
        sortedNodes.push(node);
      }
    }
  }
  return sortedNodes;
}
