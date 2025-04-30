import * as vscode from 'vscode';
import fetch, { RequestInit } from 'node-fetch'; // Ensure node-fetch is installed
import {
  getValidFigmaToken,
  initiateFigmaLogin,
  isFigmaAuthenticated,
} from './auth';
import { FigmaFileResponse, FigmaImageResponse } from './types';

const FIGMA_API_BASE_URL = 'https://api.figma.com/v1';

// Simple type for basic Figma API response structure with potential error
type FigmaApiResponse = {
  err?: string;
  [key: string]: any; // Allow other properties
};

export class FigmaClient {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = await getValidFigmaToken(this.context);
    if (!token) {
      // Optionally prompt for login here or let the caller handle it
      throw new Error('Not authenticated with Figma. Please log in.');
    }

    const url = `${FIGMA_API_BASE_URL}${endpoint}`;
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    console.log(`Making Figma API request to: ${url}`);
    try {
      // Explicitly cast headers to satisfy HeadersInit type
      const response = await fetch(url, {
        ...options,
        headers: headers as Record<string, string>,
      });

      if (!response.ok) {
        let errorBody = 'Unknown error';
        try {
          errorBody = await response.text(); // Read body as text first
          const errorJson = JSON.parse(errorBody); // Try parsing as JSON
          errorBody = errorJson.err || errorJson.message || errorBody;
        } catch (e) {
          // Ignore parsing error, use the raw text
        }
        console.error(
          `Figma API Error: ${response.status} ${response.statusText} - ${errorBody}`,
        );
        throw new Error(
          `Figma API request failed: ${response.status} ${response.statusText}. ${errorBody}`,
        );
      }

      // Handle cases where Figma API might return 200 OK but with an error in the body
      // This depends on the specific endpoint's behavior
      const responseData = (await response.json()) as FigmaApiResponse; // Assert type
      if (responseData.err) {
        console.error(`Figma API returned error in body: ${responseData.err}`);
        throw new Error(`Figma API Error: ${responseData.err}`);
      }

      return responseData as T;
    } catch (error) {
      console.error(`Error during Figma API request to ${url}:`, error);
      // Rethrow or handle specific errors (e.g., network issues)
      throw error;
    }
  }

  /**
   * Parses a Figma file URL to extract the file key.
   * Example URL: https://www.figma.com/file/FILE_KEY/File-Name?node-id=NODE_ID
   */
  private parseFileKeyFromUrl(url: string): string | null {
    try {
      const urlParts = new URL(url);
      const pathSegments = urlParts.pathname.split('/');
      // Find the segment after '/file/'
      const fileIndex = pathSegments.findIndex((segment) => segment === 'file');
      if (fileIndex !== -1 && pathSegments.length > fileIndex + 1) {
        return pathSegments[fileIndex + 1];
      }
    } catch (e) {
      console.error('Invalid Figma URL format:', url, e);
    }
    return null;
  }

  /**
   * Parses a Figma file URL to extract the node ID if present.
   * Example URL: https://www.figma.com/file/FILE_KEY/File-Name?node-id=NODE_ID
   */
  private parseNodeIdFromUrl(url: string): string | null {
    try {
      const urlParts = new URL(url);
      return urlParts.searchParams.get('node-id');
    } catch (e) {
      console.error('Invalid Figma URL format or missing node-id:', url, e);
    }
    return null;
  }

  /**
   * Fetches details of a Figma file.
   * @param fileUrl The full URL of the Figma file.
   */
  async getFile(fileUrl: string): Promise<FigmaFileResponse> {
    const fileKey = this.parseFileKeyFromUrl(fileUrl);
    if (!fileKey) {
      throw new Error('Invalid Figma file URL provided.');
    }
    return this.request<FigmaFileResponse>(`/files/${fileKey}`);
  }

  /**
   * Fetches rendered images for specific nodes within a Figma file.
   * @param fileUrl The full URL of the Figma file.
   * @param nodeIds An array of node IDs to render.
   * @param format The desired image format (e.g., 'png', 'jpg', 'svg', 'pdf').
   * @param scale The desired image scale (e.g., 1, 2 for @2x).
   */
  async getImages(
    fileUrl: string,
    nodeIds: string[],
    format: 'png' | 'jpg' | 'svg' | 'pdf' = 'png',
    scale: number = 1,
  ): Promise<FigmaImageResponse> {
    const fileKey = this.parseFileKeyFromUrl(fileUrl);
    if (!fileKey) {
      throw new Error('Invalid Figma file URL provided.');
    }
    if (nodeIds.length === 0) {
      throw new Error('No node IDs provided to fetch images.');
    }

    const endpoint = `/images/${fileKey}`;
    const params = new URLSearchParams({
      ids: nodeIds.join(','),
      format: format,
      scale: scale.toString(),
    });

    // Use GET request with query parameters
    return this.request<FigmaImageResponse>(`${endpoint}?${params.toString()}`);
  }

  /**
   * Fetches images based on a Figma URL, automatically extracting file key and node ID if present.
   * If a node ID is in the URL, fetches only that node's image. Otherwise, could fetch images for top-level nodes (needs refinement).
   * @param figmaUrl The full Figma URL (can include node-id).
   */
  async getImagesFromUrl(
    figmaUrl: string,
    format: 'png' | 'jpg' | 'svg' | 'pdf' = 'png',
    scale: number = 1,
  ): Promise<FigmaImageResponse | null> {
    const fileKey = this.parseFileKeyFromUrl(figmaUrl);
    if (!fileKey) {
      vscode.window.showErrorMessage('Invalid Figma URL provided.');
      return null;
    }

    const nodeId = this.parseNodeIdFromUrl(figmaUrl);

    if (nodeId) {
      // Fetch image for the specific node ID
      console.log(`Fetching image for node ${nodeId} from file ${fileKey}`);
      return this.getImages(figmaUrl, [nodeId], format, scale);
    } else {
      // Behavior without node-id: Fetch the whole file metadata first?
      // Or fetch images for top-level children? Needs decision.
      // For now, let's just log and maybe fetch the file info.
      console.log(
        `Figma URL does not contain a specific node-id. Fetching file info for ${fileKey}`,
      );
      try {
        const fileInfo = await this.getFile(figmaUrl);
        console.log(`File Name: ${fileInfo.name}`);
        // Decide what to do here - maybe fetch images for top-level nodes?
        // Example: Fetch images for direct children of the canvas
        const topLevelNodes =
          fileInfo.document.children?.map((child) => child.id) || [];
        if (topLevelNodes.length > 0) {
          console.log(
            `Fetching images for top-level nodes: ${topLevelNodes.join(', ')}`,
          );
          // Limit the number of nodes to avoid overly large requests?
          return this.getImages(
            figmaUrl,
            topLevelNodes.slice(0, 10),
            format,
            scale,
          ); // Example: Limit to 10
        } else {
          console.log('No top-level nodes found in the Figma file.');
          return { err: null, images: {} }; // Return empty response
        }
      } catch (error) {
        console.error(
          'Failed to fetch file info or top-level node images:',
          error,
        );
        vscode.window.showErrorMessage(
          `Failed to process Figma file: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }
    }
  }

  /**
   * Checks authentication status and initiates login if needed.
   * Returns true if authenticated or login is successfully initiated, false otherwise.
   */
  async ensureAuthenticated(): Promise<boolean> {
    if (await isFigmaAuthenticated(this.context)) {
      return true;
    }

    const choice = await vscode.window.showInformationMessage(
      'You need to log in to Figma to use this feature.',
      { modal: true },
      'Log in to Figma',
    );

    if (choice === 'Log in to Figma') {
      await initiateFigmaLogin(this.context);
      // We initiate login but can't guarantee success here,
      // subsequent calls will check token validity.
      // Returning false might be misleading as login *might* succeed.
      // Let's return true optimistically, assuming the user completes the flow.
      // Or return void and let caller handle the async nature. For now, true.
      return true; // Or maybe return void and handle post-login flow elsewhere
    }

    return false; // User cancelled login
  }
}

/**
 * Parses a Figma file URL to extract the file key and node ID if present.
 * Example URL: https://www.figma.com/file/FILE_KEY/File-Name?node-id=NODE_ID
 */
export function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const fileKeyIndex = pathParts.findIndex(part => part === 'file');

    if (fileKeyIndex === -1 || fileKeyIndex + 1 >= pathParts.length) {
      console.error('Could not find file key in Figma URL path:', url);
      return null;
    }
    const fileKey = pathParts[fileKeyIndex + 1];

    const nodeId = urlObj.searchParams.get('node-id');
    if (!nodeId) {
      console.error('Could not find node-id in Figma URL query parameters:', url);
      return null;
    }

    // Figma node IDs often use URL encoding for ':' (%3A)
    const decodedNodeId = decodeURIComponent(nodeId);

    return { fileKey, nodeId: decodedNodeId };
  } catch (e) {
    console.error('Error parsing Figma URL:', url, e);
    return null;
  }
}
