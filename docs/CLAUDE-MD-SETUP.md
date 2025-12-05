# Setting Up Developer Guides MCP Server in CLAUDE.md

> **Version:** 1.1.0
> **Last Updated:** 2024-12-04

This guide explains how to configure Claude Code to use the Developer Guides MCP server for accessing coding standards and best practices.

## ⚠️ First Step: Verify Your Setup

**Before using the Developer Guides MCP server, always verify your local `CLAUDE.md` is configured correctly:**

1. Check that your project's `CLAUDE.md` contains the "Developer Guidelines (MCP Server)" section
2. Verify the version comment matches this document's version (see template below)
3. If outdated or missing, copy the latest template from Step 2

To check for updates, review the latest version of this file in the developer-guides-mcp repository.

## Features

- **Full-text search** across all developer guides with highlighted snippets
- **Semantic search** using vector embeddings for natural language queries
- **Guide retrieval** with section-level granularity
- **Related guides** discovery based on metadata relationships
- **Change proposals** for suggesting documentation improvements

## Step 1: Configure the MCP Server

Add the MCP server to your Claude Code configuration. You can do this via:

### Option A: Using `/mcp` command
Run `/mcp` in Claude Code and add a new server with:
- **Name**: `development-guide`
- **Command**: `npx`
- **Args**: `mcp-remote`, `https://developer-guides-mcp.solamp.workers.dev/mcp`

### Option B: Edit `.claude.json` directly
Add to your project's `mcpServers` section:
```json
{
  "mcpServers": {
    "development-guide": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://developer-guides-mcp.solamp.workers.dev/mcp"
      ]
    }
  }
}
```

## Step 2: Add to CLAUDE.md

Add the following section to your project's `CLAUDE.md` file:

```markdown
<!-- Developer Guides MCP Setup v1.1.0 - Check for updates: docs/CLAUDE-MD-SETUP.md -->
## Developer Guidelines (MCP Server)

### Required: Check Before Implementing

ALWAYS search the developer guides before:
- Writing new functions or modules
- Implementing error handling
- Adding validation logic
- Creating API endpoints
- Writing database queries
- Adding authentication or security features

This is not optional - established patterns must be followed for consistency and security.

### Quick Reference

| Task | Search Query |
|------|-------------|
| Input validation | `query="zod validation"` |
| Error handling | `query="error classes"` |
| API security | `query="authentication middleware"` |
| Database queries | `query="parameterized queries"` |
| Testing patterns | `query="unit test"` |
| Logging/monitoring | `query="observability"` |

### How to Access

Search by topic:
```
mcp__development-guide__search_developer_guides query="validation"
```

Get specific guide:
```
mcp__development-guide__get_guide guideId="guide-07-security"
mcp__development-guide__get_guide guideId="guide-01-fundamentals"
```

List all available guides:
```
mcp__development-guide__list_guides
```

### Available Guides

| Guide | Use For |
|-------|---------|
| `guide-01-fundamentals` | Code organization, naming, error handling, types |
| `guide-02-11-arch-devops` | Architecture patterns, CI/CD, deployment |
| `guide-05-10-db-perf` | Database schemas, queries, performance |
| `guide-07-security` | Validation, auth, secrets, CORS, rate limiting |
| `guide-09-testing` | Unit, integration, E2E testing patterns |
| `Cloudflare-Workers-Guide` | Cloudflare Workers patterns, bindings, KV, D1 |
| `Frontend-Development-Guide` | Frontend patterns, components, state management |
| `AI and Observability-Guide` | AI integration, logging, monitoring, tracing |

### Key Patterns to Follow
- Use Zod schemas for all input validation
- Use custom error classes (`AppError`, `ValidationError`, `NotFoundError`)
- Never concatenate SQL queries - use parameterized queries
- Store secrets in environment variables, never in code

### Improving the Guides

If you find gaps, outdated patterns, or better approaches while working:
```
mcp__development-guide__propose_guide_change guideId="guide-07-security" section="Authentication" currentText="..." proposedText="..." rationale="Found a better pattern for..."
```
Proposals help keep the guides current and comprehensive.
```

## Available MCP Tools

The server provides these tools:

| Tool | Description |
|------|-------------|
| `search_developer_guides` | Full-text search across all guides |
| `get_guide` | Retrieve complete guide content by ID |
| `list_guides` | List all available guides with metadata |
| `get_related_guides` | Find guides related to a specific guide |
| `propose_guide_change` | Submit suggestions for guide improvements |
| `get_guide_stats` | Get statistics about the guides system |

## Search Examples

```
# Find validation patterns
mcp__development-guide__search_developer_guides query="validation" limit=5

# Search for error handling
mcp__development-guide__search_developer_guides query="error handling"

# Find testing patterns
mcp__development-guide__search_developer_guides query="unit test" category="testing"

# Search by framework
mcp__development-guide__search_developer_guides query="state management" framework="qwik"

# Search with tags
mcp__development-guide__search_developer_guides query="authentication" tags=["security", "middleware"]
```

## Troubleshooting

### MCP Server Not Connecting
1. Ensure `mcp-remote` is available: `npx mcp-remote --version`
2. Check the server URL is accessible: `curl https://developer-guides-mcp.solamp.workers.dev/health`
3. Restart Claude Code after config changes
4. Check that your network allows outbound HTTPS connections

### Tools Not Appearing
1. Run `/mcp` to check server status
2. Verify the server shows as "connected"
3. Try reconnecting from the `/mcp` menu
4. Check Claude Code logs for connection errors

### Search Returns No Results
1. Try broader search terms
2. Use `list_guides` to see all available guides
3. Check if the category or framework filter is too restrictive
4. Use `get_guide_stats` to verify guides are loaded

## Keeping Up to Date

This setup guide may be updated with new features, guides, or improvements. To stay current:

1. **Check version**: Look for the version comment in your `CLAUDE.md`:
   ```
   <!-- Developer Guides MCP Setup v1.1.0 - Check for updates: docs/CLAUDE-MD-SETUP.md -->
   ```

2. **Compare versions**: If your version is older than this document's version (shown at the top), update your `CLAUDE.md`

3. **Update process**:
   - Copy the new template from Step 2 above
   - Replace your existing "Developer Guidelines (MCP Server)" section
   - Keep any project-specific customizations you've added

### Changelog

- **v1.1.0** (2024-12-04): Added proactive behavioral guidance, quick reference table, and feedback loop instructions
- **v1.0.0** (2024-12-04): Initial release with 6 MCP tools and 8 developer guides
