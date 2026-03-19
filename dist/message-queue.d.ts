/**
 * OpenSofa - Message Queue
 *
 * Queues messages when agent is busy and delivers when ready.
 * Provides pending state tracking for UI feedback.
 */
export type QueuedMessageType = 'user_message' | 'file_upload' | 'approval_response';
export interface QueuedMessage {
    id: string;
    sessionName: string;
    type: QueuedMessageType;
    content: string;
    timestamp: number;
    attempts: number;
    maxAttempts: number;
    metadata?: {
        fileName?: string;
        mimeType?: string;
        buffer?: Buffer;
        isApproval?: boolean;
        approved?: boolean;
    };
}
export interface MessageQueueOptions {
    maxQueueSize?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
}
type MessageSender = (msg: QueuedMessage) => Promise<void>;
type QueueChangeListener = (sessionName: string, queue: QueuedMessage[]) => void;
export declare class MessageQueue {
    private queues;
    private sender;
    private listeners;
    private options;
    constructor(options?: MessageQueueOptions);
    setSender(sender: MessageSender): void;
    enqueue(sessionName: string, type: QueuedMessageType, content: string, metadata?: QueuedMessage['metadata']): QueuedMessage | null;
    flush(sessionName: string): Promise<{
        delivered: number;
        failed: number;
    }>;
    peek(sessionName: string): QueuedMessage[];
    size(sessionName: string): number;
    hasPending(sessionName: string): boolean;
    clear(sessionName: string): void;
    subscribe(listener: QueueChangeListener): () => void;
    getAllPending(): Map<string, QueuedMessage[]>;
    private getOrCreateQueue;
    private notifyListeners;
}
export declare const globalMessageQueue: MessageQueue;
export {};
//# sourceMappingURL=message-queue.d.ts.map