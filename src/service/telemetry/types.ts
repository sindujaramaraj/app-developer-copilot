import { LLMProvider } from '../types';

export enum TelemetryEvent {
  Activation = 'activation',
  Command = 'command',
  Chat = 'chat',
  Error = 'error',
  AppCreation = 'appCreation',
  Performance = 'performance',
  Connection = 'connection',
}

export enum ConnectionTarget {
  Supabase = 'supabase',
  Firebase = 'firebase',
  AWS = 'aws',
  Google = 'google',
  Github = 'github',
  Figma = 'figma',
}

export enum ErrorType {
  AppCreationError = 'app_creation_error',
  VsCodeError = 'vscode_error',
}

export enum ErrorReason {
  ModelError = 'model_error',
  ExecutionError = 'execution_error',
}

export interface ITelemetryEventCommonProperties {
  model: string;
  modelProvider: LLMProvider;
}

export interface ITelemetryChatEventProperties
  extends ITelemetryEventCommonProperties {
  chatCommand: string;
  chatInput: string;
}

export interface ITelemetryCommandEventProperties
  extends ITelemetryEventCommonProperties {
  commandName: string;
  commandInput: string;
}

export interface ITelemetryAppCreationEventProperties
  extends ITelemetryEventCommonProperties {
  input: string;
  source: 'chat' | 'command';
  appType: 'mobile' | 'web';
  success: boolean;
  techStack: string;
  hasBackend: boolean;
  hasDesign: boolean;
  error?: string;
  errorMessage?: string;
  errorReason?: string;
}

export interface ITelemetryAppCreationEventMeasurements {
  duration: number;
  totalFilesCount: number;
  createdFilesCount: number;
}

export interface ITelemetryErrorEventProperties
  extends ITelemetryEventCommonProperties {
  errorType: ErrorType;
  errorReason: ErrorReason;
  errorMessage: string;
}

export interface ITelemetryConnectionEventProperties {
  target: ConnectionTarget;
  success: boolean;
  retryCount: number;
  error?: string;
}
