import * as vscode from 'vscode';
import TelemetryReporter from '@vscode/extension-telemetry';
import {
  ITelemetryAppCreationEventMeasurements,
  ITelemetryAppCreationEventProperties,
  ITelemetryConnectionEventProperties,
  TelemetryEvent,
} from './types';
import { ENABLE_TELEMETRY } from '../../builder/constants';

const APP_INSIGHTS_TEST_KEY = '1c73a331-30ac-45bc-8288-7e318d3c391c';
const APP_INSIGHTS_TEST_CONNECTION_STRING =
  'InstrumentationKey=1c73a331-30ac-45bc-8288-7e318d3c391c;IngestionEndpoint=https://westus2-2.in.applicationinsights.azure.com/;LiveEndpoint=https://westus2.livediagnostics.monitor.azure.com/;ApplicationId=b2b9d257-a31d-4a96-81cb-8d9e93925142';

export class TelemetryService {
  private static instance: TelemetryService;
  private reporter: TelemetryReporter;

  private constructor(context: vscode.ExtensionContext) {
    this.reporter = new TelemetryReporter(APP_INSIGHTS_TEST_CONNECTION_STRING);

    if (!ENABLE_TELEMETRY) {
      // Disable telemetry
      this.reporter.sendTelemetryErrorEvent = () => {
        console.log('Telemetry is disabled');
      };
      this.reporter.sendTelemetryEvent = () => {
        console.log('Telemetry event log is disabled');
      };
    }

    // Register cleanup on extension deactivation
    context.subscriptions.push(this.reporter);
  }

  public static getInstance(
    context: vscode.ExtensionContext,
  ): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService(context);
    }
    return TelemetryService.instance;
  }

  /**
   * Track extension activation
   */
  public trackActivation(): void {
    this.reporter.sendTelemetryEvent(TelemetryEvent.Activation);
  }

  /**
   * Track command execution
   */
  public trackCommandPanelInteraction(
    command: string,
    properties?: Record<string, string>,
  ): void {
    this.reporter.sendTelemetryEvent(TelemetryEvent.Command, {
      command,
      ...properties,
    });
  }

  /**
   * Track mobile app creation
   */
  public trackAppCreation(
    properties: ITelemetryAppCreationEventProperties,
    measurements: ITelemetryAppCreationEventMeasurements,
  ): void {
    const { success, hasBackend, ...otherProps } = properties;
    if (success) {
      this.reporter.sendTelemetryEvent(
        TelemetryEvent.AppCreation,
        {
          ...otherProps,
          success: String(success),
          hasBackend: String(hasBackend),
        },
        {
          ...measurements,
        },
      );
    } else {
      // Send error event in case of failure
      this.trackError(
        TelemetryEvent.AppCreation,
        otherProps.appType,
        otherProps.source,
        undefined,
        { ...otherProps, hasBackend: String(hasBackend) },
        {
          ...measurements,
        },
      );
    }
  }

  /**
   * Track chat interactions
   */
  public trackChatInteraction(
    type: string,
    properties?: Record<string, string>,
  ): void {
    this.reporter.sendTelemetryEvent(TelemetryEvent.Chat, {
      type,
      ...properties,
    });
  }

  /**
   * Track errors
   */
  public trackError(
    event: string,
    appType: 'mobile' | 'web',
    source: string,
    error?: Error,
    properties?: Record<string, string>,
    measurements?: Record<string, number>,
  ): void {
    this.reporter.sendTelemetryErrorEvent(
      TelemetryEvent.Error,
      {
        ...properties,
        event,
        source,
        appType,
        errorName: error?.name,
        errorMessage: error?.message,
      },
      {
        ...measurements,
      },
    );
  }

  /**
   * Track performance metrics
   */
  public trackPerformance(
    operation: string,
    duration: number,
    properties?: Record<string, string>,
  ): void {
    this.reporter.sendTelemetryEvent(
      TelemetryEvent.Performance,
      {
        operation,
        ...properties,
      },
      {
        duration,
      },
    );
  }

  public trackConnection(
    properties: ITelemetryConnectionEventProperties,
  ): void {
    this.reporter.sendTelemetryEvent(TelemetryEvent.Connection, {
      ...properties,
      success: String(properties.success),
      retryCount: String(properties.retryCount),
    });
  }

  /**
   * Dispose the telemetry reporter
   */
  public dispose(): void {
    this.reporter.dispose();
  }
}
