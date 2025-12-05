# Developer Guides MCP

This is an MCP server that provides AI assistants with access to developer guidelines and best practices.

## Project Overview

- **Framework**: Hono on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) with FTS5 for full-text search
- **Storage**: Cloudflare R2 for markdown files
- **Vector Search**: Cloudflare Vectorize for semantic search
- **Validation**: Zod schemas throughout

## Key Files

- `src/index.ts` - Main MCP server with all tool implementations
- `src/upload.ts` - Guide upload endpoint
- `wrangler.jsonc` - Cloudflare Workers configuration
- `docs/CLAUDE-MD-SETUP.md` - Setup guide for using this MCP server

## Development Commands

```bash
npm run dev      # Start local development server
npm test         # Run tests
npm run deploy   # Deploy to Cloudflare Workers
npm run cf-typegen  # Generate Cloudflare type definitions
```

## MCP Tools

The server exposes 6 tools: `search_developer_guides`, `get_guide`, `list_guides`, `get_related_guides`, `propose_guide_change`, `get_guide_stats`

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
