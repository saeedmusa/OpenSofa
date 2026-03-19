/**
 * OpenSofa - State Machine
 *
 * Formal state machine for session lifecycle management.
 * Prevents invalid transitions and provides clear state flow.
 */
import { createLogger } from './utils/logger.js';
const log = createLogger('state-machine');
const VALID_TRANSITIONS = [
    { from: [], to: 'creating', event: 'create_start' },
    { from: 'creating', to: 'active', event: 'create_success' },
    { from: 'creating', to: 'error', event: 'create_failed' },
    { from: 'active', to: 'stopping', event: 'stop_requested' },
    { from: 'stopping', to: 'stopped', event: 'stop_complete' },
    { from: 'stopping', to: 'error', event: 'stop_failed' },
    { from: 'active', to: 'error', event: 'fatal_error' },
    { from: 'error', to: 'active', event: 'recovered', guard: (ctx) => {
            if (!ctx.hasAgentProcess)
                return 'No agent process running';
            if (!ctx.hasFeedbackController)
                return 'No feedback controller connected';
            return true;
        } },
    { from: 'stopped', to: 'creating', event: 'restart' },
];
const VALID_AGENT_TRANSITIONS = [
    { from: 'stable', to: 'running' },
    { from: 'running', to: 'stable' },
];
export class StateMachine {
    currentState;
    currentAgentState;
    context;
    history = [];
    constructor(initialState = 'creating', initialAgentState = 'stable', context) {
        this.currentState = initialState;
        this.currentAgentState = initialAgentState;
        this.context = context;
    }
    getState() {
        return this.currentState;
    }
    getAgentState() {
        return this.currentAgentState;
    }
    updateContext(updates) {
        this.context = { ...this.context, ...updates };
    }
    canTransition(event) {
        const transition = VALID_TRANSITIONS.find(t => t.event === event);
        if (!transition) {
            return { ok: false, error: `Unknown event: ${event}` };
        }
        const fromStates = Array.isArray(transition.from) ? transition.from : [transition.from];
        if (fromStates.length > 0 && !fromStates.includes(this.currentState)) {
            return {
                ok: false,
                error: `Invalid transition: cannot '${event}' from '${this.currentState}' (expected: ${fromStates.join(' or ')})`
            };
        }
        if (transition.guard) {
            const guardResult = transition.guard(this.context);
            if (guardResult !== true) {
                return { ok: false, error: `Guard failed: ${guardResult}` };
            }
        }
        return { ok: true };
    }
    transition(event) {
        const canTransition = this.canTransition(event);
        if (!canTransition.ok) {
            log.warn(`Transition rejected: ${event}`, {
                currentState: this.currentState,
                error: canTransition.error
            });
            return canTransition;
        }
        const transition = VALID_TRANSITIONS.find(t => t.event === event);
        const from = this.currentState;
        const to = Array.isArray(transition.to) ? transition.to[0] : transition.to;
        this.history.push({
            from,
            to,
            event,
            timestamp: Date.now(),
        });
        this.currentState = to;
        log.info(`State transition: ${from} → ${to} (${event})`, {
            sessionName: this.context.sessionName
        });
        return { ok: true, from, to };
    }
    transitionAgent(newStatus) {
        if (this.currentAgentState === newStatus) {
            return { ok: true, changed: false };
        }
        const isValid = VALID_AGENT_TRANSITIONS.some(t => t.from === this.currentAgentState && t.to === newStatus);
        if (!isValid) {
            log.warn(`Invalid agent transition: ${this.currentAgentState} → ${newStatus}`);
            return { ok: false, changed: false };
        }
        const from = this.currentAgentState;
        this.currentAgentState = newStatus;
        log.debug(`Agent state: ${from} → ${newStatus}`, {
            sessionName: this.context.sessionName
        });
        return { ok: true, changed: true };
    }
    getHistory() {
        return [...this.history];
    }
    isTerminal() {
        return this.currentState === 'stopped' || this.currentState === 'error';
    }
    canAcceptMessages() {
        return this.currentState === 'active' && this.currentAgentState === 'stable';
    }
    canAcceptRawInput() {
        return this.currentState === 'active';
    }
}
export function createSessionStateMachine(sessionName) {
    return new StateMachine('creating', 'stable', {
        sessionName,
        hasAgentProcess: false,
        hasFeedbackController: false,
        pendingApproval: false,
        agentStatus: 'stable',
    });
}
export const SESSION_EVENTS = {
    CREATE_START: 'create_start',
    CREATE_SUCCESS: 'create_success',
    CREATE_FAILED: 'create_failed',
    STOP_REQUESTED: 'stop_requested',
    STOP_COMPLETE: 'stop_complete',
    STOP_FAILED: 'stop_failed',
    FATAL_ERROR: 'fatal_error',
    RECOVERED: 'recovered',
    RESTART: 'restart',
};
//# sourceMappingURL=state-machine.js.map