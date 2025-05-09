import * as vscode from 'vscode';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: string; // Duration in seconds
}

export async function connectToOAuthProvider({
  provider,
  loginUri,
}: {
  provider: 'figma' | 'supabase';
  loginUri: string;
}): Promise<TokenResponse> {
  try {
    // Open browser to login to provider through intermediate edge function
    const open = await vscode.env.openExternal(vscode.Uri.parse(loginUri));
    if (!open) {
      throw new Error(
        'Failed to open browser to connect to provider: ' + provider,
      );
    }
    console.log('Opening browser to connect to provider: ' + provider);
    // Register URI handler to handle the callback from the browser
    return new Promise((resolve, reject) => {
      const disposable = vscode.window.registerUriHandler({
        handleUri: async (uri: vscode.Uri) => {
          if (uri.path === `/oauth2/callback/${provider}`) {
            try {
              const tokenResponse = await handleOAuth2Callback(provider, uri);
              resolve(tokenResponse);
            } catch (error) {
              reject(error);
            } finally {
              disposable.dispose();
            }
          }
        },
      });
    });
  } catch (error) {
    console.error('Failed to connect to provider:' + provider, error);
    throw error;
  }
}

// Handle OAuth2 callback after user logs in from the browser or refreshes the token
async function handleOAuth2Callback(
  provider: string,
  uri: vscode.Uri,
): Promise<TokenResponse> {
  const queryParams = new URLSearchParams(uri.query);
  const accessToken = queryParams.get('accessToken');
  const refreshToken = queryParams.get('refreshToken');
  const expiresIn = queryParams.get('expiresIn');
  if (!accessToken || !refreshToken || !expiresIn) {
    console.error(
      'Failed to get tokens from provider: ' + provider,
      queryParams.get('error'),
    );
    throw new Error('Failed to get tokens from provider: ' + provider);
  }
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  refreshTokenUri: string,
): Promise<TokenResponse> {
  if (!refreshToken) {
    throw new Error('No refresh token found. Cannot refresh access token.');
  }
  // Construct request body
  const requestBody = {
    refresh_token: refreshToken,
  };

  // Fetch tokens from Supabase edge function
  const tokensResponse = await fetch(refreshTokenUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  }).then((res) => res.json());
  const tokens = tokensResponse as TokenResponse;
  // Validate tokens response
  if (!tokens.access_token) {
    console.error('Failed to get access token', tokens);
    throw new Error('Failed to get access token');
  }
  return tokens;
}

export function hasTokenExpired(expiresIn: string | undefined): boolean {
  if (!expiresIn) {
    throw new Error('No expires_in found in secrets');
  }
  if (expiresIn) {
    const expiresAt = new Date().getTime() + parseInt(expiresIn) * 1000;
    if (expiresAt < new Date().getTime()) {
      return true;
    }
  }
  return false;
}
