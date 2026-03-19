---
source: Official docs (ntfy.sh)
library: ntfy.sh
package: ntfy
topic: overview, security, rate limits, production readiness
fetched: 2026-02-21T12:00:00Z
official_docs: https://ntfy.sh/docs/
---

# ntfy.sh - Push Notification Service

## Overview

ntfy (pronounced "notify") is a simple HTTP-based pub-sub notification service that lets you **send push notifications to your phone or desktop via scripts from any computer**, using simple HTTP PUT or POST requests.

### How it Works

1. **Topics**: Messages are published to "topics" (like channels). Topics are created on-the-fly by subscribing or publishing to them.
2. **No signup required**: You can use the public ntfy.sh server without creating an account.
3. **HTTP-based**: Send messages with simple curl commands or any HTTP client.
4. **Multi-platform**: Apps available for Android (Google Play, F-Droid), iOS (App Store), web, and desktop.

### Basic Usage

```bash
# Send a message
curl -d "Backup successful" ntfy.sh/mytopic

# Or with more features
curl \
  -H "Title: Unauthorized access detected" \
  -H "Priority: urgent" \
  -H "Tags: warning,skull" \
  -d "Remote access detected" \
  ntfy.sh/my_alerts
```

---

## Click Action / Deep Linking

**YES, ntfy.sh supports deep linking via the `Click` header.**

### Usage

Use the `X-Click` header (or alias `Click`) to define which URL opens when the notification is tapped:

```bash
curl \
  -d "New messages on Reddit" \
  -H "Click: https://www.reddit.com/message/messages" \
  ntfy.sh/reddit_alerts
```

### Supported URL Schemes

- `http://` or `https://` - Opens browser (or registered app)
- `mailto:` - Opens mail app
- `geo:` - Opens Google Maps
- `ntfy://` - Opens ntfy app
- `twitter://` - Opens Twitter
- Custom URL schemes - Opens registered app

### Example for PWA Deep Link

```bash
curl \
  -H "Click: myapp://open/detail/123" \
  -d "Check this item" \
  ntfy.sh/mytopic
```

**Note**: For iOS PWAs, custom URL schemes need to be properly registered. Standard `https://` links may open in Safari rather than your PWA.

---

## Rate Limits & Reliability

### Default Rate Limits (ntfy.sh)

| Limit Type | Value |
|------------|-------|
| Request burst | 60 requests |
| Sustained rate | 1 request per 10 seconds |
| Message size | 4,096 bytes |
| Attachment size | 15 MB |
| Total attachment storage per visitor | 100 MB |
| Attachment daily bandwidth | 500 MB |
| Email notifications | Limited (burst + daily) |

### Rate Limit Configuration (self-hosted)

Key config options for tuning:
- `visitor-request-limit-burst` - Burst limit (default: 60)
- `visitor-request-limit-replenish` - Replenish rate (default: 10s)
- `visitor-message-daily-limit` - Daily message limit (default: 0 = unlimited)
- `visitor-email-limit-burst` - Email burst limit (default: 16)
- `visitor-email-limit-daily` - Daily email limit (default: 300)

### Reliability Considerations

**From the official docs (FAQ):**

> "What are the uptime guarantees? **Best effort.**
> 
> ntfy currently runs on a single DigitalOcean droplet, without any scale out strategy or redundancies. When the time comes, I'll add scale out features, but for now it is what it is."

Key points:
- Single server deployment (no redundancy)
- No formal SLA
- "Best effort" availability
- Messages cached for 12 hours by default (in-memory)
- Attachments cached for 3 hours by default

---

## Production Suitability

### Pros ✅
- Simple HTTP API, easy to integrate
- Self-hostable with full control
- Open source (Apache 2.0 / GPLv2)
- No signup required for basic usage
- Active development and community
- Web Push support (for browsers)
- Firebase Cloud Messaging for mobile push

### Cons ⚠️
- **Single point of failure** on ntfy.sh (single server)
- **No formal SLA** - "best effort" only
- **Messages not encrypted** at rest
- **Topic names are public** (unless using ACLs)
- **iOS app is "bare bones and buggy"** (per docs)
- **No message delivery guarantees**

### Recommendations

**For production use, the official docs recommend:**

1. **Self-host** your own ntfy server
2. Configure proper **access controls (ACLs)**
3. Set up **redundancy** yourself
4. Use **HTTPS/TLS** 
5. Consider **message caching** with persistent storage (`cache-file` option)

---

## Security Concerns

### 1. Topic Names Are Public

> "If you don't have ACLs set up, **the topic name is your password**. If you choose an easy-to-guess/dumb topic name, people will be able to guess it."

- Use random, hard-to-guess topic names
- Or configure access control with `auth-default-access: deny-all`

### 2. No End-to-End Encryption

- Messages are transmitted over HTTPS (TLS)
- Messages stored in plaintext in cache (12h default)
- Server operators can read message content

### 3. Third-Party Data Sharing

When using ntfy.sh (not self-hosted):
- **Firebase Cloud Messaging (FCM)** - Message content transmitted through Google
- **Amazon SES** - For email delivery
- **Twilio** - For phone call notifications
- **Stripe** - For payments

### 4. Brute Force Protection

Rate limiting prevents brute forcing topic names:
- 60 request burst, then 1 request per 10 seconds
- fail2ban on ntfy.sh for persistent attackers
- For a 10-character random topic: ~64^10 combinations = "many years to brute force"

### 5. Self-Hosting for Full Control

For sensitive applications:
- Self-host to avoid third-party data sharing
- Disable Firebase if desired (F-Droid app or self-hosted)
- Configure your own TLS certificates
- Control all data retention

---

## iOS-Specific Notes

### Current iOS App Status (from docs)

> "The iOS is very bare bones and quite frankly a little buggy. I wanted to get something out the door to make the iOS users happy, but halfway through I got frustrated with iOS development and paused development."

### iOS Push Notifications

- Uses **Firebase Cloud Messaging** via Apple Push Notification service
- **Instant delivery not available on iOS** (Android only)
- Background notifications work via APNS through FCM

### For iOS PWAs (Safari)

- Standard `https://` click URLs open in **Safari**, not the PWA
- Custom URL schemes would need app registration
- Consider using **Web Push** API for browser-based notifications instead

---

## Summary for iOS Background Push Use Case

### Can ntfy.sh work for iOS background push?

**Partially:**
- ✅ iOS app can receive push notifications via FCM/APNS
- ⚠️ iOS app is immature and may have issues
- ❌ "Click" deep links may not open PWA directly
- ⚠️ No guaranteed delivery or reliability

### Recommendation for Production

If using for iOS background push in production:

1. **Self-host** ntfy.sh server for control
2. **Test thoroughly** with iOS app
3. **Have fallback mechanism** for missed notifications
4. **Consider Web Push** as alternative for PWA
5. **Use random topic names** with access controls

---

## Links

- Official Docs: https://ntfy.sh/docs/
- Publishing Guide: https://ntfy.sh/docs/publish/
- Configuration: https://ntfy.sh/docs/config/
- Privacy Policy: https://ntfy.sh/docs/privacy/
- Terms of Service: https://ntfy.sh/docs/terms/
- GitHub: https://github.com/binwiederhier/ntfy
- Status Page: https://ntfy.statuspage.io/
