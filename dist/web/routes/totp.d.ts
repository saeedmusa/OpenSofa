/**
 * OpenSofa Web - TOTP Routes
 *
 * Endpoints for TOTP (Time-based One-Time Password) setup and verification.
 * Used for step-up authentication before destructive commands (US-13).
 *
 * Architecture Ref: §1.3, USER_STORIES.md US-13
 */
import { Hono } from 'hono';
export declare const createTOTPRoutes: () => Hono;
//# sourceMappingURL=totp.d.ts.map