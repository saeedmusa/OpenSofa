---
source: NPM Registry API + GitHub
library: cloudflared tunneling
topic: npm package research
fetched: 2026-02-21T12:00:00Z
official_docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
---

# Cloudflared NPM Package Research

## Executive Summary

**⚠️ CRITICAL FINDING: The documentation claims are inaccurate.**

The project docs claim a "bundled relay tunnel using cloudflared npm package" but:
1. **No official `cloudflared` npm package exists**
2. The community wrapper packages require the cloudflared binary to be pre-installed
3. `loca.lt` URLs are from a completely different service (localtunnel), NOT Cloudflare

---

## 1. Does an Official `cloudflared` NPM Package Exist?

**NO.** 

- The official `cloudflared` is a **Go binary** distributed by Cloudflare
- It's available as: standalone binary, Docker image, Homebrew, Debian/RPM packages
- Repository: https://github.com/cloudflare/cloudflared (13.2k stars, actively maintained)
- **There is NO official npm wrapper published by Cloudflare**

---

## 2. Community NPM Packages (Limited Quality)

### `node-cloudflared-tunnel` (Most relevant)
- **Package**: `node-cloudflared-tunnel`
- **Version**: 1.0.10 (last updated Oct 2022)
- **Stars**: 11 GitHub stars, 3 forks
- **Author**: Louis Lam
- **License**: MIT
- **⚠️ Requirements**: 
  - **cloudflared binary MUST be pre-installed** 
  - Requires a Cloudflare Tunnel token from Zero Trust dashboard

```javascript
import { CloudflaredTunnel } from "node-cloudflared-tunnel";

let tunnel = new CloudflaredTunnel();
tunnel.token = "<YOUR TOKEN>";  // Requires pre-existing Cloudflare setup!
tunnel.start();
```

**Capabilities**: Simply spawns the cloudflared binary as a child process. Does NOT bundle it.

### Other packages found (DNS-only, not tunneling):
- `cloudflarednsedit` - DNS editor only
- `cloudflaredjs` - DNS record management only
- `@neferett/cloudflaredns` - DNS only

---

## 3. What About `loca.lt`?

**`loca.lt` is NOT Cloudflare - it's a completely different service!**

### Localtunnel (`npm install -g localtunnel`)
- **Package**: `localtunnel`
- **Version**: 2.0.2 (last updated Sept 2021)
- **Stars**: 14,378 GitHub stars
- **URL format**: `https://xyz.loca.lt` or `https://xyz.localtunnel.me`
- **Service**: Free, community-run tunneling service
- **No account required** - truly zero-config

```javascript
const localtunnel = require('localtunnel');

const tunnel = await localtunnel({ port: 3000 });
// tunnel.url = "https://abcdefgjhij.loca.lt"
```

**⚠️ Important**: This is a DIFFERENT service from Cloudflare Tunnel. The docs are conflating two different technologies.

---

## 4. Stability & Maintenance Comparison

| Package | Last Update | Activity | Downloads/week | Maintenance |
|---------|-------------|----------|----------------|-------------|
| **Official cloudflared binary** | Feb 2026 | Active | N/A (binary) | ✅ Excellent |
| **node-cloudflared-tunnel** | Oct 2022 | Stale | ~1,000 | ⚠️ Low |
| **localtunnel** | Sept 2021 | Stale | ~66,000 | ⚠️ Low |

---

## 5. Limitations & Security Considerations

### node-cloudflared-tunnel
- **NOT bundled** - requires separate binary installation
- Requires Cloudflare account and token setup
- Not a true "zero-config" solution
- Community package, low maintenance

### localtunnel (loca.lt)
- **Free but unreliable** - servers often down
- **No authentication** on tunnel URLs
- **Rate limited** - not suitable for production
- **Public URLs** - anyone with URL can access
- Community-run, no SLA

### Official cloudflared (TryCloudflare quick tunnels)
```bash
cloudflared tunnel --url http://localhost:3000
# Outputs: https://xyz.trycloudflare.com
```
- **Truly zero-config** for quick tunnels
- **Reliable** - run by Cloudflare
- **Requires binary installation** (not npm)
- URLs are random, change each session
- For persistent URLs, need Cloudflare account

---

## 6. Documentation Accuracy Issues

Your docs contain several inaccuracies:

| Claim in Docs | Reality |
|---------------|---------|
| "bundled relay tunnel using cloudflared npm" | No bundled npm package exists |
| "zero-config" with cloudflared npm | Requires binary + Cloudflare account |
| URLs like `https://xyz.loca.lt` | That's localtunnel, NOT Cloudflare |
| "stable tunnels" via npm package | Community wrapper is stale |

---

## 7. Recommendations

### Option A: Use official cloudflared binary (Recommended)
```bash
# Install cloudflared via Homebrew
brew install cloudflare/cloudflare/cloudflared

# Quick tunnel (zero-config, no account needed)
cloudflared tunnel --url http://localhost:3285
```

**Pros**: Stable, maintained, official
**Cons**: Requires binary installation, not pure npm

### Option B: Use localtunnel npm package
```javascript
import localtunnel from 'localtunnel';
const tunnel = await localtunnel({ port: 3285 });
```

**Pros**: Pure npm, truly zero-config, generates `*.loca.lt` URLs
**Cons**: Unreliable servers, no auth, rate limited

### Option C: Ship cloudflared binary with app
- Download the binary during npm install (postinstall script)
- Use `node-cloudflared-tunnel` or spawn directly
- More complex but most reliable

---

## Official Documentation Links

- **Cloudflare Tunnel**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **TryCloudflare (quick tunnels)**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/do-more-with-tunnels/trycloudflare/
- **localtunnel**: https://github.com/localtunnel/localtunnel
