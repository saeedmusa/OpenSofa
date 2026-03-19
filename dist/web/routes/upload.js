/**
 * OpenSofa Web - Upload Routes
 *
 * Multipart image upload handler for attaching photos/screenshots
 * to agent context (US-19, Architecture §1.3).
 */
import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import { success, error } from '../types.js';
import { createLogger } from '../../utils/logger.js';
const log = createLogger('web:routes:upload');
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);
function extensionForMime(mimeType) {
    switch (mimeType) {
        case 'image/jpeg':
            return '.jpg';
        case 'image/png':
            return '.png';
        case 'image/webp':
            return '.webp';
        default:
            return '.png';
    }
}
// ──────────────────────────────────────
// Factory
// ──────────────────────────────────────
export const createUploadRoutes = (deps) => {
    const app = new Hono();
    const { sessionManager } = deps;
    // POST /api/sessions/:name/upload - Upload image attachment
    app.post('/:name/upload', async (c) => {
        const name = c.req.param('name');
        const session = sessionManager.getByName(name);
        if (!session) {
            return c.json(error('Session not found', 'NOT_FOUND'), 404);
        }
        try {
            const body = await c.req.parseBody();
            const file = body['file'];
            if (!file || !(file instanceof File)) {
                return c.json(error('file field is required (multipart/form-data)', 'INVALID_BODY'), 400);
            }
            // Validate file type
            if (!ALLOWED_TYPES.has(file.type)) {
                return c.json(error(`Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP`, 'INVALID_TYPE'), 400);
            }
            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                return c.json(error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 2MB`, 'FILE_TOO_LARGE'), 400);
            }
            // Create uploads directory inside the session workspace
            const uploadsDir = path.join(session.workDir, '.opensofa', 'uploads');
            fs.mkdirSync(uploadsDir, { recursive: true });
            // Generate unique filename
            const ext = extensionForMime(file.type);
            const baseName = path.basename(file.name, path.extname(file.name))
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .replace(/^\.+/, '')
                .replace(/_+/g, '_')
                .substring(0, 50)
                || 'upload';
            const filename = `${Date.now()}-${baseName}${ext}`;
            const filePath = path.join(uploadsDir, filename);
            // Security: canonical path checks against workspace/uploads (symlink-safe)
            const canonicalWorkDir = fs.realpathSync.native(session.workDir);
            const canonicalUploadsDir = fs.realpathSync.native(uploadsDir);
            const canonicalFileDir = path.dirname(filePath);
            if (!canonicalUploadsDir.startsWith(canonicalWorkDir + path.sep)) {
                return c.json(error('Invalid upload directory', 'FORBIDDEN'), 403);
            }
            const canonicalTargetDir = fs.realpathSync.native(canonicalFileDir);
            if (!canonicalTargetDir.startsWith(canonicalUploadsDir + path.sep) && canonicalTargetDir !== canonicalUploadsDir) {
                return c.json(error('Invalid upload path', 'FORBIDDEN'), 403);
            }
            // Write file to disk
            const arrayBuffer = await file.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
            log.info('Image uploaded', {
                session: name,
                filename,
                size: file.size,
                type: file.type,
            });
            return c.json(success({
                url: path.relative(session.workDir, filePath),
                filename,
                size: file.size,
            }));
        }
        catch (err) {
            log.error('Upload failed', { session: name, error: String(err) });
            return c.json(error('Upload failed', 'UPLOAD_ERROR'), 500);
        }
    });
    return app;
};
//# sourceMappingURL=upload.js.map