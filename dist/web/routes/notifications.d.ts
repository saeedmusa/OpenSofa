import { Hono } from 'hono';
import type { Notifier } from '../notifier.js';
export interface NotificationsRoutesDeps {
    notifier: Notifier;
}
export declare const createNotificationsRoutes: (deps: NotificationsRoutesDeps) => Hono;
//# sourceMappingURL=notifications.d.ts.map