import { SessionManager } from './src/session-manager';
import { AgentRegistry } from './src/agent-registry';
import { Session } from './src/types';

// Mock AgentRegistry
const registry = new AgentRegistry();

// Initialize SessionManager (minimal)
// @ts-ignore - reaching into private parts for testing
const sm = new SessionManager(registry, { dataDir: '/tmp', gitTimeoutMs: 1000, portRange: [3000, 4000] });

const mockSession: any = {
  name: 'test',
  agentType: 'opencode',
  status: 'active',
  port: 3000,
};

// @ts-ignore
const result = sm.parseAgentSwitchValue('plan', 'opencode');
console.log('Result for "plan" as opencode:', result);

// @ts-ignore
const resultAider = sm.parseAgentSwitchValue('aider', 'opencode');
console.log('Result for "aider" as opencode:', resultAider);

// @ts-ignore
const resultInvalid = sm.parseAgentSwitchValue('plan', 'aider');
console.log('Result for "plan" as aider (should fail):', resultInvalid);
