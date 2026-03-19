/**
 * OpenSofa Web - Auth Middleware
 *
 * Hono middleware for token-based authentication.
 */
import { parseAuthHeader, validateToken } from '../auth.js';
import { error } from '../types.js';
import { getClientIP } from './rate-limit.js';
import { isIpBanned, recordIpStrike } from '../ip-ban.js';
export const createAuthMiddleware = (deps) => {
    return async (c, next) => {
        const ip = getClientIP(c);
        if (isIpBanned(ip)) {
            return c.json(error('IP address banned due to too many failed attempts.', 'FORBIDDEN'), 403);
        }
        // Check Authorization header first
        const authHeader = c.req.header('Authorization');
        const headerToken = parseAuthHeader(authHeader);
        // Fall back to query parameter
        const queryToken = c.req.query('token');
        const providedToken = headerToken ?? queryToken;
        if (!providedToken) {
            return c.json(error('Authentication required', 'UNAUTHORIZED'), 401);
        }
        if (!validateToken(providedToken, deps.expectedToken)) {
            recordIpStrike(ip);
            return c.json(error('Invalid authentication token', 'FORBIDDEN'), 403);
        }
        return await next();
    };
};
// ──────────────────────────────────────
// WebSocket Auth Helper
// ──────────────────────────────────────
/**
 * Validate token from WebSocket connection and apply IP banning
 * Returns true if valid, false otherwise. Records a strike if invalid.
 */
export const validateWebSocketAuth = (url, ip, expectedToken) => {
    if (isIpBanned(ip)) {
        return false;
    }
    try {
        const parsedUrl = new URL(url, 'http://localhost');
        const token = parsedUrl.searchParams.get('token');
        if (!token)
            return false;
        const isValid = validateToken(token, expectedToken);
        if (!isValid) {
            recordIpStrike(ip);
        }
        return isValid;
    }
    catch {
        recordIpStrike(ip);
        return false;
    }
};
//# sourceMappingURL=auth.js.map