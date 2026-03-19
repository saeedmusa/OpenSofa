/**
 * OpenSofa - Event Parser Module
 *
 * This module provides the core infrastructure for parsing agent events
 * from JSONL output and mapping them to AG-UI events and OpenSofa ActivityEvents.
 */
export { JsonlParser, parseJsonlLine, generateEventId } from './jsonl-parser.js';
export { ACPEventParser, createACPEventParser } from './acp-parser.js';
export type { ACPSessionUpdate, ACPStatusChange } from './acp-parser.js';
export { mapAGUIToActivityEvent, isApprovalEvent, extractCommandFromApproval } from './mapper.js';
export type { ActivityEvent } from '../activity-parser.js';
//# sourceMappingURL=mod.d.ts.map