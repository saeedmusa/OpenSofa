import webpush from 'web-push';
import type { OpenSofaConfig } from '../types.js';
export interface PushSubscriptionRow {
    endpoint: string;
    keys_p256dh: string;
    keys_auth: string;
}
export declare class PushManager {
    private config;
    private publicKey;
    private privateKey;
    constructor(config: OpenSofaConfig);
    /**
     * Initialize VAPID keys. Generates and saves to DB if they don't exist.
     */
    init(): Promise<void>;
    getPublicKey(): string;
    /**
     * Save a push subscription from a client
     */
    saveSubscription(subscription: webpush.PushSubscription): void;
    /**
     * Delete a stale or invalid push subscription
     */
    deleteSubscription(endpoint: string): void;
    /**
     * Send a notification to all subscribed clients
     */
    broadcastNotification(payload: object): Promise<void>;
}
//# sourceMappingURL=push.d.ts.map