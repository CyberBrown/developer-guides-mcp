---
id: cloudflare-access-service-tokens
title: Cloudflare Access Service Tokens for MCP Servers
category: security
type: guide
status: finalized
version: "1.0"
last_updated: "2025-12-12"
tags:
  - auth
  - cloudflare
  - mcp
  - zero-trust
  - service-tokens
---

# Cloudflare Access Service Tokens for MCP Servers

## Overview

Machine-to-machine authentication for MCP servers using Cloudflare Access Service Tokens. Eliminates email OTP requirements and works with headless/CLI environments like Claude Code.

## Why Service Tokens

- **No email OTP every session** - tokens authenticate automatically
- **Centralized management** - manage all tokens in CF Zero Trust dashboard (one place)
- **Easy revocation** - revoke/rotate tokens without redeploying workers
- **Multi-worker coverage** - one token can protect multiple workers

## Setup Steps

### 1. Create Service Token

Navigate to: **Zero Trust → Access → Service credentials → Add service token**

- Name descriptively (e.g., `mcp-services`, `dev-tools-access`)
- Duration: 1 year (recommended)
- **SAVE BOTH VALUES** - the secret is only shown once!
- Client ID ends in `.access`

### 2. Create Access Application

Navigate to: **Zero Trust → Applications → Add → Self-hosted**

- Set subdomain + domain for your worker (e.g., `myworker.workers.dev`)
- Session duration: 24 hours
- Add any additional identity providers if needed for browser access

### 3. Add Service Auth Policy

In the application configuration → **Add policy**:

- **Action:** Service Auth
- **Selector:** Service Token → select your token

This allows the service token to bypass interactive authentication.

### 4. Remove Worker Internal Auth (Optional)

Let Cloudflare Access be the single auth layer. If your worker has internal auth:

```bash
bunx wrangler secret delete AUTH_TOKEN --name your-worker
```

This simplifies your auth model - CF Access handles everything.

### 5. Configure MCP Clients

#### Claude.ai Connectors

Add headers in the connector settings UI:
- `CF-Access-Client-Id`: your-id.access
- `CF-Access-Client-Secret`: your-secret

#### Claude Code (mcp-manager)

Use stdio transport with mcp-remote proxy:

```json
{
  "command": "npx",
  "args": [
    "mcp-remote",
    "https://worker.workers.dev/mcp",
    "--header", "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}",
    "--header", "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}"
  ],
  "type": "stdio"
}
```

Export credentials in your `.bashrc` or `.zshrc`:

```bash
export CF_ACCESS_CLIENT_ID="your-id.access"
export CF_ACCESS_CLIENT_SECRET="your-secret"
```

**IMPORTANT:** `type: "http"` with headers does NOT work in Claude Code - you must use stdio + mcp-remote.

## Testing

Verify your setup with curl:

```bash
curl -I \
  -H "CF-Access-Client-Id: your-id.access" \
  -H "CF-Access-Client-Secret: your-secret" \
  https://your-worker.workers.dev/
```

- **200** = credentials working
- **403** = credentials likely swapped or invalid

## Common Gotchas

| Issue | Solution |
|-------|----------|
| ID ends in `.access`, Secret is long hex | Don't swap them - ID is short with `.access` suffix |
| Special characters in secret | Quote values in .env files |
| Variables not expanding | mcp-manager expands `${VAR}` in env but NOT in args - use shell exports |
| 403 despite correct creds | Check policy is "Service Auth" not "Allow" |

## Anti-patterns

### Don't name tokens after specific apps
Bad: `nexus-token`, `mnemo-token`
Good: `mcp-services`, `dev-tools`

One token should cover multiple related services.

### Don't keep both CF Access AND internal auth
Pick one auth layer. Having both creates confusion and maintenance burden.

### Don't store placeholder values
If you're syncing secrets across environments, don't commit placeholders like `your-secret-here`. Either use real values or omit the secret entirely.

## Security Considerations

- Store service token secrets securely (password manager, encrypted env)
- Rotate tokens annually or after team member departures
- Use separate tokens for production vs development
- Monitor Access logs for unusual patterns

## Related Resources

- [Cloudflare Access Service Tokens Docs](https://developers.cloudflare.com/cloudflare-one/identity/service-tokens/)
- [MCP Remote Proxy](https://github.com/anthropics/mcp-remote)
- [Zero Trust Dashboard](https://one.dash.cloudflare.com/)
