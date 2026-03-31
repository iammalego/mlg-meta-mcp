/**
 * Logger utility using pino
 *
 * Pino is a fast JSON logger. In production, logs are structured.
 * In development, we use pretty printing for readability.
 */

import pino from 'pino';

const shouldUsePrettyTransport = process.env.PINO_PRETTY === 'true';

export function getLogger() {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: shouldUsePrettyTransport
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
          },
        }
      : undefined,
    redact: {
      paths: ['access_token', '*.access_token', 'token', '*.token'],
      remove: true,
    },
  });
}
