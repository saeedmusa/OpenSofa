export interface NotifierConfig {
    ntfyTopic: string | null;
}
export declare class Notifier {
    private config;
    constructor(config?: NotifierConfig);
    updateConfig(config: Partial<NotifierConfig>): void;
    getConfig(): NotifierConfig;
    isEnabled(): boolean;
    sendNotification(title: string, message: string, clickUrl?: string): Promise<boolean>;
}
export declare function createNotifier(config?: NotifierConfig): Notifier;
//# sourceMappingURL=notifier.d.ts.map