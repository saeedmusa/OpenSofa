import { Hono } from 'hono';
export interface AdminRoutesDeps {
    revokeToken: () => void;
}
export declare const createAdminRoutes: (deps: AdminRoutesDeps) => Hono;
//# sourceMappingURL=admin.d.ts.map