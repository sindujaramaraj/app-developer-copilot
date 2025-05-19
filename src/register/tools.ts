import * as vscode from 'vscode';
import {
  TOOL_IMAGE_ANALYZER,
  TOOL_PEXEL_IMAGE_SEARCH,
} from '../builder/constants';
import { ImageAnalyzerTool } from '../builder/tools/imageAnalyzerTool';
import { PexelImageSearchTool } from '../builder/tools/pexelImageSearchTool';

export function registerTools(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.lm.registerTool(TOOL_IMAGE_ANALYZER, new ImageAnalyzerTool()),
  );
  context.subscriptions.push(
    vscode.lm.registerTool(TOOL_PEXEL_IMAGE_SEARCH, new PexelImageSearchTool()),
  );
}
