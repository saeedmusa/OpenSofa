import { db } from '../db.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('web:ip-ban');
export function isIpBanned(ip) {
    try {
        const row = db.prepare('SELECT banned_until FROM ip_bans WHERE ip_address = ?').get(ip);
        if (!row)
            return false;
        return Date.now() < row.banned_until;
    }
    catch (err) {
        log.error('Failed to check IP ban status', { ip, error: String(err) });
        return false;
    }
}
export function recordIpStrike(ip, maxStrikes = 5, banDurationMs = 24 * 60 * 60 * 1000, strikeWindowMs = 10 * 60 * 1000) {
    try {
        const now = Date.now();
        // Check existing strikes
        const existing = db.prepare('SELECT strike_count, last_strike FROM ip_bans WHERE ip_address = ?').get(ip);
        let newStrikes = 1;
        if (existing) {
            // If the last strike was within the rolling window, increment the strike count
            if ((now - existing.last_strike) < strikeWindowMs) {
                newStrikes = existing.strike_count + 1;
            }
            // Otherwise, the window expired, so reset to 1 strike (handled by default `newStrikes = 1` above)
        }
        let bannedUntil = 0;
        if (newStrikes >= maxStrikes) {
            bannedUntil = now + banDurationMs;
            log.warn('IP permanently banned for token guessing', { ip, bannedUntil, strikes: newStrikes });
        }
        db.prepare(`
      INSERT INTO ip_bans (ip_address, banned_until, strike_count, last_strike)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(ip_address) DO UPDATE SET
        banned_until = excluded.banned_until,
        strike_count = excluded.strike_count,
        last_strike = excluded.last_strike
    `).run(ip, bannedUntil, newStrikes, now);
    }
    catch (err) {
        log.error('Failed to record IP strike', { ip, error: String(err) });
    }
}
//# sourceMappingURL=ip-ban.js.map