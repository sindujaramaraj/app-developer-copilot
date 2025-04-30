import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { FigmaError, FigmaTokens } from './types'; // Assuming FigmaTokens type is defined
import { APP_NAME } from '../../builder/constants';

// Figma Integration Constants - Assuming base URL for your edge server
// TODO: Replace with your actual edge server URL
export const FIGMA_EDGE_FUNCTION_BASE_URL =
  'http://localhost:54321/functions/v1'; // Example: Replace with your actual Supabase Edge Function URL
export const FIGMA_LOGIN_URI = `${FIGMA_EDGE_FUNCTION_BASE_URL}/login/figma`;
export const FIGMA_REFRESH_TOKEN_URI = `${FIGMA_EDGE_FUNCTION_BASE_URL}/refresh-token/figma`;
// This path should match the redirect URI configured in your Figma OAuth App settings and handled by your edge function
export const FIGMA_CALLBACK_PATH = '/figma/oauth2/callback'; // Path the edge server redirects to after handling Figma callback
// This is the URI VS Code will listen on for the final redirect from the edge function
export const VSCODE_FIGMA_CALLBACK_URI = `vscode://${APP_NAME}.app-developer-copilot${FIGMA_CALLBACK_PATH}`;

const FIGMA_TOKENS_KEY = 'figmaTokens';

// Helper function to get stored tokens
async function getFigmaTokens(
  context: vscode.ExtensionContext,
): Promise<FigmaTokens | null> {
  const tokensJson = await context.secrets.get(FIGMA_TOKENS_KEY);
  return tokensJson ? JSON.parse(tokensJson) : null;
}

// Helper function to store tokens
async function storeFigmaTokens(
  context: vscode.ExtensionContext,
  tokens: FigmaTokens,
): Promise<void> {
  await context.secrets.store(FIGMA_TOKENS_KEY, JSON.stringify(tokens));
}

// Helper function to check if token is expired (add a buffer, e.g., 5 minutes)
function isTokenExpired(tokens: FigmaTokens): boolean {
  const bufferSeconds = 300; // 5 minutes buffer
  const expiryTime =
    tokens.createdAt + (tokens.expiresIn - bufferSeconds) * 1000;
  return Date.now() > expiryTime;
}

/**
 * Initiates the Figma OAuth login flow.
 */
export async function initiateFigmaLogin(
  _context: vscode.ExtensionContext, // Mark context as unused
): Promise<void> {
  // Construct the login URL with necessary parameters
  // The edge function URL should handle the actual OAuth dance with Figma
  const loginUrl = vscode.Uri.parse(FIGMA_LOGIN_URI, true).with({
    query: `vscode_callback=${encodeURIComponent(VSCODE_FIGMA_CALLBACK_URI)}`, // Pass our final callback URI
  });

  console.log(`Initiating Figma login, opening: ${loginUrl.toString()}`);
  await vscode.env.openExternal(loginUrl);

  // The rest of the flow is handled by the callback handler registered in extension.ts
}

/**
 * Refreshes the Figma access token using the refresh token.
 */
async function refreshFigmaToken(
  context: vscode.ExtensionContext,
  currentTokens: FigmaTokens,
): Promise<FigmaTokens | null> {
  console.log('Attempting to refresh Figma token.');
  try {
    const response = await fetch(FIGMA_REFRESH_TOKEN_URI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentTokens.refreshToken }),
    });

    if (!response.ok) {
      let errorMsg = `Failed to refresh Figma token: ${response.status}`;
      try {
        // Attempt to parse error response from the server
        const errorData = (await response.json()) as FigmaError; // Assert type
        errorMsg += ` - ${errorData.error || errorData.error_description || 'Unknown server error'}`;
      } catch (e) {
        // Ignore JSON parsing error if body is not JSON or empty
        errorMsg += ` - ${await response.text()}`;
      }
      console.error(errorMsg);
      // Optionally clear tokens if refresh fails definitively (e.g., invalid refresh token)
      // await context.secrets.delete(FIGMA_TOKENS_KEY);
      return null;
    }

    // Define a type for the expected refresh response structure
    type RefreshResponse = {
      access_token: string;
      expires_in: number;
      refresh_token?: string; // Optional: Figma might return a new refresh token
    };

    const newTokensData = (await response.json()) as RefreshResponse; // Assert type

    // Validate the received data
    if (
      !newTokensData.access_token ||
      typeof newTokensData.expires_in !== 'number'
    ) {
      console.error('Invalid token data received from refresh endpoint.');
      return null;
    }

    const newTokens: FigmaTokens = {
      accessToken: newTokensData.access_token,
      // Use the new refresh token if provided, otherwise keep the old one
      refreshToken: newTokensData.refresh_token || currentTokens.refreshToken,
      expiresIn: newTokensData.expires_in,
      createdAt: Date.now(), // Update creation time to now
    };

    await storeFigmaTokens(context, newTokens);
    console.log('Figma token refreshed successfully.');
    return newTokens;
  } catch (error) {
    console.error('Error refreshing Figma token:', error);
    return null;
  }
}

/**
 * Gets a valid Figma access token, refreshing if necessary.
 */
export async function getValidFigmaToken(
  context: vscode.ExtensionContext,
): Promise<string | null> {
  let tokens = await getFigmaTokens(context);
  if (!tokens) {
    console.log('No Figma tokens found.');
    // Optionally prompt user to log in
    // initiateFigmaLogin(context);
    return null;
  }

  if (isTokenExpired(tokens)) {
    console.log('Figma token expired, attempting refresh.');
    tokens = await refreshFigmaToken(context, tokens);
    if (!tokens) {
      console.log('Figma token refresh failed.');
      return null; // Refresh failed, token is invalid
    }
  }

  return tokens.accessToken;
}

/**
 * Checks if the user is currently authenticated with Figma.
 */
export async function isFigmaAuthenticated(
  context: vscode.ExtensionContext,
): Promise<boolean> {
  const tokens = await getFigmaTokens(context);
  // Consider a token valid if it exists and hasn't definitively failed refresh
  // A more robust check might try a lightweight API call
  return !!tokens;
}
('');
