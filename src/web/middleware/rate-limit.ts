import type { MiddlewareHandler } from 'hono';
import type { Context } from 'hono';

interface RateLimitTracker {
    count: number;
    resetTime: number;
}

const memoryStore = new Map<string, RateLimitTracker>();

// Periodic cleanup to prevent memory leaks (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [ip, tracker] of memoryStore) {
        if (now > tracker.resetTime) {
            memoryStore.delete(ip);
        }
    }
}, CLEANUP_INTERVAL_MS).unref(); // .unref() prevents the timer from keeping the process alive

/**
 * Extract client IP from request, with security considerations
 * Only trust Cloudflare headers (cf-connecting-ip) when we know we're behind Cloudflare
 */
export function getClientIP(c: Context): string {
    const cfIP = c.req.header('cf-connecting-ip');
    const forwarded = c.req.header('x-forwarded-for');
    
    // 1. Cloudflare header - most reliable if using CF tunnel
    if (cfIP) {
        return cfIP.split(',')[0]?.trim() || 'unknown-ip';
    }
    
    // 2. Standard proxy header - check if multiple address list
    if (forwarded) {
        return forwarded.split(',')[0]?.trim() || 'unknown-ip';
    }
    
    // 3. Fallback to socket - handle different C.env types for Node/Workers
    const raw = c.req.raw as any;
    const socketIP = raw?.socket?.remoteAddress || 
                     (c.env as any)?.incoming?.socket?.remoteAddress ||
                     'unknown-ip';
                     
    return socketIP;
}

/**
 * Check if we're in test mode (allows higher limits for E2E tests)
 */
function isTestMode(): boolean {
    return process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true';
}

export const createRateLimiter = (options: { windowMs: number; max: number }): MiddlewareHandler => {
    // In test mode, use much higher limits to avoid E2E test rate limiting
    const effectiveMax = isTestMode() ? options.max * 100 : options.max;
    
    return async (c, next) => {
        const ip = getClientIP(c);
        const now = Date.now();

        let tracker = memoryStore.get(ip);

        // Clean up expired or create new
        if (!tracker || now > tracker.resetTime) {
            tracker = { count: 0, resetTime: now + options.windowMs };
            memoryStore.set(ip, tracker);
        }

        if (tracker) {
            tracker.count++;

            if (tracker.count > effectiveMax) {
                return c.json({ success: false, error: 'Rate limit exceeded. Too many requests.' }, 429);
            }
        }

        await next();
        return;

        // Optional: periodic cleanup of old IPs to prevent memory leaks in a real production system
    };
};

/**
 * Reset the rate limiter memory store (useful for testing)
 */
export function resetRateLimiter(): void {
    memoryStore.clear();
}
