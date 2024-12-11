import { describe, it, expect } from 'jest';
import {
  isMarkdown,
  isMermaidMarkdown,
  convertToMermaidMarkdown,
} from './markdownUtil';
import { extractJsonFromMarkdown, parseJsonContent } from './jsonUtil';
import { sortComponentsByDependency } from './componentSortUtil';
import { ICodeComponent } from '../types';

describe('Markdown Util', () => {
  it('should identify markdown content', () => {
    const markdownContent = '# Header\n\nThis is a markdown content.';
    expect(isMarkdown(markdownContent)).toBe(true);
  });

  it('should identify mermaid markdown content', () => {
    const mermaidContent = '```mermaid\ngraph TD;\nA-->B;\n```';
    expect(isMermaidMarkdown(mermaidContent)).toBe(true);
  });

  it('should convert content to mermaid markdown', () => {
    const content = 'graph TD;\nA-->B;';
    const mermaidMarkdown = convertToMermaidMarkdown(content);
    expect(mermaidMarkdown).toBe('```mermaid\ngraph TD;\nA-->B;\n```');
  });
});

describe('JSON Util', () => {
  it('should extract JSON from markdown', () => {
    const markdownContent = '```json\n{"key": "value"}\n```';
    const json = extractJsonFromMarkdown(markdownContent);
    expect(json).toEqual({ key: 'value' });
  });

  it('should parse JSON content', () => {
    const jsonString = '{"key": "value"}';
    const json = parseJsonContent(jsonString);
    expect(json).toEqual({ key: 'value' });
  });
});

describe('Component Sort Util', () => {
  it('should sort components by dependency', () => {
    const components: ICodeComponent[] = [
      { name: 'ComponentA', type: 'ui_component', purpose: 'A', path: 'A' },
      { name: 'ComponentB', type: 'ui_component', purpose: 'B', path: 'B', dependsOn: ['ComponentA'] },
      { name: 'ComponentC', type: 'ui_component', purpose: 'C', path: 'C', dependsOn: ['ComponentB'] },
    ];
    const sortedComponents = sortComponentsByDependency(components);
    expect(sortedComponents.map(c => c.name)).toEqual(['ComponentA', 'ComponentB', 'ComponentC']);
  });
});
