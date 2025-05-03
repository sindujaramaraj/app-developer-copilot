import * as vscode from 'vscode';
import { Buffer } from 'buffer'; // Import Buffer for base64 conversion
import { AI_EDGE_FUNCTION_BASE_URL } from '../builder/constants';

export function registerTools(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.lm.registerTool(
      'app_developer_imageAnalyzer',
      new ImageAnalyzerTool(),
    ),
  );
}

interface IImageAnalyzerParameters {
  uris: string | string[]; // Changed from images (base64 strings) to uris
}

export class ImageAnalyzerTool
  implements vscode.LanguageModelTool<IImageAnalyzerParameters>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IImageAnalyzerParameters>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    console.log('ImageAnalyzerTool invoked with options:', options);

    const params = options.input;
    const uriStrings = Array.isArray(params.uris) ? params.uris : [params.uris];
    // Placeholder for the actual API endpoint URL
    const apiEndpoint = `${AI_EDGE_FUNCTION_BASE_URL}/analyze`; // Replace with your actual endpoint

    try {
      const imageDatas = await Promise.all(
        uriStrings.map(async (uriString) => {
          try {
            const uri = vscode.Uri.parse(uriString, true); // Use strict parsing
            const fileContent = await vscode.workspace.fs.readFile(uri);
            // Convert Uint8Array to base64 string
            const base64String = Buffer.from(fileContent).toString('base64');
            return `data:image/png;base64,${base64String}`; // Assuming PNG format, adjust as needed
          } catch (readError) {
            console.error(
              `Failed to read or encode file: ${uriString}`,
              readError,
            );
            // Return a specific marker or throw to handle downstream
            return null; // Indicate failure for this specific URI
          }
        }),
      );

      // Filter out any nulls from failed reads
      const validImageDatas = imageDatas.filter(
        (data) => data !== null,
      ) as string[];

      if (validImageDatas.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            'Failed to read any valid image files.',
          ),
        ]);
      }

      // Simulate API calls with base64 data
      const responses = await Promise.all(
        validImageDatas.map(async (imageData, index) => {
          // In a real scenario, replace this with an actual fetch call sending base64
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: [imageData] }),
          });
          const data = await response.json();
          return { imageIndex: index + 1, analysis: data };
        }),
      );
      const resultJson = JSON.stringify(responses);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(resultJson),
      ]);
      // return new vscode.LanguageModelToolResult([
      //   new vscode.LanguageModelTextPart(
      //     `Processed ${validImageDatas.length} image(s) from URIs. The image is a figma design of mobile login page using linkedin with white background and a logo on top.`, // Placeholder for actual analysis result
      //   ), // Cast to any to avoid type issues),
      // ]);
    } catch (error) {
      console.error('Image analysis tool failed:', error);
      const errorMessage = `Error analyzing images from URIs: ${error instanceof Error ? error.message : String(error)}`;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(errorMessage),
      ]);
    }
  }

  // Optional: Implement prepareInvocation for user confirmation if desired
  async prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<IImageAnalyzerParameters>,
    _token: vscode.CancellationToken,
  ) {
    const confirmationMessages = {
      title: 'Analyze images from URIs', // Updated title
      message: new vscode.MarkdownString(
        `Analyze images from the provided URIs?`,
      ), // Updated message
    };

    return {
      invocationMessage: `Reading and analyzing images from URIs`, // Updated invocation message
      confirmationMessages,
    };
  }
}

async function waitForShellIntegration(
  terminal: vscode.Terminal,
  timeout: number,
): Promise<void> {
  let resolve: () => void;
  let reject: (e: Error) => void;
  const p = new Promise<void>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  const timer = setTimeout(
    () =>
      reject(
        new Error(
          'Could not run terminal command: shell integration is not enabled',
        ),
      ),
    timeout,
  );

  const listener = vscode.window.onDidChangeTerminalShellIntegration((e) => {
    if (e.terminal === terminal) {
      clearTimeout(timer);
      listener.dispose();
      resolve();
    }
  });

  await p;
}
