import * as assert from 'assert';
import * as vscode from 'vscode';
import { extractJsonFromString } from '../builder/utils/contentUtil';
import { expect } from 'chai';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });

  suite('extractJsonFromString', () => {
    test('should extract JSON from a string with text before and after', () => {
      const input = `Some text before
{
    "name": "test",
    "value": 123
}
Some text after`;

      const result = extractJsonFromString(input);
      expect(result).to.deep.equal({
        name: 'test',
        value: 123,
      });
    });

    test('should handle nested JSON structures', () => {
      const input = `Here's the config:
{
    "outer": {
        "inner": {
            "value": "nested"
        }
    }
}`;

      const result = extractJsonFromString(input);
      expect(result).to.deep.equal({
        outer: {
          inner: {
            value: 'nested',
          },
        },
      });
    });

    test('should return null for invalid input', () => {
      const input = 'No JSON here';
      const result = extractJsonFromString(input);
      expect(result).to.be.null;
    });
  });
});
