import type { Session, SessionDetail, Agent, SystemStatus, FileListResponse, FileContentResponse, ModelDiscoveryResult, AgentAPIMessage } from '../types';
import { useSessionStore, canAcceptMessages, canQueueMessages } from '../stores/sessionStore';

const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('opensofa_token') ||
    new URLSearchParams(window.location.search).get('token');
}

function saveToken(token: string): void {
  localStorage.setItem('opensofa_token', token);
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.toString());
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options?.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new APIError(error.error || `HTTP ${res.status}`, res.status);
  }

  const data = await res.json();
  return data.data ?? data;
}

function encodePathSegments(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export class APIError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
  
  isAgentBusy(): boolean {
    return this.status === 409 || this.status === 422;
  }
  
  isOffline(): boolean {
    return this.message.includes('fetch') || this.message.includes('network');
  }
}

export type SendMessageResult = 
  | { ok: true; queued: false }
  | { ok: true; queued: true; messageId: string }
  | { ok: false; error: string };

async function sendMessageWithQueue(
  sessionName: string, 
  content: string,
  session: Session | null
): Promise<SendMessageResult> {
  if (!session) {
    return { ok: false, error: 'Session not found' };
  }
  
  if (!canQueueMessages(session)) {
    return { ok: false, error: 'Session is not active' };
  }
  
  const { queueMessage } = useSessionStore.getState();
  
  if (!canAcceptMessages(session)) {
    const queued = queueMessage(sessionName, content);
    
    if ('serviceWorker' in navigator && 'sync' in (await navigator.serviceWorker.ready)) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('message-sync');
      } catch {
        // Background sync not available, will retry on reconnect
      }
    }
    
    return { ok: true, queued: true, messageId: queued.id };
  }
  
  try {
    await fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(sessionName)}/message`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    return { ok: true, queued: false };
  } catch (err) {
    if (err instanceof APIError && err.isAgentBusy()) {
      const queued = queueMessage(sessionName, content);
      return { ok: true, queued: true, messageId: queued.id };
    }
    
    if (err instanceof APIError && err.isOffline()) {
      const queued = queueMessage(sessionName, content);
      return { ok: true, queued: true, messageId: queued.id };
    }
    
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

async function flushMessageQueue(sessionName: string): Promise<{ delivered: number; failed: number }> {
  const store = useSessionStore.getState();
  const queued = store.getQueuedMessages(sessionName);
  
  if (queued.length === 0) {
    return { delivered: 0, failed: 0 };
  }
  
  let delivered = 0;
  let failed = 0;
  
  for (const msg of queued.filter(m => m.status === 'pending')) {
    store.updateQueuedMessage(sessionName, msg.id, 'sending');
    
    try {
      await fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(sessionName)}/message`, {
        method: 'POST',
        body: JSON.stringify({ content: msg.content }),
      });
      
      store.updateQueuedMessage(sessionName, msg.id, 'sent');
      store.removeQueuedMessage(sessionName, msg.id);
      delivered++;
    } catch (err) {
      store.updateQueuedMessage(sessionName, msg.id, 'failed');
      failed++;
    }
  }
  
  return { delivered, failed };
}

