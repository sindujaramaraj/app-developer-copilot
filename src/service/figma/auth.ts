import * as vscode from 'vscode';
import { OAUTH_EDGE_FUNCTION_BASE_URL } from '../../builder/constants';
import * as OAuthHelper from '../../builder/utils/oauthHelper';

export const FIGMA_LOGIN_URI = `${OAUTH_EDGE_FUNCTION_BASE_URL}/figma/login`;
export const FIGMA_REFRESH_TOKEN_URI = `${OAUTH_EDGE_FUNCTION_BASE_URL}/figma/refresh-token`;

export async function isConnectedToFigma(context: vscode.ExtensionContext) {
  const accessToken = await getAccessToken(context);
  if (!accessToken) {
    return false;
  }
  return true;
}

export async function connectToFigma(context: vscode.ExtensionContext) {
  try {
    const tokenResponse = await OAuthHelper.connectToOAuthProvider({
      provider: 'figma',
      loginUri: FIGMA_LOGIN_URI,
    });

    if (!tokenResponse) {
      throw new Error('Failed to connect to Figma');
    }

    // Store tokens in secrets
    await storeTokens(context, tokenResponse);

    console.log('Successfully connected to Figma! 🎉');
  } catch (error) {
    console.error('Failed to connect to Figma:', error);
    throw error;
  }
}

export async function refreshAccessToken(context: vscode.ExtensionContext) {
  const refreshToken = await getRefreshToken(context);
  if (!refreshToken) {
    throw new Error('No refresh token found. Cannot refresh access token.');
  }
  console.log('Refreshing Figma access token...');
  const tokenResponse = await OAuthHelper.refreshAccessToken(
    refreshToken,
    FIGMA_REFRESH_TOKEN_URI,
  );

  // Store it in secrets
  console.debug('Storing Figma tokens in secrets...');
  await storeTokens(context, tokenResponse);
}

async function storeTokens(
  context: vscode.ExtensionContext,
  tokenResponse: OAuthHelper.TokenResponse,
) {
  await context.secrets.store('figma_access_token', tokenResponse.access_token);
  await context.secrets.store(
    'figma_refresh_token',
    tokenResponse.refresh_token,
  );
  await context.secrets.store(
    'figma_expires_in',
    `${tokenResponse.expires_in}`, // convert to string
  );
}

export async function clearTokens(context: vscode.ExtensionContext) {
  await context.secrets.delete('figma_access_token');
  await context.secrets.delete('figma_refresh_token');
  await context.secrets.delete('figma_expires_in');
}

export async function getAccessToken(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  return await context.secrets.get('figma_access_token');
}

async function getRefreshToken(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  return await context.secrets.get('figma_refresh_token');
}
