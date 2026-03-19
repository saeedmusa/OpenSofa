import { createLogger } from '../utils/logger.js';
const log = createLogger('web:notifier');
export class Notifier {
    config;
    constructor(config = { ntfyTopic: null }) {
        this.config = config;
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        log.info('Notifier configuration updated', { ntfyTopic: this.config.ntfyTopic });
    }
    getConfig() {
        return this.config;
    }
    isEnabled() {
        return this.config.ntfyTopic !== null;
    }
    async sendNotification(title, message, clickUrl) {
        if (!this.config.ntfyTopic) {
            log.debug('Notification skipped: No ntfy.sh topic configured');
            return false;
        }
        try {
            const headers = {
                'Title': title,
                'Tags': 'robot',
            };
            if (clickUrl) {
                headers['Click'] = clickUrl;
            }
            log.info(`Sending ntfy.sh push notification to topic ${this.config.ntfyTopic}`);
            // We use the public ntfy.sh server as requested
            const res = await fetch(`https://ntfy.sh/${this.config.ntfyTopic}`, {
                method: 'POST',
                headers,
                body: message
            });
            if (!res.ok) {
                log.error(`ntfy.sh request failed with status: ${res.status}`);
                return false;
            }
            return true;
        }
        catch (err) {
            log.error('Failed to send ntfy.sh notification', { error: String(err) });
            return false;
        }
    }
}
export function createNotifier(config) {
    return new Notifier(config);
}
//# sourceMappingURL=notifier.js.map