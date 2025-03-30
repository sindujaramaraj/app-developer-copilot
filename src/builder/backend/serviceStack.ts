import { ENABLE_AUTHENTICATION } from '../constants';
import { IGenericStack } from '../types';

export enum Backend {
  SUPABASE = 'supabase',
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

  const backend = techStack.backend;
  const authMethod = techStack.authentication;
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
