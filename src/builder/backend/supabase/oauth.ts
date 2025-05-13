import * as vscode from 'vscode';
import { SupabaseManagementAPI } from 'supabase-management-js';
import { OAUTH_EDGE_FUNCTION_BASE_URL } from '../../constants';
import * as OAuthHelper from '../../utils/oauthHelper';

const SUPA_LOGIN_URI = `${OAUTH_EDGE_FUNCTION_BASE_URL}/supabase/login`;
const SUPA_REFRESH_TOKEN_URI = `${OAUTH_EDGE_FUNCTION_BASE_URL}/supabase/refresh-token`;

export async function isConnectedToSupabase(context: vscode.ExtensionContext) {
  const accessToken = await getSupabaseAccessToken(context);
  if (!accessToken) {
    return false;
  }
  return true;
}

export async function connectToSupabase(context: vscode.ExtensionContext) {
  try {
    const tokenResponse = await OAuthHelper.connectToOAuthProvider({
      provider: 'supabase',
      loginUri: SUPA_LOGIN_URI,
    });

    if (!tokenResponse) {
      throw new Error('Failed to connect to Supabase');
    }

    // Store tokens in secrets
    await storeSupabaseTokens(context, tokenResponse);

    console.log('Successfully connected to Supabase! 🎉');
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    throw error;
  }
}

async function refreshAccessToken(context: vscode.ExtensionContext) {
  const refreshToken = await getSupabaseRefreshToken(context);
  if (!refreshToken) {
    throw new Error('No refresh token found. Cannot refresh access token.');
  }
  console.log('Refreshing Supabase access token...');
  const tokenResponse = await OAuthHelper.refreshAccessToken(
    refreshToken,
    SUPA_REFRESH_TOKEN_URI,
  );

  // Store it in secrets
  console.debug('Storing Supabase tokens in secrets...');
  await storeSupabaseTokens(context, tokenResponse);
}

async function storeSupabaseTokens(
  context: vscode.ExtensionContext,
  tokenResponse: OAuthHelper.TokenResponse,
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

async function getSupabaseAccessToken(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  return await context.secrets.get('supabase_access_token');
}

async function getSupabaseRefreshToken(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  return await context.secrets.get('supabase_refresh_token');
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
  const expiresIn = await context.secrets.get('supabase_expires_in');
  const hasTokenExpired = OAuthHelper.hasTokenExpired(expiresIn);
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
