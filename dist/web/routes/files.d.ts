/**
 * OpenSofa Web - Files API Routes
 *
 * REST endpoints for browsing and viewing files in session worktrees.
 */
import { Hono } from 'hono';
/**
 * Detect language from file extension
 */
export declare const detectLanguage: (filePath: string) => string;
/**
 * Format file size for display
 */
export declare const formatFileSize: (bytes: number) => string;
export interface FilesRoutesDeps {
    getSession: (name: string) => {
        workDir: string;
    } | null;
}
export declare const createFilesRoutes: (deps: FilesRoutesDeps) => Hono;
//# sourceMappingURL=files.d.ts.map