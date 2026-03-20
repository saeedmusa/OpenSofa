import { Loader2 } from 'lucide-react';

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="p-4 rounded-2xl bg-accent-soft">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
        <span className="text-sm text-[rgba(255,255,255,0.5)] font-medium">Loading...</span>
      </div>
    </div>
  );
}
