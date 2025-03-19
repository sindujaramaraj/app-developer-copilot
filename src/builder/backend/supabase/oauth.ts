import * as vscode from "vscode";
import { SupabaseManagementAPI } from "supabase-management-js";
import ClientOAuth2 from "client-oauth2";

const SUPA_AUTH_ENDPOINT = "https://api.supabase.com/v1/oauth/authorize";
const SUPA_CONNECT_CLIENT_ID = "d4cf7681-0aaf-4d4e-aedc-e4834f48d370";
const SUPA_CONNECT_CLIENT_SECRET =
  "sba_2f0701330e885723fdd017b40c06b35255a1465f";
"vscode://sindujaramaraj.app-developer-copilot/supabase/oauth2/callback";
const SUPA_EDGE_FUNCTION_BASE_URL =
  "https://zrlkyaqpuvndlijmxedy.supabase.co/functions/v1/oauth-handler";
// Supabse OAuth2 doesn't support vscode redirection. So using this intermediate edge function to handle the redirection.
const SUPA_REDIRECT_URI = `${SUPA_EDGE_FUNCTION_BASE_URL}/supabase/callback`;
const SUPA_TOKEN_URI = "https://api.supabase.com/v1/oauth/token";

function getSupabaseOauthClient() {
  const supabaseAuth = new ClientOAuth2({
    clientId: SUPA_CONNECT_CLIENT_ID,
    clientSecret: SUPA_CONNECT_CLIENT_SECRET,
    accessTokenUri: SUPA_TOKEN_URI,
    authorizationUri: SUPA_AUTH_ENDPOINT,
    redirectUri: SUPA_REDIRECT_URI,
  });
  return supabaseAuth;
}

export async function isConnectedToSupabase(context: vscode.ExtensionContext) {
  const accessToken = await getSupabaseAccessToken(context);
  if (!accessToken) {
    return false;
  }
  return true;
}

export async function connectToSupabase(
  context: vscode.ExtensionContext,
) {
  try {
    // Construct URL for Supabase OAuth2
    const oauthClient = getSupabaseOauthClient();
    await vscode.env.openExternal(
      vscode.Uri.parse(oauthClient.code.getUri()),
    );
    console.log(
      "Opening browser to connect to Supabase...",
    );
    // Register URI handler to handle the callback from the browser
    return new Promise((resolve, reject) => {
      const disposable = vscode.window.registerUriHandler({
        handleUri: async (uri: vscode.Uri) => {
          if (uri.path === "/supabase/oauth2/callback") {
            try {
              await handleSupabaseOAuth2Callback(uri, context);
              resolve("Connected to Supabase");
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
    console.error("Failed to connect to Supabase:", error);
    throw error;
  }
}

// Handle Supabase OAuth2 callback after user logs in from the browser
export async function handleSupabaseOAuth2Callback(
  uri: vscode.Uri,
  context: vscode.ExtensionContext,
) {
  const queryParams = new URLSearchParams(uri.query);
  const code = queryParams.get("code");
  if (!code) {
    throw Error(
      "Failed to get code from Supabase OAuth2 callback. Cannot connect to Supabase.",
    );
  }

  // Exchange code for access token
  console.log("Exchanging code for access token...");
  await exchangeCodeForToken(context, code);

  console.log(
    "Successfully connected to Supabase! 🎉",
  );
}

async function fetchTokenFromSupabase(
  context: vscode.ExtensionContext,
  requestBody: URLSearchParams,
) {
  const tokensResponse = await fetch(SUPA_TOKEN_URI, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${
        btoa(`${SUPA_CONNECT_CLIENT_ID}:${SUPA_CONNECT_CLIENT_SECRET}`)
      }`,
    },
    body: requestBody,
  }).then((res) => res.json());
  const tokens = tokensResponse as any;
  // Validate tokens response
  if (!tokens.access_token) {
    throw new Error("Failed to get access token from Supabase");
  }

  // Store it in secrets
  console.debug("Storing Supabase tokens in secrets...");
  await storeSupabaseTokens(context, tokens);
}

async function exchangeCodeForToken(
  context: vscode.ExtensionContext,
  code: string,
): Promise<void> {
  // Construct request body
  const requestBody = new URLSearchParams();
  requestBody.append("grant_type", "authorization_code");
  requestBody.append("code", code);
  requestBody.append("redirect_uri", SUPA_REDIRECT_URI);

  await fetchTokenFromSupabase(context, requestBody);
}

async function refreshAccessToken(context: vscode.ExtensionContext) {
  const refreshToken = await getSupabaseRefreshToken(context);
  if (!refreshToken) {
    throw new Error("No refresh token found. Cannot refresh access token.");
  }
  // Construct request body
  const requestBody = new URLSearchParams();
  requestBody.append("grant_type", "refresh_token");
  requestBody.append("refresh_token", refreshToken);
  requestBody.append("redirect_uri", SUPA_REDIRECT_URI);

  await fetchTokenFromSupabase(context, requestBody);
}

export async function storeSupabaseTokens(
  context: vscode.ExtensionContext,
  tokenResponse: any,
) {
  await context.secrets.store(
    "supabase_access_token",
    tokenResponse.access_token,
  );
  await context.secrets.store(
    "supabase_refresh_token",
    tokenResponse.refresh_token,
  );
  await context.secrets.store(
    "supabase_expires_in",
    `${tokenResponse.expires_in}`, // convert to string
  );
}

export async function clearSupabaseTokens(context: vscode.ExtensionContext) {
  await context.secrets.delete("supabase_access_token");
  await context.secrets.delete("supabase_refresh_token");
  await context.secrets.delete("supabase_expires_in");
}

export async function getSupabaseAccessToken(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  return await context.secrets.get("supabase_access_token");
}

export async function getSupabaseRefreshToken(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  return await context.secrets.get("supabase_refresh_token");
}

export async function hasSupabaseTokenExpired(
  context: vscode.ExtensionContext,
) {
  const expiresIn = await context.secrets.get("supabase_expires_in");
  if (!expiresIn) {
    throw new Error("No expires_in found in secrets");
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
    throw new Error("No access token found. Try connecting to Supabase again.");
  }
  // Check if access token is expired
  const hasTokenExpired = await hasSupabaseTokenExpired(context);
  if (hasTokenExpired || forceRefresh) {
    console.log("Access token has expired. Refreshing...");
    await refreshAccessToken(context);
    const accessToken = await getSupabaseAccessToken(context);
    if (!accessToken) {
      throw new Error("Failed to get access token after refreshing");
    }
    return new SupabaseManagementAPI({ accessToken });
  }
  return new SupabaseManagementAPI({ accessToken });
}
