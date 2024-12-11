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

export function parseJsonContent(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse JSON content:', error);
    return null;
  }
}
