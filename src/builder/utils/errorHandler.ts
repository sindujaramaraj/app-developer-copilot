import * as Sentry from 'sentry-expo';
import * as winston from 'winston';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  enableInExpoDevelopment: true,
  debug: true,
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
  ],
});

export function logError(message: string, error: any) {
  Sentry.Native.captureException(error);
  logger.error(message, { error });
}

export function logInfo(message: string) {
  logger.info(message);
}

export function logWarning(message: string) {
  logger.warn(message);
}

export function handleError(error: any, message: string) {
  logError(message, error);
  // Additional error handling logic can be added here
}
