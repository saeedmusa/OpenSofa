/**
 * Integration Test: Type Compatibility
 * 
 * Verifies that frontend types match expected API response shapes.
 * Tests that the frontend can correctly handle backend responses.
 */

import { describe, it, expect } from 'vitest';
import type { Session, SessionDetail, Agent, SystemStatus, AgentType } from '../types';

// Mock API response shapes based on backend types
type BackendSessionSummary = {
  name: string;
  status: 'creating' | 'active' | 'stopping' | 'stopped' | 'error';
  agentType: AgentType;
  model: string;
  branch: string;
  agentStatus: 'stable' | 'running' | 'awaiting_human_input';
  hasPendingApproval: boolean;
  createdAt: number;
  lastActivityAt: number;
};

type BackendSessionDetail = BackendSessionSummary & {
  workDir: string;
  repoDir: string;
  port: number;
  autoApprove: boolean;
  pendingApproval: {
    detectedAt: number;
    command: string | null;
  } | null;
};

type BackendAgentSummary = {
  type: AgentType;
  displayName: string;
  installed: boolean;
  description: string;
  knownModels: string[];
  defaultModel?: string;
};

type BackendSystemStatus = {
  tunnelUrl: string | null;
  tunnelStatus: 'starting' | 'running' | 'stopped' | 'error';
  sessionsCount: number;
  uptime: number;
  systemResources: {
    cpu: string;
    freeMem: string;
  };
};

describe('Type Compatibility', () => {
  describe('Session Types', () => {
    it('frontend Session should be assignable from backend SessionSummary', () => {
      const backendSession: BackendSessionSummary = {
        name: 'test-session',
        status: 'active',
        agentType: 'claude',
        model: 'sonnet',
        branch: 'main',
        agentStatus: 'stable',
        hasPendingApproval: false,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      const frontendSession: Session = {
        name: backendSession.name,
        status: backendSession.status,
        agentType: backendSession.agentType,
        model: backendSession.model,
        branch: backendSession.branch,
        agentStatus: backendSession.agentStatus,
        hasPendingApproval: backendSession.hasPendingApproval,
        createdAt: backendSession.createdAt,
        lastActivityAt: backendSession.lastActivityAt,
      };

      expect(frontendSession.name).toBe('test-session');
    });

    it('frontend SessionDetail should be assignable from backend SessionDetailResponse', () => {
      const backendDetail: BackendSessionDetail = {
        name: 'test-session',
        status: 'active',
        agentType: 'claude',
        model: 'sonnet',
        branch: 'main',
        agentStatus: 'stable',
        hasPendingApproval: true,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        workDir: '/tmp/work',
        repoDir: '/tmp/repo',
        port: 3284,
        autoApprove: false,
        pendingApproval: {
          detectedAt: Date.now(),
          command: 'npm test',
        },
      };

      const frontendDetail: SessionDetail = {
        name: backendDetail.name,
        status: backendDetail.status,
        agentType: backendDetail.agentType,
        model: backendDetail.model,
        branch: backendDetail.branch,
        agentStatus: backendDetail.agentStatus,
        hasPendingApproval: backendDetail.hasPendingApproval,
        createdAt: backendDetail.createdAt,
        lastActivityAt: backendDetail.lastActivityAt,
        workDir: backendDetail.workDir,
        repoDir: backendDetail.repoDir,
        port: backendDetail.port,
        autoApprove: backendDetail.autoApprove,
        pendingApproval: backendDetail.pendingApproval,
      };

      expect(frontendDetail.pendingApproval?.command).toBe('npm test');
    });

    it('all backend session statuses should be valid in frontend', () => {
      const statuses: Array<'creating' | 'active' | 'stopping' | 'stopped' | 'error'> = [
        'creating',
        'active',
        'stopping',
        'stopped',
        'error',
      ];

      statuses.forEach((status) => {
        const session: Session = {
          name: 'test',
          status,
          agentType: 'claude',
          model: 'sonnet',
          branch: 'main',
          agentStatus: 'stable',
          hasPendingApproval: false,
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
        };
        expect(session.status).toBe(status);
      });
    });
  });

  describe('Agent Types', () => {
    it('frontend Agent should be assignable from backend AgentSummary', () => {
      const backendAgent: BackendAgentSummary = {
        type: 'claude',
        displayName: 'Claude Code',
        installed: true,
        description: 'Claude AI coding assistant',
        knownModels: ['sonnet', 'opus'],
        defaultModel: 'sonnet',
      };

      const frontendAgent: Agent = {
        type: backendAgent.type,
        displayName: backendAgent.displayName,
        installed: backendAgent.installed,
        description: backendAgent.description,
        knownModels: backendAgent.knownModels,
        defaultModel: backendAgent.defaultModel,
      };

      expect(frontendAgent.displayName).toBe('Claude Code');
    });
  });

  describe('System Status Types', () => {
    it('frontend SystemStatus should be assignable from backend SystemStatusResponse', () => {
      const backendStatus: BackendSystemStatus = {
        tunnelUrl: 'https://test.trycloudflare.com',
        tunnelStatus: 'running',
        sessionsCount: 3,
        uptime: 3600,
        systemResources: {
          cpu: '25%',
          freeMem: '4GB',
        },
      };

      const frontendStatus: SystemStatus = {
        tunnelUrl: backendStatus.tunnelUrl,
        tunnelStatus: backendStatus.tunnelStatus,
        sessionsCount: backendStatus.sessionsCount,
        uptime: backendStatus.uptime,
        systemResources: backendStatus.systemResources,
      };

      expect(frontendStatus.tunnelUrl).toBe('https://test.trycloudflare.com');
    });

    it('all backend tunnel statuses should be valid in frontend', () => {
      const statuses: Array<'starting' | 'running' | 'stopped' | 'error'> = [
        'starting',
        'running',
        'stopped',
        'error',
      ];

      statuses.forEach((tunnelStatus) => {
        const status: SystemStatus = {
          tunnelUrl: null,
          tunnelStatus,
          sessionsCount: 0,
          uptime: 0,
          systemResources: { cpu: '0%', freeMem: '0GB' },
        };
        expect(status.tunnelStatus).toBe(tunnelStatus);
      });
    });
  });
});
