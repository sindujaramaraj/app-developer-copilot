import * as vscode from 'vscode';
import { expect } from 'chai'; // Ensure that the expect function is imported from the correct testing framework

describe('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    expect(true).to.be.true;
  });
});
