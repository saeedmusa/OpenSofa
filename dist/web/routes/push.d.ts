import { Hono } from 'hono';
import type { PushManager } from '../push.js';
export interface PushRoutesDeps {
    pushManager: PushManager;
}
export declare const createPushRoutes: (deps: PushRoutesDeps) => Hono;
//# sourceMappingURL=push.d.ts.map