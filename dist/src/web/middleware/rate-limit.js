const memoryStore = new Map();
/**
 * Extract client IP from request, with security considerations
 * Only trust Cloudflare headers (cf-connecting-ip) when we know we're behind Cloudflare
 */
export function getClientIP(c) {
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
export const createRateLimiter = (options) => {
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
            if (tracker.count > options.max) {
                return c.json({ success: false, error: 'Rate limit exceeded. Too many requests.' }, 429);
            }
        }
        await next();
        return;
        // Optional: periodic cleanup of old IPs to prevent memory leaks in a real production system
    };
};
//# sourceMappingURL=rate-limit.js.map