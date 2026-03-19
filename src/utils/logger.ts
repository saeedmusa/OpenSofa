/**
 * OpenSofa - Structured Logging Utility
 * 
 * Uses pino for fast, structured JSON logging.
 * In development, uses pino-pretty for readable output.
 * Uses a single root pino instance with child loggers per module.
 */

import pino from 'pino';

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  child(bindings: { module?: string; session?: string }): Logger;
}

const isDev = process.env['NODE_ENV'] !== 'production';

// Single root pino instance — all modules share this
const rootPino = pino({
  level: process.env['LOG_LEVEL'] || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

/**
 * Wrap a pino instance into our Logger interface
 */
function wrapPino(pinoInstance: pino.Logger): Logger {
  return {
    info: (message: string, data?: Record<string, unknown>) => {
      if (data) pinoInstance.info(data, message);
      else pinoInstance.info(message);
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      if (data) pinoInstance.warn(data, message);
      else pinoInstance.warn(message);
    },
    error: (message: string, data?: Record<string, unknown>) => {
      if (data) pinoInstance.error(data, message);
      else pinoInstance.error(message);
    },
    debug: (message: string, data?: Record<string, unknown>) => {
      if (data) pinoInstance.debug(data, message);
      else pinoInstance.debug(message);
    },
    child: (bindings: { module?: string; session?: string }) => {
      return wrapPino(pinoInstance.child(bindings));
    },
  };
}

/**
 * Create a logger instance using pino child loggers (shared transport)
 * @param module - Optional module name for log context
 * @param session - Optional session name for log context
 */
export function createLogger(module?: string, session?: string): Logger {
  const bindings: Record<string, string> = {};
  if (module) bindings.module = module;
  if (session) bindings.session = session;

  return wrapPino(rootPino.child(bindings));
}

// Default logger instance
export const logger = createLogger('main');