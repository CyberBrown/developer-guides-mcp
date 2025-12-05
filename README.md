# Developer Guides MCP

A Model Context Protocol (MCP) server that provides AI assistants with access to a searchable knowledge base of developer guidelines. Built on Cloudflare Workers with R2, D1, and Vectorize for a fully serverless architecture.

## Overview

Developer Guides MCP acts as a bridge between AI assistants (like Claude) and a comprehensive developer documentation system. It enables AI to answer questions about best practices, coding standards, and technical documentation by querying real developer guides stored in the backend.

## Features

- **Full-text search** across all developer guides with highlighted snippets
- **Semantic search** using vector embeddings for natural language queries
- **Guide retrieval** with section-level granularity
- **Related guides** discovery based on metadata relationships
- **Change proposals** for suggesting documentation improvements
- **Statistics** on guide coverage and system health

## Tech Stack

- **[Hono](https://hono.dev/)** - Lightweight web framework
- **[Model Context Protocol](https://modelcontextprotocol.io/)** - AI tool integration standard
- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Serverless compute
- **[Cloudflare R2](https://developers.cloudflare.com/r2/)** - Object storage for markdown files
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - SQLite database for metadata and FTS
- **[Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/)** - Vector database for semantic search
- **TypeScript** with **Zod** validation

## Quick Start: Using with Claude Code

**First step when using this MCP server:** Verify your project's `CLAUDE.md` is configured correctly.

1. Check [docs/CLAUDE-MD-SETUP.md](docs/CLAUDE-MD-SETUP.md) for the latest setup instructions
2. Look for the version comment in your `CLAUDE.md`: `<!-- Developer Guides MCP Setup vX.X.X -->`
3. If missing or outdated, update your `CLAUDE.md` with the latest template

This ensures Claude Code knows how to use the developer guides effectively.

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd developer-guides-mcp

# Install dependencies
npm install

# Generate Cloudflare type definitions
npm run cf-typegen
```

## Prerequisites

- Node.js 16+
- Cloudflare account with R2, D1, and Vectorize enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed

## Development

```bash
# Start local development server
npm run dev

# Run tests
npm test
```

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

See [docs/deployment-guide.txt](docs/deployment-guide.txt) for detailed deployment instructions including resource setup and database schema.

## MCP Tools

The server exposes the following tools to AI assistants:

| Tool | Description |
|------|-------------|
| `search_developer_guides` | Full-text search with optional category, framework, and tag filters |
| `get_guide` | Retrieve a complete guide or specific section by ID |
| `list_guides` | Browse available guides with optional filtering |
| `get_related_guides` | Find documentation related to a specific guide |
| `propose_guide_change` | Submit improvement suggestions for review |
| `get_guide_stats` | Get system statistics and coverage metrics |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service info and available endpoints |
| `/health` | GET | Health check with environment info |
| `/tools` | GET | List all available MCP tools |
| `/mcp` | POST | MCP protocol endpoint (Streamable HTTP transport) |
| `/tools/*` | POST | Direct tool invocation endpoints |

## Configuration

The server uses Wrangler for configuration. Key bindings:

```jsonc
{
  "r2_buckets": [{ "binding": "GUIDES_BUCKET", "bucket_name": "developer-guides" }],
  "d1_databases": [{ "binding": "DB", "database_name": "developer-guides-db" }],
  "vectorize": [{ "binding": "VECTORIZE", "index_name": "developer-guides-index" }]
}
```

## Project Structure

```
├── src/
│   ├── index.ts              # Main MCP server implementation
│   ├── upload.ts             # Guide upload endpoint
│   └── guide-processor/      # Markdown processing and guides
├── docs/                     # Deployment and implementation docs
├── test/                     # Vitest test suite
├── scripts/                  # Utility scripts
└── wrangler.jsonc            # Cloudflare Workers configuration
```

## License

MIT
