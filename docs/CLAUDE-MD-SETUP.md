# Setting Up Developer Guides MCP Server in CLAUDE.md

This guide explains how to configure Claude Code to use the Developer Guides MCP server for accessing coding standards and best practices.

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
## Developer Guidelines (MCP Server)

Before writing or modifying code, check the developer guides for established patterns:

### When to Check Guides
- **New features**: Search for relevant patterns before implementation
- **Security-sensitive code**: Always check `guide-07-security` for auth, validation, secrets
- **Error handling**: Reference `guide-01-fundamentals` for error patterns
- **API endpoints**: Check security guide for validation schemas and middleware patterns
- **Database queries**: Verify parameterized query patterns in security guide

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

Get guide statistics:
```
mcp__development-guide__get_guide_stats
```

### Available Guides

| Guide | Use For |
|-------|---------|
| `guide-01-fundamentals` | Code organization, naming, error handling, types |
| `guide-07-security` | Validation, auth, secrets, CORS, rate limiting |
| `guide-09-testing` | Unit, integration, E2E testing patterns |
| `guide-02-11-arch-devops` | Architecture patterns, CI/CD, deployment |
| `guide-05-10-db-perf` | Database schemas, queries, performance |

### Key Patterns to Follow
- Use Zod schemas for all input validation
- Use custom error classes (`AppError`, `ValidationError`, `NotFoundError`)
- Never concatenate SQL queries - use parameterized queries
- Store secrets in environment variables, never in code
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
```

## Troubleshooting

### MCP Server Not Connecting
1. Ensure `mcp-remote` is available: `npx mcp-remote --version`
2. Check the server URL is accessible: `curl https://developer-guides-mcp.solamp.workers.dev/health`
3. Restart Claude Code after config changes

### Tools Not Appearing
1. Run `/mcp` to check server status
2. Verify the server shows as "connected"
3. Try reconnecting from the `/mcp` menu
