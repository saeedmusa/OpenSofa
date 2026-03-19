import { Hono } from 'hono';
import { success, error } from '../types.js';
import { createLogger } from '../../utils/logger.js';
const log = createLogger('web:routes:push');
export const createPushRoutes = (deps) => {
    const app = new Hono();
    const { pushManager } = deps;
    // GET /api/push/public-key - Get VAPID public key
    app.get('/public-key', (c) => {
        const key = pushManager.getPublicKey();
        if (!key) {
            return c.json(error('VAPID keys not initialized', 'NOT_INITIALIZED'), 500);
        }
        return c.json(success({ publicKey: key }));
    });
    // POST /api/push/subscribe - Save a push subscription
    app.post('/subscribe', async (c) => {
        try {
            const subscription = await c.req.json();
            if (!subscription || !subscription.endpoint || !subscription.keys) {
                return c.json(error('Invalid subscription object', 'INVALID_BODY'), 400);
            }
            pushManager.saveSubscription(subscription);
            log.info('Received and saved new push subscription');
            return c.json(success({ ok: true }));
        }
        catch (err) {
            log.error('Failed to parse push subscription', { error: String(err) });
            return c.json(error('Invalid JSON body', 'INVALID_BODY'), 400);
        }
    });
    // POST /api/push/test - Test push notification (mostly for debugging)
    app.post('/test', async (c) => {
        try {
            await pushManager.broadcastNotification({
                title: "Test Notification",
                body: "Web push is working correctly!",
                url: "/"
            });
            return c.json(success({ ok: true }));
        }
        catch (err) {
            return c.json(error('Failed to send test notification', 'TEST_FAILED'), 500);
        }
    });
    return app;
};
//# sourceMappingURL=push.js.map