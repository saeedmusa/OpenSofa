/**
 * OpenSofa Web - TOTP Routes
 *
 * Endpoints for TOTP (Time-based One-Time Password) setup and verification.
 * Used for step-up authentication before destructive commands (US-13).
 *
 * Architecture Ref: §1.3, USER_STORIES.md US-13
 */

import { Hono } from 'hono';
import { createLogger } from '../../utils/logger.js';
import { success, error } from '../types.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const log = createLogger('web:routes:totp');

// ──────────────────────────────────────
// TOTP Configuration
// ──────────────────────────────────────

const TOTP_ISSUER = 'OpenSofa';
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // seconds
const TOTP_WINDOW = 1; // ±1 step tolerance

// ──────────────────────────────────────
// HMAC-based OTP (RFC 4226 / 6238)
// ──────────────────────────────────────

function generateSecret(): string {
    return crypto.randomBytes(20).toString('base64url');
}

function hmacSHA1(secret: Buffer, counter: Buffer): Buffer {
    return crypto.createHmac('sha1', secret).update(counter).digest();
}

function dynamicTruncate(hmac: Buffer): number {
    const offset = hmac[hmac.length - 1]! & 0x0f;
    if (offset + 4 > hmac.length) throw new Error('Invalid HMAC');
    const code =
        ((hmac[offset]! & 0x7f) << 24) |
        ((hmac[offset + 1]! & 0xff) << 16) |
        ((hmac[offset + 2]! & 0xff) << 8) |
        (hmac[offset + 3]! & 0xff);
    return code % Math.pow(10, TOTP_DIGITS);
}

function generateTOTP(secret: string, time?: number): string {
    const t = time ?? Math.floor(Date.now() / 1000);
    const counter = Math.floor(t / TOTP_PERIOD);
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigInt64BE(BigInt(counter));
    const secretBuf = Buffer.from(secret, 'base64url');
    const hmac = hmacSHA1(secretBuf, counterBuf);
    const code = dynamicTruncate(hmac);
    return code.toString().padStart(TOTP_DIGITS, '0');
}

function verifyTOTP(secret: string, code: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
        const expected = generateTOTP(secret, now + i * TOTP_PERIOD);
        if (expected === code) return true;
    }
    return false;
}

function generateOTPAuthURI(secret: string, account: string): string {
    const base32Secret = Buffer.from(secret, 'base64url').toString('base64').replace(/=/g, '');
    return `otpauth://totp/${encodeURIComponent(TOTP_ISSUER)}:${encodeURIComponent(account)}?secret=${base32Secret}&issuer=${encodeURIComponent(TOTP_ISSUER)}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

// ──────────────────────────────────────
// Secret Storage (AES-256-GCM encrypted)
// ──────────────────────────────────────

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
    const secret = process.env.OPENSOFA_SECRET;
    if (!secret) {
        throw new Error('OPENSOFA_SECRET environment variable is required for TOTP encryption');
    }
    return crypto.createHash('sha256').update(secret).digest();
}

function getSecretPath(): string {
    const configDir = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || '~', '.config');
    return path.join(configDir, 'opensofa', 'totp.enc');
}

function loadSecret(): string | null {
    try {
        const secretPath = getSecretPath();
        if (!fs.existsSync(secretPath)) return null;

        const data = fs.readFileSync(secretPath);
        if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;

        const iv = data.subarray(0, IV_LENGTH);
        const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decrypted.toString('utf-8');
    } catch {
        return null;
    }
}

function saveSecret(secret: string): void {
    const secretPath = getSecretPath();
    const dir = path.dirname(secretPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(secret, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Store as: IV (16 bytes) + auth tag (16 bytes) + ciphertext
    const payload = Buffer.concat([iv, authTag, encrypted]);
    fs.writeFileSync(secretPath, payload, { mode: 0o600 });
}

// ──────────────────────────────────────
// Route Factory
// ──────────────────────────────────────

export const createTOTPRoutes = (expectedToken: string): Hono => {
    const app = new Hono();

    // All TOTP routes require authentication
    app.use('*', createAuthMiddleware({ expectedToken }));

    // GET /api/totp/status — Check if TOTP is configured
    app.get('/status', (c) => {
        const secret = loadSecret();
        return c.json(success({ configured: secret !== null }));
    });

    // POST /api/totp/setup — Generate new TOTP secret + QR URI
    app.post('/setup', (c) => {
        const existing = loadSecret();
        if (existing) {
            return c.json(error('TOTP already configured. Delete existing secret first.', 'ALREADY_CONFIGURED'), 409);
        }

        const secret = generateSecret();
        saveSecret(secret);

        const hostname = process.env.HOSTNAME || 'dev-machine';
        const qrUri = generateOTPAuthURI(secret, hostname);

        log.info('TOTP configured', { account: hostname });

        return c.json(success({ qrUri }));
    });

    // POST /api/totp/verify — Validate a 6-digit TOTP code
    app.post('/verify', async (c) => {
        const secret = loadSecret();
        if (!secret) {
            return c.json(error('TOTP not configured', 'NOT_CONFIGURED'), 400);
        }

        let body: { code?: string };
        try {
            body = await c.req.json();
        } catch {
            return c.json(error('Invalid request body', 'BAD_REQUEST'), 400);
        }

        const code = body.code?.trim();
        if (!code || !/^\d{6}$/.test(code)) {
            return c.json(error('Code must be exactly 6 digits', 'INVALID_CODE'), 400);
        }

        const valid = verifyTOTP(secret, code);

        if (!valid) {
            log.warn('TOTP verification failed');
            return c.json(success({ valid: false }));
        }

        log.info('TOTP verification succeeded');
        return c.json(success({ valid: true }));
    });

    return app;
};
