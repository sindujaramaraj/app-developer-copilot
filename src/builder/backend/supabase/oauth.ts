import * as vscode from 'vscode';
import { SupabaseManagementAPI } from 'supabase-management-js';

const isLocal = true; // Change this to false when deploying to production

// Supabse OAuth2 doesn't support vscode redirection. So using this intermediate edge function to handle the redirection.
const SUPA_EDGE_FUNCTION_BASE_URL = isLocal
  ? 'http://localhost:54321/functions/v1/oauth-handler'
  : 'https://zrlkyaqpuvndlijmxedy.supabase.co/functions/v1/oauth-handler';
const SUPA_LOGIN_URI = `${SUPA_EDGE_FUNCTION_BASE_URL}/supabase/login`;
const SUPA_REFRESH_TOKEN_URI = `${SUPA_EDGE_FUNCTION_BASE_URL}/supabase/refresh-token`;

const SUPABASE_CONNECTION_WAIT_TIME = 300 * 1000; // 5 mins

export async function isConnectedToSupabase(context: vscode.ExtensionContext) {
  const accessToken = await getSupabaseAccessToken(context);
  if (!accessToken) {
    return false;
  }
  return true;
}

export async function connectToSupabase(context: vscode.ExtensionContext) {
  context.extensionMode;
  try {
    // Open browser to login to Supabase through intermediate edge function
    const open = await vscode.env.openExternal(
      vscode.Uri.parse(SUPA_LOGIN_URI),
    );
    if (!open) {
      throw new Error('Failed to open browser to connect to Supabase');
    }
    console.log('Opening browser to connect to Supabase...');
    // Register URI handler to handle the callback from the browser
    return new Promise((resolve, reject) => {
      const disposable = vscode.window.registerUriHandler({
        handleUri: async (uri: vscode.Uri) => {
          if (uri.path === '/supabase/oauth2/callback') {
            try {
              await handleSupabaseOAuth2Callback(uri, context);
              resolve('Connected to Supabase');
            } catch (error) {
              reject(error);
            } finally {
              disposable.dispose();
            }
          }
        },
      });
      // setTimeout(async () => {
      //   // Check if the connection is successful
      //   const isConnected = await isConnectedToSupabase(context);
      //   if (!isConnected) {
      //     reject('Connection to Supabase timed out');
      //     disposable.dispose();
      //   }
      // }, SUPABASE_CONNECTION_WAIT_TIME);
    });
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    throw error;
  }
}

// Handle Supabase OAuth2 callback after user logs in from the browser or refreshes the token
export async function handleSupabaseOAuth2Callback(
  uri: vscode.Uri,
  context: vscode.ExtensionContext,
) {
  const queryParams = new URLSearchParams(uri.query);
  const accessToken = queryParams.get('accessToken');
  const refreshToken = queryParams.get('refreshToken');
  const expiresIn = queryParams.get('expiresIn');
  if (!accessToken || !refreshToken || !expiresIn) {
    console.error(
      'Failed to get tokens from Supabase',
      queryParams.get('error'),
    );
    throw new Error('Failed to get tokens from Supabase');
  }
  // Store tokens in secrets
  await storeSupabaseTokens(context, {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
  });

  console.log('Successfully connected to Supabase! 🎉');
}

async function refreshAccessToken(context: vscode.ExtensionContext) {
  const refreshToken = await getSupabaseRefreshToken(context);
  if (!refreshToken) {
    throw new Error('No refresh token found. Cannot refresh access token.');
  }
  // Construct request body
  const requestBody = {
    refresh_token: refreshToken,
  };

  // Fetch tokens from Supabase edge function
  const tokensResponse = await fetch(SUPA_REFRESH_TOKEN_URI, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  }).then((res) => res.json());
  const tokens = tokensResponse as any;
  // Validate tokens response
  if (!tokens.access_token) {
    console.error('Failed to get access token from Supabase', tokens);
    throw new Error('Failed to get access token from Supabase');
  }
  // Store it in secrets
  console.debug('Storing Supabase tokens in secrets...');
  await storeSupabaseTokens(context, tokens);
}

export async function storeSupabaseTokens(
  context: vscode.ExtensionContext,
  tokenResponse: any,
) {
  await context.secrets.store(
    'supabase_access_token',
    tokenResponse.access_token,
  );
  await context.secrets.store(
    'supabase_refresh_token',
    tokenResponse.refresh_token,
  );
  await context.secrets.store(
    'supabase_expires_in',
    `${tokenResponse.expires_in}`, // convert to string
  );
}

export async function clearSupabaseTokens(context: vscode.ExtensionContext) {
  await context.secrets.delete('supabase_access_token');
  await context.secrets.delete('supabase_refresh_token');
  await context.secrets.delete('supabase_expires_in');
}

export async function getSupabaseAccessToken(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  return await context.secrets.get('supabase_access_token');
}

export async function getSupabaseRefreshToken(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  return await context.secrets.get('supabase_refresh_token');
}

export async function hasSupabaseTokenExpired(
  context: vscode.ExtensionContext,
) {
  const expiresIn = await context.secrets.get('supabase_expires_in');
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

export async function getSupabaseClient(
  context: vscode.ExtensionContext,
  forceRefresh = false,
): Promise<SupabaseManagementAPI | undefined> {
  const accessToken = await getSupabaseAccessToken(context);
  if (!accessToken) {
    throw new Error('No access token found. Try connecting to Supabase again.');
  }
  // Check if access token is expired
  const hasTokenExpired = await hasSupabaseTokenExpired(context);
  if (hasTokenExpired || forceRefresh) {
    console.log('Access token has expired. Refreshing...');
    await refreshAccessToken(context);
    const accessToken = await getSupabaseAccessToken(context);
    if (!accessToken) {
      throw new Error('Failed to get access token after refreshing');
    }
    return new SupabaseManagementAPI({ accessToken });
  }
  return new SupabaseManagementAPI({ accessToken });
}
