---
source: GitHub, npm, Electron docs
library: keytar
package: keytar
topic: maintenance-status-alternatives-security
fetched: 2026-02-21T12:00:00Z
official_docs: https://github.com/atom/node-keytar (ARCHIVED)
---

# Keytar npm Package Research Report

## Executive Summary

⚠️ **CRITICAL: The `keytar` package is NO LONGER MAINTAINED.**

The repository was **archived on December 15, 2022** when GitHub sunset the Atom text editor. The last release was v7.9.0 on February 17, 2022. **Do NOT use keytar for new projects.**

---

## 1. Maintenance Status

### Current State: ARCHIVED/ABANDONED

| Aspect | Status |
|--------|--------|
| Repository | `atom/node-keytar` - **ARCHIVED** (Dec 15, 2022) |
| Last Release | v7.9.0 (Feb 17, 2022) |
| Open Issues | 67 (will never be fixed) |
| Maintenance | **None** - read-only repository |
| Reason | GitHub sunset the Atom text editor |

The farewell message from maintainers: https://github.blog/2022-06-08-sunsetting-atom/

### npm Status
- Package still available on npm as `keytar`
- Downloads still occur (many existing projects)
- No security updates will be released
- Node.js version compatibility not updated for new versions

---

## 2. Cross-Platform Support

### Official Support (at time of archival)

| Platform | Backend | Status |
|----------|---------|--------|
| **macOS** | Keychain Access | ✅ Working |
| **Windows** | Credential Vault (DPAPI) | ⚠️ Has issues |
| **Linux** | Secret Service API (libsecret) | ⚠️ Has issues |

### Platform-Specific Issues

#### macOS
- Generally works well
- Requires Keychain access (can prompt user)
- Blocks thread when collecting user input

