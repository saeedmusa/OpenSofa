import { Hono } from 'hono';
import { success, error } from '../types.js';
export const createAdminRoutes = (deps) => {
    const admin = new Hono();
    // POST /api/admin/revoke
    admin.post('/revoke', async (c) => {
        try {
            deps.revokeToken();
            return c.json(success({ message: 'Token revoked successfully. All active sessions terminated.' }));
        }
        catch (err) {
            return c.json(error('Failed to revoke token: ' + String(err)), 500);
        }
    });
    return admin;
};
//# sourceMappingURL=admin.js.map