import * as vscode from 'vscode';
import { Buffer } from 'buffer'; // Import Buffer for base64 conversion
import { getMimeTypeFromUri } from '../utils/contentUtil';
import { AI_EDGE_FUNCTION_BASE_URL } from '../constants';

// Define the structure for image input
export interface IImageSource {
  uri: string;
  source: 'file' | 'url';
}

// Update the parameters interface
interface IImageAnalyzerParameters {
  images: IImageSource[]; // Expect an array of image sources
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
    if (!params.images || params.images.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('No images provided for analysis.'),
      ]);
    }

    // Placeholder for the actual API endpoint URL
    const apiEndpoint = `${AI_EDGE_FUNCTION_BASE_URL}/analyze`; // Replace with your actual endpoint

    try {
      const imageDatas = await Promise.all(
        params.images.map(async (imageSource) => {
          try {
            let base64String: string;
            let mimeType: string;

            if (imageSource.source === 'file') {
              const uri = vscode.Uri.parse(imageSource.uri, false);
              const fileContent = await vscode.workspace.fs.readFile(uri);
              mimeType = getMimeTypeFromUri(imageSource.uri); // Infer MIME type from URI
              base64String = Buffer.from(fileContent).toString('base64');
            } else if (imageSource.source === 'url') {
              const response = await fetch(imageSource.uri);
              if (!response.ok) {
                throw new Error(
                  `Failed to fetch image from URL: ${response.statusText}`,
                );
              }
              mimeType =
                response.headers.get('Content-Type') ||
                'application/octet-stream'; // Get MIME type from header or default
              const arrayBuffer = await response.arrayBuffer();
              base64String = Buffer.from(arrayBuffer).toString('base64');
            } else {
              throw new Error(
                `Unsupported image source: ${imageSource.source}`,
              );
            }

            return `data:${mimeType};base64,${base64String}`;
          } catch (readOrFetchError) {
            console.error(
              `Failed to process image source: ${imageSource.uri} (source: ${imageSource.source})`,
              readOrFetchError,
            );
            // Return a specific marker or throw to handle downstream
            return null; // Indicate failure for this specific source
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
            'Failed to process any valid image sources.',
          ),
        ]);
      }

      // Simulate API calls with base64 data
      // NOTE: Sending multiple images in one request might require adjusting the API endpoint's expected format.
      // This example sends one request per image for simplicity.
      const responses = await Promise.all(
        validImageDatas.map(async (imageData, index) => {
          // In a real scenario, replace this with an actual fetch call sending base64
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Adjust the body structure based on your API requirements
            // This example sends each image individually. Consider if your API can handle multiple images in one call.
            body: JSON.stringify({ images: [imageData] }),
          });
          if (!response.ok) {
            // Handle API errors more gracefully
            console.error(
              `API request failed for image ${index + 1}: ${response.statusText}`,
            );
            return {
              imageIndex: index + 1,
              error: `API Error: ${response.statusText}`,
            };
          }
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
      const errorMessage = `Error analyzing images: ${error instanceof Error ? error.message : String(error)}`;
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(errorMessage),
      ]);
    }
  }

  // Optional: Implement prepareInvocation for user confirmation if desired
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IImageAnalyzerParameters>,
    _token: vscode.CancellationToken,
  ) {
    // Generate a summary of images to be processed
    const imageSummaries = options.input.images
      .map((img) => `- ${img.source}: ${img.uri}`)
      .join('\n');

    const confirmationMessages = {
      title: 'Analyze Images', // Updated title
      message: new vscode.MarkdownString(
        `Analyze the following images?\n\n${imageSummaries}`,
      ), // Updated message
    };

    return {
      invocationMessage: `Reading and analyzing ${options.input.images.length} image(s)...`, // Updated invocation message
      confirmationMessages,
    };
  }
}
