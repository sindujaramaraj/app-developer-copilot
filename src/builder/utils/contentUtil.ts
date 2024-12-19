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

export function convertStringToJSON(content: string): any {
  // Check if the response is in Markdown format
  let jsonObject: any = null;
  try {
    jsonObject = JSON.parse(content);
    return jsonObject;
  } catch (error) {
    console.warn('Failed to parse content as JSON:', error);
    console.info('Checking if content is in Markdown format...');
    if (isMarkdown(content)) {
      jsonObject = extractJsonFromMarkdown(content);
      return jsonObject;
    } else {
      console.error('Content is not in JSON markdown format');
      throw new Error('Content is not a JSON string or JSON markdown');
    }
  }
}
