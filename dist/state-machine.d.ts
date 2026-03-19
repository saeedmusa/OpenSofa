/**
 * OpenSofa - State Machine
 *
 * Formal state machine for session lifecycle management.
 * Prevents invalid transitions and provides clear state flow.
 */
export type SessionState = 'creating' | 'active' | 'stopping' | 'stopped' | 'error';
export type AgentState = 'stable' | 'running';
export interface StateTransition {
    from: SessionState | SessionState[];
    to: SessionState;
    event: string;
    guard?: (context: StateContext) => boolean | string;
}
export interface StateContext {
    sessionName: string;
    hasAgentProcess: boolean;
    hasFeedbackController: boolean;
    pendingApproval: boolean;
    agentStatus: AgentState;
}
export declare class StateMachine {
    private currentState;
    private currentAgentState;
    private context;
    private history;
    constructor(initialState: SessionState | undefined, initialAgentState: AgentState | undefined, context: StateContext);
    getState(): SessionState;
    getAgentState(): AgentState;
    updateContext(updates: Partial<StateContext>): void;
    canTransition(event: string): {
        ok: boolean;
        error?: string;
    };
    transition(event: string): {
        ok: boolean;
        error?: string;
        from?: SessionState;
        to?: SessionState;
    };
    transitionAgent(newStatus: AgentState): {
        ok: boolean;
        changed: boolean;
    };
    getHistory(): typeof this.history;
    isTerminal(): boolean;
    canAcceptMessages(): boolean;
    canAcceptRawInput(): boolean;
}
export declare function createSessionStateMachine(sessionName: string): StateMachine;
export declare const SESSION_EVENTS: {
    readonly CREATE_START: "create_start";
    readonly CREATE_SUCCESS: "create_success";
    readonly CREATE_FAILED: "create_failed";
    readonly STOP_REQUESTED: "stop_requested";
    readonly STOP_COMPLETE: "stop_complete";
    readonly STOP_FAILED: "stop_failed";
    readonly FATAL_ERROR: "fatal_error";
    readonly RECOVERED: "recovered";
    readonly RESTART: "restart";
};
export type SessionEvent = typeof SESSION_EVENTS[keyof typeof SESSION_EVENTS];
//# sourceMappingURL=state-machine.d.ts.map