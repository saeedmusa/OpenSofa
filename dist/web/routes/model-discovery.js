/**
 * OpenSofa - Unified Model Discovery API
 *
 * Aggregates model discovery from all coding agent adapters.
 */
import { Hono } from 'hono';
import { createLogger } from '../../utils/logger.js';
import { AdapterRegistry } from '../../model-adapters/registry.js';
import { OpenCodeAdapter } from '../../model-adapters/opencode-adapter.js';
import { ClaudeAdapter } from '../../model-adapters/claude-adapter.js';
const log = createLogger('model-discovery');
// Track initialization state
let initialized = false;
/**
 * Initialize adapters - called once when route module loads
 */
function initializeAdapters() {
    if (initialized)
        return;
    const registry = AdapterRegistry.getInstance();
    // Register OpenCode adapter
    registry.registerAdapter(new OpenCodeAdapter());
    log.debug('OpenCode adapter registered');
    // Register Claude adapter
    registry.registerAdapter(new ClaudeAdapter());
    log.debug('Claude adapter registered');
    initialized = true;
    log.info('Model discovery adapters initialized');
}
/**
 * Parse comma-separated agent list from query param
 */
function parseAgentFilter(agentsParam) {
    if (!agentsParam)
        return undefined;
    const agents = agentsParam
        .split(',')
        .map(a => a.trim().toLowerCase())
        .filter((a) => Boolean(a));
    return agents.length > 0 ? agents : undefined;
}
/**
 * Create unified model discovery routes
 */
export function createModelDiscoveryRoutes() {
    // Initialize adapters on first route creation
    initializeAdapters();
    const app = new Hono();
    // GET /api/models/discover - Discover models from all adapters
    app.get('/discover', async (c) => {
        const agentsParam = c.req.query('agents');
        const agents = parseAgentFilter(agentsParam);
        log.debug('Model discovery request', { agents: agents ?? 'all' });
        let result;
        try {
            result = await AdapterRegistry.getInstance().discoverAll(agents);
            log.info('Model discovery completed', {
                providerCount: result.providers.length,
                errorCount: result.errors?.length ?? 0,
            });
            return c.json(result);
        }
        catch (err) {
            const errorMsg = `Discovery failed: ${String(err)}`;
            log.error(errorMsg);
            // Return partial result with error if we have any providers,
            // otherwise return empty with the error message
            return c.json({
                success: false,
                providers: result?.providers ?? [],
                errors: [...(result?.errors ?? []), errorMsg],
            }, 500);
        }
    });
    return app;
}
//# sourceMappingURL=model-discovery.js.map