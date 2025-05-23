import * as vscode from 'vscode';
import { SupabaseManagementAPI } from 'supabase-management-js';

import {
  connectToSupabase,
  getSupabaseClient,
  isConnectedToSupabase,
} from './oauth';

export class SupabaseService {
  private static instance: SupabaseService;

  private context: vscode.ExtensionContext;
  private client: SupabaseManagementAPI;

  private constructor(
    context: vscode.ExtensionContext,
    client: SupabaseManagementAPI,
  ) {
    this.context = context;
    this.client = client;
  }

  public static async getInstance(
    context: vscode.ExtensionContext,
  ): Promise<SupabaseService | undefined> {
    if (!SupabaseService.instance) {
      const isConnected = await isConnectedToSupabase(context);
      if (!isConnected) {
        console.log('Not connected to Supabase. Will try connecting first.');
        const choice = await vscode.window.showInformationMessage(
          'You need to log in to Supabase to use this feature.',
          { modal: true },
          'Log in to Supabase',
        );
        if (choice === 'Log in to Supabase') {
          await connectToSupabase(context);
        } else {
          // User cancelled login
          console.log('User cancelled login to Supabase');
          return undefined;
        }
      }
      const client = await getSupabaseClient(context, true);
      if (!client) {
        throw new Error('Failed to get Supabase client');
      }
      SupabaseService.instance = new SupabaseService(context, client);
    }
    return SupabaseService.instance;
  }

  public getClient(): SupabaseManagementAPI {
    return this.client;
  }

  public async getOrgs() {
    return await this.client.getOrganizations();
  }

  public async getProjects() {
    return await this.client.getProjects();
  }

  public async isConnected(): Promise<boolean> {
    // Using getOrganizations as a test to see if the client is connected
    try {
      await this.client.getOrganizations();
      return true;
    } catch (error) {
      console.warn('Failed to connect to Supabase', error);
      return false;
    }
  }

  public async createProject(name: string, dbPassword: string, orgId: string) {
    return await this.client.createProject({
      name,
      db_pass: dbPassword,
      organization_id: orgId,
      region: 'us-west-1',
      plan: 'free',
    });
  }

  public async runQuery(projectId: string, query: string) {
    return await this.client.runQuery(projectId, query);
  }

  public async generateTypesForProject(projectId: string) {
    return await this.client.getTypescriptTypes(projectId);
  }

  public async disableAuth(projectId: string) {
    const ogClient = this.client.client;
    const { data, response } = await ogClient.patch(
      '/v1/projects/{ref}/config/auth',
      {
        params: {
          path: {
            ref: projectId,
          },
        },
        body: {
          disable_signup: true,
        } as any,
      },
    );
    if (response.status !== 200) {
      console.error('Error updating project auth config', response);
      throw Error('Error updating project auth config');
    }
    return data;
  }

  public async getProjectAnonKey(projectId: string) {
    const apiKeys = await this.client.getProjectApiKeys(projectId);
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error('No API keys found for project');
    }
    const apiKey = apiKeys[0];
    return apiKey['api_key'];
  }

  public getProjectUrl(projectId: string) {
    return `https://${projectId}.supabase.co`;
  }

  public async getProjectAuthConfig(projectId: string): Promise<{
    disable_signup: boolean;
    external_email_enabled: boolean;
    external_google_enabled: boolean;
  }> {
    const authConfig = (await this.client.getProjectAuthConfig(
      projectId,
    )) as any;
    // TODO:For now, we are only interested in these three fields
    // but we can add more in the future if needed
    return {
      disable_signup: authConfig?.disable_signup,
      external_email_enabled: authConfig?.external_email_enabled,
      external_google_enabled: authConfig?.external_google_enabled,
    };
  }
}
