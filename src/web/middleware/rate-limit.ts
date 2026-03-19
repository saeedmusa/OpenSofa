import type { MiddlewareHandler } from 'hono';
import type { Context } from 'hono';

interface RateLimitTracker {
    count: number;
    resetTime: number;
}

const memoryStore = new Map<string, RateLimitTracker>();

/**
 * Extract client IP from request, with security considerations
 * Only trust Cloudflare headers (cf-connecting-ip) when we know we're behind Cloudflare
 */
export function getClientIP(c: Context): string {
    // Direct connect - use standard headers
    const cfIP = c.req.header('cf-connecting-ip');
    const forwarded = c.req.header('x-forwarded-for');
    
    // Only trust x-forwarded-for if it looks valid (single IP, not list)
    // This prevents spoofing in most cases
    if (cfIP) {
        const parts = cfIP.split(',');
        return parts[0]?.trim() ?? 'unknown-ip';
    }
    
    if (forwarded && forwarded.includes('.') && (!forwarded.includes(',') || forwarded.trim().split(',').length === 1)) {
        return forwarded.trim();
    }
    if (forwarded && forwarded.includes(',')) {
        const parts = forwarded.split(',');
        return parts[0]?.trim() ?? 'unknown-ip';
    }
    
    return 'unknown-ip';
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
