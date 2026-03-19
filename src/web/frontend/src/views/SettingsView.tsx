/**
 * SettingsView — App settings page (US-12)
 *
 * Accessible via /settings route. Contains notification configuration
 * and other app-level settings.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { NotificationSettings } from '../components/NotificationSettings';

export function SettingsView() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col min-h-screen">
            <header className="floating-header px-5 py-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="btn btn-ghost p-2"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="text-lg font-semibold text-fg-strong">Settings</h1>
                </div>
            </header>

            <div className="flex-1 p-5 space-y-6 max-w-2xl mx-auto w-full">
                <NotificationSettings />
            </div>
        </div>
    );
}
