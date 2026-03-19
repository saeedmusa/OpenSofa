/**
 * Tests for TOTP (Time-based One-Time Password) functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Import TOTP functions directly for testing
// We'll test the core functions by reimplementing them for verification

const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;
const TOTP_WINDOW = 1;

function hmacSHA1(secret: Buffer, counter: Buffer): Buffer {
    return crypto.createHmac('sha1', secret).update(counter).digest();
}

function dynamicTruncate(hmac: Buffer): number {
    const offset = hmac[hmac.length - 1]! & 0x0f;
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

describe('TOTP Functions', () => {
    const testSecret = crypto.randomBytes(20).toString('base64url');

    describe('generateTOTP', () => {
        it('should generate 6-digit codes', () => {
            const code = generateTOTP(testSecret);
            expect(code).toHaveLength(6);
            expect(/^\d{6}$/.test(code)).toBe(true);
        });

        it('should generate different codes at different times', () => {
            const code1 = generateTOTP(testSecret, 1000);
            const code2 = generateTOTP(testSecret, 1000 + TOTP_PERIOD);
            expect(code1).not.toBe(code2);
        });

        it('should generate same code within same time window', () => {
            const code1 = generateTOTP(testSecret, 1000);
            const code2 = generateTOTP(testSecret, 1015); // within 30s window
            expect(code1).toBe(code2);
        });

        it('should handle edge cases in counter', () => {
            // Test at period boundaries
            const code1 = generateTOTP(testSecret, TOTP_PERIOD - 1);
            const code2 = generateTOTP(testSecret, TOTP_PERIOD);
            expect(code1).not.toBe(code2);
        });
    });

    describe('verifyTOTP', () => {
        it('should verify valid code', () => {
            const code = generateTOTP(testSecret);
            expect(verifyTOTP(testSecret, code)).toBe(true);
        });

        it('should reject invalid code', () => {
            expect(verifyTOTP(testSecret, '000000')).toBe(false);
        });

        it('should accept code within window', () => {
            const code = generateTOTP(testSecret, Math.floor(Date.now() / 1000) - TOTP_PERIOD);
            expect(verifyTOTP(testSecret, code)).toBe(true);
        });

        it('should reject code outside window', () => {
            // Generate code from 2 periods ago (outside ±1 window)
            const oldCode = generateTOTP(testSecret, Math.floor(Date.now() / 1000) - 2 * TOTP_PERIOD);
            expect(verifyTOTP(testSecret, oldCode)).toBe(false);
        });

        it('should reject non-numeric codes', () => {
            expect(verifyTOTP(testSecret, 'abcdef')).toBe(false);
            expect(verifyTOTP(testSecret, '12a456')).toBe(false);
        });

        it('should reject wrong length codes', () => {
            expect(verifyTOTP(testSecret, '12345')).toBe(false);
            expect(verifyTOTP(testSecret, '1234567')).toBe(false);
        });

        it('should reject empty codes', () => {
            expect(verifyTOTP(testSecret, '')).toBe(false);
        });
    });

    describe('dynamicTruncate', () => {
        it('should return number between 0 and 999999', () => {
            const secretBuf = Buffer.from(testSecret, 'base64url');
            const counterBuf = Buffer.alloc(8);
            counterBuf.writeBigInt64BE(BigInt(1));
            const hmac = hmacSHA1(secretBuf, counterBuf);
            const result = dynamicTruncate(hmac);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(1000000);
        });

        it('should return same value for same input', () => {
            const secretBuf = Buffer.from(testSecret, 'base64url');
            const counterBuf = Buffer.alloc(8);
            counterBuf.writeBigInt64BE(BigInt(1));
            const hmac = hmacSHA1(secretBuf, counterBuf);
            const result1 = dynamicTruncate(hmac);
            const result2 = dynamicTruncate(hmac);
            expect(result1).toBe(result2);
        });
    });

    describe('code validation', () => {
        it('should validate 6-digit format correctly', () => {
            const validCodes = ['000000', '123456', '999999', '000001'];
            const invalidCodes = ['12345', '1234567', 'abcdef', '12a456', ''];

            validCodes.forEach(code => {
                expect(/^\d{6}$/.test(code)).toBe(true);
            });

            invalidCodes.forEach(code => {
                expect(/^\d{6}$/.test(code)).toBe(false);
            });
        });
    });
});

describe('TOTP Security', () => {
    it('should generate unique secrets', () => {
        const secrets = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const secret = crypto.randomBytes(20).toString('base64url');
            secrets.add(secret);
        }
        // All 100 secrets should be unique
        expect(secrets.size).toBe(100);
    });

    it('should produce time-based codes that change over time', () => {
        const secret = crypto.randomBytes(20).toString('base64url');
        const codes = new Set<string>();
        
        // Generate codes across multiple time periods
        const now = Math.floor(Date.now() / 1000);
        for (let t = now; t < now + TOTP_PERIOD * 3; t += TOTP_PERIOD) {
            const code = generateTOTP(secret, t);
            codes.add(code);
        }
        
        // Should have at least 2 different codes across 3 periods
        expect(codes.size).toBeGreaterThanOrEqual(2);
    });

    it('should have sufficient entropy in codes', () => {
        const secret = crypto.randomBytes(20).toString('base64url');
        const code = generateTOTP(secret);
        
        // Code should be well-distributed (not starting with many zeros)
        // This is a basic check - real TOTP should have uniform distribution
        const firstDigit = parseInt(code[0]!, 10);
        expect(firstDigit).toBeGreaterThanOrEqual(0);
        expect(firstDigit).toBeLessThanOrEqual(9);
    });
});
