/**
 * OpenSofa Web - Upload Routes
 *
 * Multipart image upload handler for attaching photos/screenshots
 * to agent context (US-19, Architecture §1.3).
 */
import { Hono } from 'hono';
import type { SessionManager } from '../../session-manager.js';
export interface UploadRoutesDeps {
    sessionManager: SessionManager;
}
export declare const createUploadRoutes: (deps: UploadRoutesDeps) => Hono;
//# sourceMappingURL=upload.d.ts.map