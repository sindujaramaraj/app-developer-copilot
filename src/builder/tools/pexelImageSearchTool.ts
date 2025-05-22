import * as vscode from 'vscode';

// Define interfaces for Pexels API response structure
interface PexelsPhotoSource {
  original: string;
  large2x: string;
  large: string;
  medium: string;
  small: string;
  portrait: string;
  landscape: string;
  tiny: string;
}

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string; // Pexels page URL for the photo
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: PexelsPhotoSource;
  liked: boolean;
  alt: string;
}

interface PexelsSearchResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  next_page?: string;
}

// Define the parameters interface for the VS Code tool
interface IPexelImageSearchParameters {
  query: string;
  per_page?: number; // Optional: allow specifying number of results
}

export class PexelImageSearchTool
  implements vscode.LanguageModelTool<IPexelImageSearchParameters>
{
  private pexelsApiKey: string;

  constructor(pexelsApiKey: string) {
    this.pexelsApiKey = pexelsApiKey;
    if (!this.pexelsApiKey) {
      // In a real VS Code extension, you might prompt the user or read from settings
      console.warn(
        'Pexels API key not found. Please set the PEXELS_API_KEY environment variable ' +
          'or pass the API key to the constructor. The tool may not function.',
      );
    }
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IPexelImageSearchParameters>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { query, per_page = 1 } = options.input;

    if (!this.pexelsApiKey) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Error: Pexels API key is not configured.',
        ),
      ]);
    }

    if (!query || query.trim() === '') {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Error: No search query provided. Please provide a term to search for.',
        ),
      ]);
    }

    try {
      const searchParams = new URLSearchParams({
        query: query,
        per_page: per_page.toString(),
      });
      const url = `https://api.pexels.com/v1/search?${searchParams.toString()}`;

      const fetchResponse = await fetch(url, {
        headers: {
          Authorization: this.pexelsApiKey,
        },
      });

      if (!fetchResponse.ok) {
        // Handle HTTP errors (e.g., 401, 403, 404, 500)
        let errorBody;
        try {
          errorBody = await fetchResponse.json();
        } catch (e) {
          // If parsing error body fails, use status text
          errorBody = { error: fetchResponse.statusText };
        }
        const errorMessage = `Error: Pexels API request failed with status ${fetchResponse.status}. ${errorBody?.error ? `Message: ${errorBody.error}` : ''}`;
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(errorMessage),
        ]);
      }

      const responseData: PexelsSearchResponse = await fetchResponse.json();
      // The existing code expects `response.data`, so we'll mimic that structure for minimal changes below
      const response = { data: responseData };

      if (response.data.photos && response.data.photos.length > 0) {
        // Return the URL(s) of the image(s) found.
        // If per_page is 1, this will be a single image.
        // If per_page > 1, you might want to return a list or a JSON string of results.
        // For simplicity, returning the first image's original URL if per_page was 1,
        // or a JSON string of all found photos' original URLs.
        if (per_page === 1) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              response.data.photos[0].src.original,
            ),
          ]);
        } else {
          const imageResults = response.data.photos.map((photo) => ({
            url: photo.src.original,
            alt: photo.alt,
            photographer: photo.photographer,
          }));
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              JSON.stringify(imageResults, null, 2),
            ),
          ]);
        }
      } else {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `No image found on Pexels for the query: "${query}".`,
          ),
        ]);
      }
    } catch (error) {
      console.error('Error searching Pexels:', error);
      let errorMessage =
        'Error: Failed to search for image on Pexels due to an unexpected error.';
      if (error instanceof Error) {
        errorMessage += ` Details: ${error.message}`;
      }
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(errorMessage),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IPexelImageSearchParameters>,
    _token: vscode.CancellationToken,
  ) {
    const { query, per_page = 1 } = options.input;
    if (!query || query.trim() === '') {
      // Optionally, you could throw an error here or return undefined to prevent invocation
      // For now, let invoke handle the empty query error.
      return undefined;
    }

    const confirmationMessages = {
      title: 'Search Pexels for Images',
      message: new vscode.MarkdownString(
        `Search Pexels for images matching the query: **"${query}"**?\n\n(Will fetch up to ${per_page} image(s))`,
      ),
    };

    return {
      invocationMessage: `Searching Pexels for "${query}"...`,
      confirmationMessages,
    };
  }
}
