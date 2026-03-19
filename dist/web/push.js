import webpush from 'web-push';
import { db } from '../db.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('push');
export class PushManager {
    config;
    publicKey = '';
    privateKey = '';
    constructor(config) {
        this.config = config;
    }
    /**
     * Initialize VAPID keys. Generates and saves to DB if they don't exist.
     */
    async init() {
        try {
            const stmt = db.prepare('SELECT publicKey, privateKey FROM vapid_keys WHERE id = 1');
            const row = stmt.get();
            if (row && row.publicKey && row.privateKey) {
                this.publicKey = row.publicKey;
                this.privateKey = row.privateKey;
                log.info('Loaded VAPID keys from database');
            }
            else {
                const vapidKeys = webpush.generateVAPIDKeys();
                this.publicKey = vapidKeys.publicKey;
                this.privateKey = vapidKeys.privateKey;
                const insertStmt = db.prepare('INSERT OR REPLACE INTO vapid_keys (id, publicKey, privateKey) VALUES (1, ?, ?)');
                insertStmt.run(this.publicKey, this.privateKey);
                log.info('Generated and saved new VAPID keys');
            }
            // Configure web-push
            webpush.setVapidDetails('mailto:admin@opensofa.local', // Required by VAPID spec
            this.publicKey, this.privateKey);
        }
        catch (err) {
            log.error('Failed to initialize push manager', { error: String(err) });
        }
    }
    getPublicKey() {
        return this.publicKey;
    }
    /**
     * Save a push subscription from a client
     */
    saveSubscription(subscription) {
        if (!subscription.endpoint || !subscription.keys)
            return;
        try {
            const stmt = db.prepare('INSERT OR REPLACE INTO push_subscriptions (endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?)');
            stmt.run(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
            log.info('Saved push subscription', { endpoint: subscription.endpoint.substring(0, 30) + '...' });
        }
        catch (err) {
            log.error('Failed to save push subscription', { error: String(err) });
        }
    }
    /**
     * Delete a stale or invalid push subscription
     */
    deleteSubscription(endpoint) {
        try {
            const stmt = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
            stmt.run(endpoint);
            log.debug('Deleted push subscription', { endpoint: endpoint.substring(0, 30) + '...' });
        }
        catch (err) {
            log.error('Failed to delete push subscription', { error: String(err) });
        }
    }
    /**
     * Send a notification to all subscribed clients
     */
    async broadcastNotification(payload) {
        try {
            const stmt = db.prepare('SELECT * FROM push_subscriptions');
            const rows = stmt.all();
            if (rows.length === 0) {
                log.debug('No active push subscriptions');
                return;
            }
            const strPayload = JSON.stringify(payload);
            log.info(`Sending push notification to ${rows.length} subscribers`);
            const promises = rows.map(async (row) => {
                const sub = {
                    endpoint: row.endpoint,
                    keys: {
                        p256dh: row.keys_p256dh,
                        auth: row.keys_auth
                    }
                };
                try {
                    await webpush.sendNotification(sub, strPayload);
                }
                catch (err) {
                    // If the subscription is gone or invalid, remove it
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        this.deleteSubscription(row.endpoint);
                    }
                    else {
                        log.error('Error sending push notification', { error: String(err) });
                    }
                }
            });
            await Promise.allSettled(promises);
        }
        catch (err) {
            log.error('Broadcast notification failed', { error: String(err) });
        }
    }
}
//# sourceMappingURL=push.js.map