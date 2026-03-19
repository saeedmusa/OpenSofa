/**
 * Tests for ACP Event Parser
 * 
 * Tests parsing of ACP (Agent Client Protocol) SSE events from agentapi's /events endpoint.
 * Reference: src/web/event-parser/acp-parser.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ACPEventParser, createACPEventParser } from '../../src/web/event-parser/acp-parser.js';

describe('ACPEventParser', () => {
  let parser: ACPEventParser;

  beforeEach(() => {
    parser = createACPEventParser();
  });

  describe('parseSSELine', () => {
    it('should parse valid JSON line', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            AgentMessageChunk: {
              Content: {
                Text: {
                  Text: 'Hello world'
                }
              }
            }
          }
        }
      });

      let receivedText: string | null = null;
      parser.on('text_chunk', (text) => {
        receivedText = text;
      });

      parser.parseSSELine(data);

      expect(receivedText).toBe('Hello world');
    });

    it('should ignore empty lines', () => {
      let eventEmitted = false;
      parser.on('text_chunk', () => {
        eventEmitted = true;
      });

      parser.parseSSELine('');
      parser.parseSSELine('   ');
      parser.parseSSELine('\n');

      expect(eventEmitted).toBe(false);
    });

    it('should handle malformed JSON gracefully', () => {
      // Should not throw
      expect(() => {
        parser.parseSSELine('not valid json {');
      }).not.toThrow();

      // Should not emit any events
      let eventEmitted = false;
      parser.on('text_chunk', () => { eventEmitted = true; });
      parser.on('tool_call', () => { eventEmitted = true; });
      parser.on('tool_call_update', () => { eventEmitted = true; });
      parser.on('status_change', () => { eventEmitted = true; });

      parser.parseSSELine('not valid json {');

      expect(eventEmitted).toBe(false);
    });

    it('should handle invalid JSON structure', () => {
      // Valid JSON but not an ACP event
      let eventEmitted = false;
      parser.on('text_chunk', () => { eventEmitted = true; });

      parser.parseSSELine('{"foo": "bar"}');

      expect(eventEmitted).toBe(false);
    });
  });

  describe('text_chunk emission', () => {
    it('should parse text_chunk from AgentMessageChunk', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            AgentMessageChunk: {
              Content: {
                Text: {
                  Text: 'This is a test message'
                }
              }
            }
          }
        }
      });

      let receivedText: string | null = null;
      parser.on('text_chunk', (text) => {
        receivedText = text;
      });

      parser.parseSSELine(data);

      expect(receivedText).toBe('This is a test message');
    });

    it('should emit text_chunk with correct data type', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            AgentMessageChunk: {
              Content: {
                Text: {
                  Text: 'Testing'
                }
              }
            }
          }
        }
      });

      let receivedType: string | null = null;
      parser.on('text_chunk', (text) => {
        receivedType = typeof text;
      });

      parser.parseSSELine(data);

      expect(receivedType).toBe('string');
    });

    it('should not emit text_chunk when Text is missing', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            AgentMessageChunk: {
              Content: {}
            }
          }
        }
      });

      let eventEmitted = false;
      parser.on('text_chunk', () => { eventEmitted = true; });

      parser.parseSSELine(data);

      expect(eventEmitted).toBe(false);
    });
  });

  describe('tool_call emission', () => {
    it('should parse tool_call from ToolCall', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            ToolCall: {
              Kind: 'Bash',
              Title: 'Run npm install'
            }
          }
        }
      });

      let receivedTool: { kind: string; title: string } | null = null;
      parser.on('tool_call', (tool) => {
        receivedTool = tool;
      });

      parser.parseSSELine(data);

      expect(receivedTool).toEqual({
        kind: 'Bash',
        title: 'Run npm install'
      });
    });

    it('should emit tool_call with correct data', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            ToolCall: {
              Kind: 'Edit',
              Title: 'Edit file'
            }
          }
        }
      });

      let receivedTool: any = null;
      parser.on('tool_call', (tool) => {
        receivedTool = tool;
      });

      parser.parseSSELine(data);

      expect(receivedTool).toHaveProperty('kind', 'Edit');
      expect(receivedTool).toHaveProperty('title', 'Edit file');
    });

    it('should not emit tool_call when Kind is missing', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            ToolCall: {
              Title: 'Some tool'
            }
          }
        }
      });

      let eventEmitted = false;
      parser.on('tool_call', () => { eventEmitted = true; });

      parser.parseSSELine(data);

      expect(eventEmitted).toBe(false);
    });

    it('should not emit tool_call when Title is missing', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            ToolCall: {
              Kind: 'Bash'
            }
          }
        }
      });

      let eventEmitted = false;
      parser.on('tool_call', () => { eventEmitted = true; });

      parser.parseSSELine(data);

      expect(eventEmitted).toBe(false);
    });
  });

  describe('tool_call_update emission', () => {
    it('should parse tool_call_update from ToolCallUpdate', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            ToolCallUpdate: {
              Status: 'completed'
            }
          }
        }
      });

      let receivedStatus: string | null = null;
      parser.on('tool_call_update', (update) => {
        receivedStatus = update.status;
      });

      parser.parseSSELine(data);

      expect(receivedStatus).toBe('completed');
    });

    it('should emit tool_call_update with correct data', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            ToolCallUpdate: {
              Status: 'failed'
            }
          }
        }
      });

      let receivedUpdate: any = null;
      parser.on('tool_call_update', (update) => {
        receivedUpdate = update;
      });

      parser.parseSSELine(data);

      expect(receivedUpdate).toHaveProperty('status', 'failed');
    });

    it('should not emit tool_call_update when Status is missing', () => {
      const data = JSON.stringify({
        params: {
          SessionUpdate: {
            ToolCallUpdate: {}
          }
        }
      });

      let eventEmitted = false;
      parser.on('tool_call_update', () => { eventEmitted = true; });

      parser.parseSSELine(data);

      expect(eventEmitted).toBe(false);
    });
  });

  describe('status_change emission', () => {
    it('should parse status_change from StatusChange', () => {
      const data = JSON.stringify({
        params: {
          StatusChange: {
            Status: 'running',
            AgentType: 'opencode'
          }
        }
      });

      let receivedStatus: any = null;
      parser.on('status_change', (change) => {
        receivedStatus = change;
      });

      parser.parseSSELine(data);

      expect(receivedStatus).toEqual({
        status: 'running',
        agentType: 'opencode'
      });
    });

    it('should emit status_change with correct data', () => {
      const data = JSON.stringify({
        params: {
          StatusChange: {
            Status: 'stable',
            AgentType: 'claude'
          }
        }
      });

      let receivedChange: any = null;
      parser.on('status_change', (change) => {
        receivedChange = change;
      });

      parser.parseSSELine(data);

      expect(receivedChange).toHaveProperty('status', 'stable');
      expect(receivedChange).toHaveProperty('agentType', 'claude');
    });

    it('should emit status_change when only Status is present', () => {
      const data = JSON.stringify({
        params: {
          StatusChange: {
            Status: 'running'
          }
        }
      });

      let receivedChange: any = null;
      parser.on('status_change', (change) => {
        receivedChange = change;
      });

      parser.parseSSELine(data);

      expect(receivedChange).toHaveProperty('status', 'running');
      expect(receivedChange).toHaveProperty('agentType', undefined);
    });

    it('should not emit status_change when Status is missing', () => {
      const data = JSON.stringify({
        params: {
          StatusChange: {
            AgentType: 'opencode'
          }
        }
      });

      let eventEmitted = false;
      parser.on('status_change', () => { eventEmitted = true; });

      parser.parseSSELine(data);

      expect(eventEmitted).toBe(false);
    });
  });

  describe('legacy SessionUpdate format', () => {
    it('should handle SessionUpdate at top level (legacy)', () => {
      const data = JSON.stringify({
        AgentMessageChunk: {
          Content: {
            Text: {
              Text: 'Legacy format'
            }
          }
        }
      });

      let receivedText: string | null = null;
      parser.on('text_chunk', (text) => {
        receivedText = text;
      });

      parser.parseSSELine(data);

      expect(receivedText).toBe('Legacy format');
    });
  });

  describe('createACPEventParser', () => {
    it('should create a new parser instance', () => {
      const parser = createACPEventParser();

      expect(parser).toBeInstanceOf(ACPEventParser);
    });

    it('should return a fresh parser each time', () => {
      const parser1 = createACPEventParser();
      const parser2 = createACPEventParser();

      expect(parser1).not.toBe(parser2);
    });
  });
});
