import { render, screen } from '@testing-library/react-native';
import { act } from 'react-test-renderer';
import { App } from '../app';
import { MobileApp } from '../mobile/mobileApp';
import { IInitializeAppResponse, IResponseBase } from '../types';
import { initializeDatabase, initializeAuth } from './appconfigHelper';
import { logError } from './errorHandler';
import { setupPushNotifications } from './notificationHelper';

export async function renderApp(app: App) {
  await act(async () => {
    render(app);
  });
}

export async function initializeTestApp(
  app: MobileApp,
  userMessage: string,
): Promise<IInitializeAppResponse> {
  try {
    const response = await app.initialize(userMessage);
    return response.output;
  } catch (error) {
    logError('Error initializing test app:', error);
    throw error;
  }
}

export async function setupTestEnvironment() {
  try {
    await initializeDatabase();
    await initializeAuth();
    await setupPushNotifications();
  } catch (error) {
    logError('Error setting up test environment:', error);
    throw error;
  }
}

export function getTestElementByText(text: string) {
  return screen.getByText(text);
}

export function getTestElementByTestId(testId: string) {
  return screen.getByTestId(testId);
}
