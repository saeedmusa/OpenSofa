import type { MiddlewareHandler } from 'hono';
import type { Context } from 'hono';
/**
 * Extract client IP from request, with security considerations
 * Only trust Cloudflare headers (cf-connecting-ip) when we know we're behind Cloudflare
 */
export declare function getClientIP(c: Context): string;
export declare const createRateLimiter: (options: {
    windowMs: number;
    max: number;
}) => MiddlewareHandler;
//# sourceMappingURL=rate-limit.d.ts.map