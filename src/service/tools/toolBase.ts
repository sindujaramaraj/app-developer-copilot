class ToolBase {
  protected name: string;
  protected description: string;
  constructor() {
    this.name = 'ToolBase';
    this.description = 'Base class for all tools';
  }
  getCopilotToolConfig() {}
  getVercelToolConfig() {}
}
