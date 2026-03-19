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

// Note: parseTerminalOutput() and regex patterns have been removed.
// Structured events are now handled via ACP transport + AG-UI event parser.

export interface ActivityEvent {
  id: string;
  type: 'agent_message' | 'file_created' | 'file_edited' | 'file_deleted'
     | 'test_result' | 'build_result' | 'approval_needed' | 'error' | 'command_run';
  timestamp: number;
  sessionName: string;
  summary: string;
  icon: string;
  details?: {
    diff?: string;
    command?: string;
    filePath?: string;
    lines?: number;
    testResults?: { file: string; passed: number; failed: number }[];
    errorStack?: string;
    // AG-UI enriched fields
    toolCallId?: string;
    input?: Record<string, unknown>;
    output?: string;
  };
  actionable?: boolean;
}
