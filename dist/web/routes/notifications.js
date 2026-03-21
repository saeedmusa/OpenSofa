import { Hono } from 'hono';
import { createLogger } from '../../utils/logger.js';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import { getConfigPath } from '../../utils/expand-path.js';
const log = createLogger('web:routes:notifications');
export const createNotificationsRoutes = (deps) => {
    const { notifier } = deps;
    const app = new Hono();
    // Get current ntfy topic
    app.get('/settings', (c) => {
        return c.json({
            success: true,
            data: {
                ntfyTopic: notifier.getConfig().ntfyTopic
            }
        });
    });
    // Save new ntfy topic
    app.post('/settings', async (c) => {
        try {
            const body = await c.req.json();
            const topic = body.ntfyTopic || null;
            notifier.updateConfig({ ntfyTopic: topic });
            // Persist to YAML config file
            const configPath = getConfigPath();
            try {
                const raw = await fs.readFile(configPath, 'utf8');
                const parsed = yaml.load(raw);
                parsed.ntfyTopic = topic;
                await fs.writeFile(configPath, yaml.dump(parsed), 'utf8');
            }
            catch {
                // Config file doesn't exist or can't be read — skip persistence
                log.debug('Config file not found, skipping persistence');
            }
            return c.json({ success: true, data: { ntfyTopic: topic } });
        }
        catch (err) {
            log.error('Failed to save notification settings', { error: err.message });
            return c.json({ success: false, error: 'Failed to save settings' }, 500);
        }
    });
    // Test notification
    app.post('/test', async (c) => {
        const success = await notifier.sendNotification('OpenSofa Test', 'This is a test notification from OpenSofa!');
        if (success) {
            return c.json({ success: true });
        }
        else {
            return c.json({ success: false, error: 'Failed to send test notification. Check if topic is configured.' }, 400);
        }
    });
    return app;
};
//# sourceMappingURL=notifications.js.map