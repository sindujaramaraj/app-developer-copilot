import * as vscode from 'vscode';
import {
  CRED_HANDLER_EDGE_FUNCTION_BASE_URL,
  TOOL_IMAGE_ANALYZER,
  TOOL_PEXEL_IMAGE_SEARCH,
} from '../builder/constants';
import { ImageAnalyzerTool } from '../builder/tools/imageAnalyzerTool';
import { PexelImageSearchTool } from '../builder/tools/pexelImageSearchTool';
import { TelemetryService } from '../service/telemetry/telemetry';

export function registerTools(context: vscode.ExtensionContext) {
  const telemetry = TelemetryService.getInstance(context);
  // Register image analyzer tool
  context.subscriptions.push(
    vscode.lm.registerTool(TOOL_IMAGE_ANALYZER, new ImageAnalyzerTool()),
  );

  // Register Pexel image search tool
  // Fetch the API key
  const pexelsApiKeyPromise = fetch(
    `${CRED_HANDLER_EDGE_FUNCTION_BASE_URL}/pexels/get`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  pexelsApiKeyPromise
    .then((response) => {
      if (!response.ok) {
        telemetry.trackError(
          'tool.register',
          'common',
          'activation',
          new Error('Failed to fetch Pexels API key'),
        );
        throw new Error('Failed to fetch Pexels API key');
      }
      return response.json();
    })
    .then((response) => {
      const pexelsApiKey = response.data.apiKey;
      if (!pexelsApiKey) {
        throw new Error('Pexels API key not found in response');
      }
      // Register the tool with the fetched API key
      context.subscriptions.push(
        vscode.lm.registerTool(
          TOOL_PEXEL_IMAGE_SEARCH,
          new PexelImageSearchTool(pexelsApiKey),
        ),
      );
    })
    .catch((error) => {
      telemetry.trackError('tool.register', 'common', 'activation', error);
      console.error('Error fetching Pexels API key:', error);
    });
}
