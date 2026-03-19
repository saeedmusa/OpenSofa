/**
 * OpenSofa Web - Auth Middleware
 *
 * Hono middleware for token-based authentication.
 */
import type { Context, Next } from 'hono';
export interface AuthMiddlewareDeps {
    expectedToken: string;
}
export declare const createAuthMiddleware: (deps: AuthMiddlewareDeps) => (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<any, 403, "json">) | (Response & import("hono").TypedResponse<any, 401, "json">)>;
/**
 * Validate token from WebSocket connection and apply IP banning
 * Returns true if valid, false otherwise. Records a strike if invalid.
 */
export declare const validateWebSocketAuth: (url: string, ip: string, expectedToken: string) => boolean;
//# sourceMappingURL=auth.d.ts.map