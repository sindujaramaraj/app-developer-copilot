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

export function isMermaidMarkdown(response: string): boolean {
  return response.trim().startsWith('```mermaid');
}

export function convertToMermaidMarkdown(diagram: string): string {
  const mermaidMarkdown = '```mermaid\n' + diagram + '\n```';
  return mermaidMarkdown;
}
