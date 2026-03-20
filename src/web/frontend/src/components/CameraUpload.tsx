import { useState, useRef, useCallback } from 'react';
import { Camera, X, ImageIcon, Loader2 } from 'lucide-react';
import { api } from '../utils/api';
import { safeVibrate } from '../utils/haptics';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB per Architecture §1.3
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface CameraUploadProps {
    sessionName: string;
    onUploaded?: (url: string) => void;
}

/**
 * Camera/gallery image picker for multimodal agent context (US-19).
 * Uses native <input type="file" accept="image/*" capture="environment">
 * for camera access on mobile.
 * 
 * Architecture Ref: §1.3 Multimodal Uploads
 */
export function CameraUpload({ sessionName, onUploaded }: CameraUploadProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        setError(null);

        // Validate type
        if (!ACCEPTED_TYPES.includes(selected.type)) {
            setError('Only JPEG, PNG, and WebP images are supported');
            return;
        }

        // Validate size
        if (selected.size > MAX_FILE_SIZE) {
            setError(`Image must be under 2MB (yours: ${(selected.size / 1024 / 1024).toFixed(1)}MB)`);
            return;
        }

        setFile(selected);

        // Generate preview thumbnail
        const reader = new FileReader();
        reader.onload = (ev) => {
            setPreview(ev.target?.result as string);
        };
        reader.readAsDataURL(selected);
    }, []);

    const handleUpload = useCallback(async () => {
        if (!file) return;

        setUploading(true);
        setError(null);
        try {
            const result = await api.sessions.uploadImage(sessionName, file);
            onUploaded?.(result.url);
            // Clear state
            setFile(null);
            setPreview(null);
            safeVibrate(50);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
            safeVibrate([30, 50, 30]);
        } finally {
            setUploading(false);
        }
    }, [file, sessionName, onUploaded]);

    const clearPreview = useCallback(() => {
        setFile(null);
        setPreview(null);
        setError(null);
        if (inputRef.current) inputRef.current.value = '';
    }, []);

    return (
        <div className="relative">
            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Select image from camera or gallery"
            />

            {/* Camera button — 48×48px per Architecture §1.3 */}
            <button
                onClick={() => inputRef.current?.click()}
                className="touch-target flex items-center justify-center p-2.5 rounded-xl text-[rgba(255,255,255,0.5)] hover:text-fg hover:bg-surface transition-colors"
                aria-label="Attach image"
                disabled={uploading}
            >
                <Camera size={20} />
            </button>

            {/* Preview overlay */}
            {preview && (
                <div className="absolute bottom-full left-0 mb-2 animate-in slide-in-from-bottom">
                    <div className="bg-bg-elevated border border-border rounded-2xl shadow-float-lg overflow-hidden w-56">
                        {/* Thumbnail */}
                        <div className="relative">
                            <img
                                src={preview}
                                alt="Selected image"
                                className="w-full h-32 object-cover"
                            />
                            <button
                                onClick={clearPreview}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                                aria-label="Remove image"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Info + send */}
                        <div className="p-3">
                            <div className="flex items-center gap-2 text-xs text-[rgba(255,255,255,0.5)] mb-2">
                                <ImageIcon size={12} />
                                <span className="truncate">{file?.name}</span>
                                <span className="flex-shrink-0 font-mono">
                                    {file ? `${(file.size / 1024).toFixed(0)}KB` : ''}
                                </span>
                            </div>

                            {error && (
                                <p className="text-danger text-xs mb-2 font-medium">{error}</p>
                            )}

                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="btn btn-primary w-full py-2 text-sm flex items-center justify-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    'Send Image'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
