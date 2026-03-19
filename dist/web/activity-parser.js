/**
 * OpenSofa - Activity Parser
 *
 * This module was refactored to remove regex-based parsing.
 * ACP now handles structured events directly via the event-parser module.
 *
 *   import { JsonlParser } from './event-parser/jsonl-parser.js';
 *   import { mapAGUIToActivityEvent } from './event-parser/mapper.js';
 *
 * See: docs/AG-UI-ACP-ARCHITECTURE.md
 */
import { createLogger } from '../utils/logger.js';
const log = createLogger('activity-parser');
//# sourceMappingURL=activity-parser.js.map