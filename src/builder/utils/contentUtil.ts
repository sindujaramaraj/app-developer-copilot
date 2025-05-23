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

const codeBlockRegex = /```[a-zA-Z0-9]*\s*([\s\S]*?)\s*```/;

export function isCodeBlock(response: string): boolean {
  return codeBlockRegex.test(response);
}

export function extractJsonFromMarkdown(markdown: string): any {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```(?![\s\S]*```)/;

  const match = markdown.match(jsonRegex);

  if (match && match[1]) {
    const jsonString = match[1].trim();
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.debug('Failed to parse JSON block:', error);
      // Handle escaped characters and normalize JSON string
      const normalizedJson = jsonString
        .replace(/\\\\/g, '\\') // Convert \\ to \
        .replace(/\\"/g, '"') // Convert \" to "
        .replace(/\\n/g, '\n'); // Convert \n to actual newlines
      try {
        return JSON.parse(normalizedJson);
      } catch (error) {
        console.error('Failed to parse normalized JSON:', error);
        // If parsing fails, return null
        throw error;
      }
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
  return markdown;
}

export function isMermaidMarkdown(response: string): boolean {
  return response.trim().startsWith('```mermaid');
}

export function convertToMermaidMarkdown(diagram: string): string {
  const mermaidMarkdown = '```mermaid\n' + diagram + '\n```';
  return mermaidMarkdown;
}

export const extractJsonFromString = (input: string): any => {
  try {
    // This regex looks for a JSON-like structure
    const jsonRegex = /{[\s\S]*?(?<=\n)}(?=\s*$)/;
    const match = input.match(jsonRegex);

    if (!match) {
      return null;
    }

    // Parse the extracted JSON string
    return match[0];
  } catch (error) {
    console.error('Error extracting JSON:', error);
    return null;
  }
};

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
      const jsonInString = extractJsonFromString(content);
      if (jsonInString) {
        return JSON.parse(jsonInString);
      }
      console.error('Content is not a valid JSON string or JSON markdown');
      throw new Error('Content is not a JSON string or JSON markdown');
    }
  }
}

export function processMediaFile(content: string): Uint8Array {
  if (isBase64(content)) {
    // Convert base64 string to binary
    const base64Image = content.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    const uint8Array = new Uint8Array(buffer);
    return uint8Array;
  }

  throw new Error('Asset is not a valid base64 string');
}

export function isBase64(content: string): boolean {
  // Base64 pattern: only valid base64 characters
  const base64Pattern =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  // Data URL pattern
  const dataUrlPattern = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/;

  try {
    // Check if it's a data URL
    if (dataUrlPattern.test(content)) {
      const base64Data = content.split(',')[1];
      return base64Pattern.test(base64Data);
    }

    // Check if it's raw base64
    return base64Pattern.test(content);
  } catch (error) {
    return false;
  }
}

export function isMimeTypeImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

// Helper function to get MIME type from file extension
export function getMimeTypeFromUri(uriString: string): string {
  const extension = uriString.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'bmp':
      return 'image/bmp';
    default:
      return 'application/octet-stream'; // Default or unknown
  }
}