#### Windows
- ❌ **Fails on Windows ARM** (Issue #479)
- ❌ Old credentials can reappear after deletion (Issue #455)
- ❌ Strange encoding errors in some cases (Issue #472)
- Service name concatenated with account name (Issue #470)

#### Linux
- ❌ **Crashes if keyring not unlocked** (Issue #477)
- ❌ **Fails on Alpine Linux** (Issue #461) - musl libc incompatibility
- Requires `libsecret` to be installed:
  - Debian/Ubuntu: `sudo apt-get install libsecret-1-dev`
  - Red Hat: `sudo yum install libsecret-devel`
  - Arch: `sudo pacman -S libsecret`
- Different secret stores: kwallet, kwallet5, kwallet6, gnome-libsecret
- Requires running desktop environment in many cases

---

## 3. Current Issues & Limitations

### Critical Open Issues (67 total)

1. **#479** - Fails to install on Windows ARM
2. **#477** - `findCredentials` crashes on Linux without unlocking key store
3. **#461** - Installation fails on Alpine Linux (Docker)
4. **#455** - Old Windows credential returns after deletion
5. **#472** - Strange encoding errors on Windows
6. **#464** - No support for binary keychain data (buffers)
7. **#470** - Windows concatenates service + account name

### Architectural Limitations

- **Native module** - Requires compilation with node-gyp
- **Prebuilt binaries** - Only for officially supported Node/Electron versions
- **Electron version lock** - New Electron versions may not have prebuilts
- **No ESM support** - CommonJS only
- **No TypeScript native support** - Types in DefinitelyTyped, not package

---

## 4. Modern Alternatives

### Recommended: Electron safeStorage API (Best for Electron Apps)

**Official Electron API** - Built into Electron since v15+

```javascript
const { safeStorage } = require('electron')

// Check availability
if (safeStorage.isEncryptionAvailable()) {
  // Encrypt
  const encrypted = safeStorage.encryptString('my-api-key')
  
  // Decrypt
  const decrypted = safeStorage.decryptString(encrypted)
}
```

**Advantages:**
- ✅ Actively maintained by Electron team
- ✅ No native module compilation
- ✅ Works with all Electron versions
- ✅ Cross-platform (macOS, Windows, Linux)
- ✅ Uses OS-level encryption

**Security by Platform:**
- **macOS**: Keychain (protected from other apps)
- **Windows**: DPAPI (protected per-user)
- **Linux**: kwallet/gnome-libsecret (varies by desktop)

**Note:** Data encrypted with safeStorage is NOT portable between machines - it's tied to the local OS credentials.

**Docs:** https://www.electronjs.org/docs/latest/api/safe-storage

---

### Alternative: keyring-rs (Rust-based)

**GitHub:** https://github.com/open-source-cooperative/keyring-rs

A Rust crate that provides cross-platform credential storage. Can be used via:
- Native Rust applications
- Python bindings (`rust-native-keyring`)
- Tauri applications (has official GUI)

**Advantages:**
- ✅ Actively maintained (v4.0.0-rc.3 as of Feb 2026)
- ✅ 701+ GitHub stars, 3.6k+ dependents
- ✅ Cross-platform (macOS, Windows, Linux, iOS, Android)
- ✅ Multiple credential store backends
- ✅ Better Linux support than keytar

---

### Alternative: Environment Variables + Encrypted Config

For non-Electron Node.js applications:

```javascript
// Use dotenv for development
require('dotenv').config()

// Use OS environment variables in production
const apiKey = process.env.API_KEY

// For sensitive data, encrypt at rest
const crypto = require('crypto')
const algorithm = 'aes-256-gcm'
```

**Advantages:**
- ✅ No native dependencies
- ✅ Works everywhere
- ✅ 12-factor app compliant
- ✅ Easy CI/CD integration

**Limitations:**
- Not as secure as OS keychain
- Environment variables visible to process

---

### Alternative: OS-Specific Packages

For targeted platform support:

| Platform | Package | Notes |
|----------|---------|-------|
| macOS only | `keychain` | Native Keychain access |
| Windows only | `node-windows` | Windows credential manager |
| Linux only | `secret-storage` | libsecret bindings |

---

## 5. Security Concerns

### General Security Model

Keytar uses OS-level credential storage, which is generally secure:

| Platform | Security Level | Notes |
|----------|----------------|-------|
| macOS | High | Keychain encrypted, protected from other apps |
| Windows | Medium | DPAPI encrypted, per-user but accessible by other apps |
| Linux | Variable | Depends on secret store; `basic_text` is INSECURE |

### Security Issues

1. **Linux `basic_text` fallback**
   - If no secret store available, uses hardcoded plaintext password
   - This is NOT secure - credentials stored in plain text
   - Must detect with `safeStorage.getSelectedStorageBackend() === 'basic_text'`

2. **Process memory exposure**
   - Decrypted passwords exist in process memory
   - Could be read by debuggers or memory dumps
   - Standard limitation of all credential managers

3. **No encryption at rest for Linux without secret store**
   - Server environments often lack desktop secret stores
   - CI/CD pipelines typically have no keyring

4. **Windows app isolation**
   - Other apps in same user space can access credentials
   - Not isolated per-application

### Security Best Practices

1. **Never log credentials** retrieved from keychain
2. **Clear memory** after using credentials (set to null)
3. **Detect `basic_text`** on Linux and warn user
4. **Use environment variables** for CI/CD
5. **Consider Electron safeStorage** for better Linux detection

---

## 6. Recommendation for OpenSofa

Given the architecture doc recommends keytar for API key storage:

### ⚠️ DO NOT USE keytar

The package is abandoned and has unfixed critical bugs.

### ✅ Recommended Approach

**For Electron Apps:**
```javascript
// Use Electron's built-in safeStorage API
const { safeStorage } = require('electron')

class SecureStorage {
  async getApiKey(service) {
    const encrypted = await this.loadEncrypted(service)
    if (!encrypted) return null
    return safeStorage.decryptString(encrypted)
  }
  
  async setApiKey(service, key) {
    const encrypted = safeStorage.encryptString(key)
    await this.saveEncrypted(service, encrypted)
  }
}
```

**For CLI/Server Apps:**
- Use environment variables for secrets
- Consider `dotenv-vault` or similar for encrypted .env files
- For user credentials, consider OS-specific solutions

**For Tauri Apps:**
- Use keyring-rs via Rust bindings
- Has official Tauri integration

---

## Summary Table

| Criteria | keytar | Electron safeStorage | keyring-rs |
|----------|--------|---------------------|------------|
| Maintenance | ❌ Abandoned | ✅ Active | ✅ Active |
| macOS | ✅ | ✅ | ✅ |
| Windows | ⚠️ Bugs | ✅ | ✅ |
| Linux | ⚠️ Bugs | ⚠️ Variable | ✅ Better |
| Windows ARM | ❌ Broken | ✅ | ✅ |
| Alpine/Docker | ❌ Broken | ⚠️ | ✅ |
| Native Module | Yes | No (built-in) | Yes (Rust) |
| Security | Good | Good | Good |

---

## References

- Keytar GitHub (archived): https://github.com/atom/node-keytar
- Keytar Issues: https://github.com/atom/node-keytar/issues
- Electron safeStorage: https://www.electronjs.org/docs/latest/api/safe-storage
- keyring-rs: https://github.com/open-source-cooperative/keyring-rs
- Atom Sunset Announcement: https://github.blog/2022-06-08-sunsetting-atom/
