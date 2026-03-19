import { Hono } from 'hono';
import { success, error } from '../types.js';

export interface AdminRoutesDeps {
  revokeToken: () => void;
}

export const createAdminRoutes = (deps: AdminRoutesDeps): Hono => {
  const admin = new Hono();

  // POST /api/admin/revoke
  admin.post('/revoke', async (c) => {
    try {
      deps.revokeToken();
      return c.json(success({ message: 'Token revoked successfully. All active sessions terminated.' }));
    } catch (err) {
      return c.json(error('Failed to revoke token: ' + String(err)), 500);
    }
  });

  return admin;
};
