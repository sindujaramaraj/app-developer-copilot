export const APP_NAME = 'appdeveloper';
export const APP_DISPLAY_NAME = 'App Developer Copilot';
export const APP_VERSION = '2.0.8';
export const APP_CONFIG_FILE = 'appdev.json';
export const APP_CONVERSATION_FILE = 'conversation.json';
export const APP_ARCHITECTURE_DIAGRAM_FILE = 'architecture.md';
export const APP_STACK_DIAGRAM_FILE = 'stack.md';
export const SUPA_SQL_FILE_PATH = 'supabase/migrations/init.sql';
export const SUPA_TYPES_WEB_FILE_PATH = 'src/supabase/database.types.ts';
export const SUPA_TYPES_MOBILE_FILE_PATH = 'supabase/database.types.ts';
export const CLASS_DIAGRAM_FILE = 'classDiagram.md';
export const PROJECT_TREE_DIAGRAM_FILE = 'projectTreeDiagram.md';
export const MAX_RETRY_COUNT = 1;

export const TOOL_IMAGE_ANALYZER = 'app_developer_imageAnalyzer';
export const TOOL_PEXEL_IMAGE_SEARCH = 'app_developer_pexelImageSearch';
// Add more tools here as needed

export const ISSUE_REPORT_URL =
  'https://github.com/sindujaramaraj/app-developer-copilot/issues';

// Edge function URLs
export const isLocal = false; // Change this to false when deploying to production

// Supabse OAuth2 doesn't support vscode redirection. So using this intermediate edge function to handle the redirection.
export const OAUTH_EDGE_FUNCTION_BASE_URL = isLocal
  ? 'http://localhost:54321/functions/v1/oauth-handler'
  : 'https://zrlkyaqpuvndlijmxedy.supabase.co/functions/v1/oauth-handler';

export const VSCODE_CALLBACK_URI = `vscode://${APP_NAME}.app-developer-copilot/oauth2/callback`;

export const AI_EDGE_FUNCTION_BASE_URL = isLocal
  ? 'http://localhost:54321/functions/v1/ai'
  : 'https://zrlkyaqpuvndlijmxedy.supabase.co/functions/v1/ai';

export const CRED_HANDLER_EDGE_FUNCTION_BASE_URL = isLocal
  ? 'http://localhost:54321/functions/v1/cred-handler'
  : 'https://zrlkyaqpuvndlijmxedy.supabase.co/functions/v1/cred-handler';

export const ENABLE_TELEMETRY = isLocal ? false : true; // Config to enable or disable telemetry collection
export const ENABLE_WEB_APP = true; // Config to enable or disable web app creation
export const ENABLE_WEB_STACK_CONFIG = true; // Config to enable or disable web stack configuration
export const ENABLE_BACKEND = true; // Config to enable or disable backend creation
export const ENABLE_AUTHENTICATION = true; // Config to enable or disable authentication
export const ENABLE_DESIGN = true; // Config to enable or disable design