export const api = {
  getToken,
  saveToken,

  sessions: {
    list: () => fetchAPI<{ sessions: Session[] }>('/sessions'),
    get: (name: string) => fetchAPI<SessionDetail>(`/sessions/${encodeURIComponent(name)}`),
    message: (name: string, content: string) => 
      fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(name)}/message`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    sendMessageWithQueue,
    flushMessageQueue,
    approve: (name: string) => 
      fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(name)}/approve`, { method: 'POST' }),
    reject: (name: string) => 
      fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(name)}/reject`, { method: 'POST' }),
    undo: (name: string) => 
      fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(name)}/undo`, { method: 'POST' }),
    switchModel: (name: string, model: string) => 
      fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(name)}/model`, {
        method: 'POST',
        body: JSON.stringify({ model }),
      }),
    resolveConflict: (name: string, filePath: string, resolution: 'current' | 'incoming' | 'both') =>
      fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(name)}/conflicts/resolve`, {
        method: 'POST',
        body: JSON.stringify({ filePath, resolution }),
      }),
    uploadImage: (name: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      // NOTE: We don't use fetchAPI here easily if we want to let the browser set the multipart Content-Type automatically.
      // Or we can use fetchAPI and omit Content-Type. Let's do a custom fetch.
      const token = getToken();
      const headers: HeadersInit = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      };
      return fetch(`/api/sessions/${encodeURIComponent(name)}/upload`, {
        method: 'POST',
        headers,
        body: formData,
      }).then(async res => {
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        return data.data ?? data;
      }) as Promise<{ url: string }>;
    },
    updateSettings: (name: string, settings: Record<string, unknown>) =>
      fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body: JSON.stringify(settings),
      }),
    stop: (name: string) => 
      fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    messages: (name: string) =>
      fetchAPI<{ messages: AgentAPIMessage[] }>(`/sessions/${encodeURIComponent(name)}/messages`),
    restart: (name: string) =>
      fetchAPI<{ ok: boolean }>(`/sessions/${encodeURIComponent(name)}/restart`, { method: 'POST' }),
    listFiles: (name: string, dirPath?: string) => 
      fetchAPI<FileListResponse>(
        `/sessions/${encodeURIComponent(name)}/files${dirPath ? `?path=${encodeURIComponent(dirPath)}` : ''}`
      ),
    getFile: (name: string, filePath: string) => 
      fetchAPI<FileContentResponse>(
        `/sessions/${encodeURIComponent(name)}/files/${encodePathSegments(filePath)}`
      ),
    getChanges: (name: string) =>
      fetchAPI<{ changes: Array<{ filePath: string; changeType: string; status: string; added: number; removed: number }> }>(
        `/sessions/${encodeURIComponent(name)}/changes`
      ),
  },

  agents: {
    list: () => fetchAPI<{ agents: Agent[] }>('/agents'),
  },

  status: () => fetchAPI<SystemStatus>('/status'),

  push: {
    getPublicKey: () => fetchAPI<{ publicKey: string }>('/push/public-key'),
    subscribe: (subscription: PushSubscription) => 
      fetchAPI<{ ok: boolean }>('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
      }),
    test: () => 
      fetchAPI<{ ok: boolean }>('/push/test', { method: 'POST' }),
  },

  totp: {
    status: () => fetchAPI<{ configured: boolean }>('/totp/status'),
    setup: () => fetchAPI<{ qrUri: string; secret: string }>('/totp/setup', { method: 'POST' }),
    verify: (code: string) => 
      fetchAPI<{ valid: boolean }>('/totp/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
  },

  models: {
    discover: (agents?: string[]) => {
      const query = agents?.length ? `?agents=${agents.join(',')}` : '';
      return fetchAPI<ModelDiscoveryResult>(`/models/discover${query}`);
    },
  },

  conversations: {
    list: () => fetchAPI<{ conversations: Array<{ sessionName: string; messageCount: number; lastActivity: number }> }>('/conversations'),
    get: (sessionName: string) => fetchAPI<{ sessionName: string; messages: AgentAPIMessage[] }>(`/conversations/${encodeURIComponent(sessionName)}`),
  },

  mcp: {
    servers: () => fetchAPI<{ servers: Array<{ name: string; agent: string; transport: string; command?: string; args?: string[]; url?: string; envKeys: string[]; status: string; configPath: string }> }>('/mcp/servers'),
    discoverTools: (agent: string, name: string) =>
      fetchAPI<{ serverName: string; tools: Array<{ name: string; description?: string }>; error?: string }>(
        `/mcp/servers/${encodeURIComponent(agent)}/${encodeURIComponent(name)}/tools`,
        { method: 'POST' }
      ),
    add: (server: { agent: string; name: string; command?: string; args?: string[]; url?: string; env?: Record<string, string> }) =>
      fetchAPI<{ ok: boolean }>('/mcp/servers', { method: 'POST', body: JSON.stringify(server) }),
    remove: (agent: string, name: string) =>
      fetchAPI<{ ok: boolean }>(`/mcp/servers/${encodeURIComponent(agent)}/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  },

  templates: {
    list: () => fetchAPI<{ templates: Array<{ id: string; name: string; agent: string; model?: string; description?: string; mcpServers?: string[] }> }>('/templates'),
    create: (template: { id: string; name: string; agent: string; model?: string; description?: string; mcpServers?: string[] }) =>
      fetchAPI<{ ok: boolean; id: string }>('/templates', { method: 'POST', body: JSON.stringify(template) }),
    delete: (id: string) =>
      fetchAPI<{ ok: boolean }>(`/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
};
