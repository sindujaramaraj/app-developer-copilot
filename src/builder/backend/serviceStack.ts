import { ENABLE_AUTHENTICATION } from '../constants';
import { IBackendDetails, IGenericStack } from '../types';

export interface IBackendConfig {
  backend: Backend;
  useExisting: boolean; // Flag to indicate using existing project (e.g., for Supabase/Firebase)
  authentication: AuthenticationMethod;
  details?: IBackendDetails; // Optional existing backend config
  // Add other backend-specific config here if needed in the future
}

export enum Backend {
  SUPABASE = 'supabase',
  FIREBASE = 'firebase', // Added Firebase
  API = 'api', // Added API
  None = 'none',
}

export interface AuthenticationOptions {
  authMethod: AuthenticationMethod[];
  allowAnonymous: boolean;
}

export enum AuthenticationMethod {
  None = 'none',
  EMAIL = 'email',
  // GOOGLE = 'google'
}

export interface AnalyticsOptions {
  enabled: boolean;
  provider: AnalyticsProvider;
}

export enum AnalyticsProvider {
  AMPLITUDE = 'amplitude',
  MIXPANEL = 'mixpanel',
  GOOGLE_ANALYTICS = 'google-analytics',
}

export function getPromptForAuthenticationMethod(
  techStack: IGenericStack,
): string {
  if (!ENABLE_AUTHENTICATION) {
    return 'Do not add any authentication.';
  }
  const { backendConfig } = techStack;

  if (backendConfig.useExisting) {
    return 'Based on the existing backend, add authentication. Do not add any new authentication.';
  }

  const backend = backendConfig.backend;
  const authMethod = backendConfig.authentication;
  switch (authMethod) {
    case AuthenticationMethod.EMAIL:
      if (backend === Backend.SUPABASE) {
        return 'User must be able to sign up and sign in to the app with email and password. Do not use google auth. Make sure the database design and UI auth flow supports this.';
      }
      return 'Do not add any authentication.';
    case AuthenticationMethod.None:
      return 'Do not add any authentication.';
  }
}

export function getPromptForBackend(backendConfig: IBackendConfig): string {
  const backend = backendConfig.backend;
  const useExisting = backendConfig.useExisting;

  if (backend !== Backend.SUPABASE) {
    return 'Do not add any backend.';
  }
  if (useExisting) {
    return 'Use the existing Supabase project.';
  }
  return 'Use Supabase for backend.';
}
