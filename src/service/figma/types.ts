// filepath: /Users/sindujaramaraj/Development/code/app-developer-copilot/src/service/figma/types.ts
export interface FigmaTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Duration in seconds
  createdAt: number; // Timestamp when tokens were created/refreshed
}

export interface FigmaError {
  error: string;
  error_description?: string;
}

export interface FigmaFileResponse {
  document: FigmaNode;
  components: { [key: string]: FigmaComponent };
  schemaVersion: number;
  styles: { [key: string]: FigmaStyle };
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  role: string;
  editorType: string;
  linkAccess: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  // Add other node properties as needed based on Figma API documentation
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  // Add other component properties
}

export interface FigmaStyle {
  key: string;
  name: string;
  styleType: string;
  // Add other style properties
}

export interface IFigmaImageResponse {
  err: string | null;
  images: { [nodeId: string]: string | null };
  status?: number;
}
