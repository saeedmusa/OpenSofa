import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, CheckCircle2, XCircle, Smartphone, Save } from 'lucide-react';
import { clsx } from 'clsx';

export function NotificationSettings() {
    const [topic, setTopic] = useState('');
    const [initialTopic, setInitialTopic] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const res = await fetch('/api/notifications/settings', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('opensofa-token')}`
                }
            });
            const data = await res.json();
            if (data.success && data.data) {
                setTopic(data.data.ntfyTopic || '');
                setInitialTopic(data.data.ntfyTopic || '');
            }
        } catch (err) {
            console.error('Failed to load notification settings:', err);
            setErrorMsg('Failed to load settings.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setErrorMsg(null);
        setSaveResult(null);
        
        try {
            const res = await fetch('/api/notifications/settings', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('opensofa-token')}`
                },
                body: JSON.stringify({ ntfyTopic: topic || null })
            });
            const data = await res.json();
            if (data.success) {
                setSaveResult('success');
                setInitialTopic(topic);
            } else {
                setSaveResult('error');
                setErrorMsg(data.error || 'Failed to save settings');
            }
        } catch (err) {
            console.error('Failed to save notification settings:', err);
            setSaveResult('error');
            setErrorMsg('Failed to save settings.');
        } finally {
            setSaving(false);
            setTimeout(() => setSaveResult(null), 3000);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        setErrorMsg(null);
        try {
            const res = await fetch('/api/notifications/test', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('opensofa-token')}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setTestResult('success');
            } else {
                setTestResult('error');
                setErrorMsg(data.error || 'Test push failed.');
            }
        } catch {
            setTestResult('error');
            setErrorMsg('Test push failed. Check server logs.');
        } finally {
            setTesting(false);
            setTimeout(() => setTestResult(null), 3000);
        }
    };

    const isChanged = topic !== initialTopic;
    const isTopicSet = !!initialTopic;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-[rgba(255,255,255,0.5)]" />
            </div>
        );
    }

    return (
        <section className="surface-floating p-6">
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 rounded-xl bg-accent-soft">
                    {isTopicSet ? <Bell size={20} className="text-accent" /> : <BellOff size={20} className="text-[rgba(255,255,255,0.5)]" />}
                </div>
                <div>
                    <h2 className="font-semibold text-fg-strong">Push Notifications (ntfy.sh)</h2>
                    <p className="text-xs text-[rgba(255,255,255,0.5)]">Receive alerts on your devices when Agent requires input</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Topic Input */}
                <div>
                    <label className="text-sm text-fg-strong block mb-1">ntfy.sh Topic Name</label>
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. opensofa_alerts_xyz123"
                        className="w-full px-3 py-2 bg-bg-strong border border-border rounded-lg text-sm text-fg focus:outline-none focus:border-accent"
                    />
                    <p className="text-xs text-[rgba(255,255,255,0.5)] mt-2">
                        Download the <a href="https://ntfy.sh" target="_blank" rel="noreferrer" className="text-accent hover:underline">ntfy.sh app</a> on iOS or Android and subscribe to this exact topic to receive notifications. Keep this unique and secret. Leave blank to disable.
                    </p>
                </div>

                {errorMsg && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {errorMsg}
                    </div>
                )}

                {/* Save + Test buttons */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving || !isChanged}
                        className={clsx(
                            "btn flex items-center gap-2 px-4",
                            isChanged ? "btn-primary" : "btn-secondary opacity-70"
                        )}
                    >
                        {saving ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : saveResult === 'success' ? (
                            <CheckCircle2 size={14} className="text-white" />
                        ) : saveResult === 'error' ? (
                            <XCircle size={14} className="text-red-400" />
                        ) : (
                            <Save size={14} />
                        )}
                        {saving ? 'Saving...' : saveResult === 'success' ? 'Saved!' : 'Save Settings'}
                    </button>
                    
                    <button
                        onClick={handleTest}
                        disabled={testing || !isTopicSet || isChanged}
                        className="btn btn-secondary flex items-center gap-2 px-4"
                        title={isChanged ? "Save settings first" : ""}
                    >
                        {testing ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : testResult === 'success' ? (
                            <CheckCircle2 size={14} className="text-emerald-400" />
                        ) : testResult === 'error' ? (
                            <XCircle size={14} className="text-red-400" />
                        ) : (
                            <Smartphone size={14} />
                        )}
                        {testing ? 'Sending...' : testResult === 'success' ? 'Sent!' : testResult === 'error' ? 'Failed' : 'Send Test Push'}
                    </button>
                </div>
            </div>
        </section>
    );
}
