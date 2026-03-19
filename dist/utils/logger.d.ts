/**
 * OpenSofa - Structured Logging Utility
 *
 * Uses pino for fast, structured JSON logging.
 * In development, uses pino-pretty for readable output.
 * Uses a single root pino instance with child loggers per module.
 */
export interface Logger {
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
    debug(message: string, data?: Record<string, unknown>): void;
    child(bindings: {
        module?: string;
        session?: string;
    }): Logger;
}
/**
 * Create a logger instance using pino child loggers (shared transport)
 * @param module - Optional module name for log context
 * @param session - Optional session name for log context
 */
export declare function createLogger(module?: string, session?: string): Logger;
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map