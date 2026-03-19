/**
 * OpenSofa - AG-UI to ActivityEvent Mapper
 *
 * Maps AG-UI events to OpenSofa ActivityEvent format
 * for frontend consumption.
 */
import type { ActivityEvent } from '../activity-parser.js';
import { type AGUIEvent } from '../ag-ui-events.js';
/**
 * Map AG-UI event to OpenSofa ActivityEvent
 */
export declare function mapAGUIToActivityEvent(aguiEvent: AGUIEvent, sessionName: string): ActivityEvent;
/**
 * Check if an AG-UI event represents an approval request
 */
export declare function isApprovalEvent(event: AGUIEvent): boolean;
/**
 * Extract approval command from an approval event
 */
export declare function extractCommandFromApproval(event: AGUIEvent): string | null;
//# sourceMappingURL=mapper.d.ts.map