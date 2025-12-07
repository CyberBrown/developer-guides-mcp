# Claude Code Implementation Handoff
## Developer Guides MCP Server Updates

**Prepared by:** Claude (claude.ai)  
**Date:** December 4, 2025  
**Handoff to:** Claude Code  
**Repository:** developer-guides-mcp (or wherever this MCP server lives)

---

## Context

We've completed an architectural analysis of the ecosystem and need to implement several updates to the Developer Guides MCP server. This document provides everything Claude Code needs to execute.

### Reference Documents
- [Ecosystem Architecture Reference](./ecosystem-architecture-reference.md) - Philosophy and patterns
- [Original Analysis](./guide-update-analysis.md) - Gap analysis

---

## 🔴 TASK 1: Service Registry (D1)

### Purpose
Create a queryable registry of all DE services so this MCP server can answer "what services are available?"

### Schema

```sql
-- Migration: 001_create_service_registry.sql

-- Core services table
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'llm', 'storage', 'voice', 'image', 'utility', 'auth'
  endpoint TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'beta', 'deprecated', 'planned')),
  de_worker_name TEXT, -- Name of the worker in DE
  documentation_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service capabilities (what each service can do)
CREATE TABLE IF NOT EXISTS service_capabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  description TEXT,
  input_schema TEXT, -- JSON schema
  output_schema TEXT, -- JSON schema
  example_input TEXT, -- JSON example
  example_output TEXT, -- JSON example
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Service dependencies
CREATE TABLE IF NOT EXISTS service_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  depends_on_service_id TEXT NOT NULL,
  dependency_type TEXT DEFAULT 'required' CHECK(dependency_type IN ('required', 'optional')),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- API keys/providers used by services
CREATE TABLE IF NOT EXISTS service_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  provider_name TEXT NOT NULL, -- 'openai', 'anthropic', 'gemini', 'ideogram', etc.
  requires_api_key BOOLEAN DEFAULT 1,
  rate_limit_notes TEXT,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_capabilities_service ON service_capabilities(service_id);
```

### Seed Data (Known Services)

```sql
-- Insert known DE services
INSERT INTO services (id, name, description, category, status, de_worker_name) VALUES
  ('text-gen', 'Text Generation', 'LLM text generation via OpenAI/Anthropic', 'llm', 'active', 'text-gen'),
  ('image-gen', 'Image Generation', 'Image generation via Ideogram', 'image', 'active', 'image-gen'),
  ('config-service', 'Config Service', 'Central configuration management', 'utility', 'active', 'config-service');

-- Add capabilities
INSERT INTO service_capabilities (service_id, capability, description) VALUES
  ('text-gen', 'chat_completion', 'Generate chat responses'),
  ('text-gen', 'text_completion', 'Generate text completions'),
  ('image-gen', 'generate_image', 'Generate images from text prompts');

-- Add providers
INSERT INTO service_providers (service_id, provider_name, requires_api_key) VALUES
  ('text-gen', 'openai', 1),
  ('text-gen', 'anthropic', 1),
  ('image-gen', 'ideogram', 1);
```

### New MCP Tool

Add this tool to the MCP server:

```typescript
// Tool: get_available_services
{
  name: "get_available_services",
  description: "Query the service registry to discover what DE (Distributed Electrons) services are available. Use this to understand what backend capabilities exist before building new features.",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: ["llm", "storage", "voice", "image", "utility", "auth"],
        description: "Filter by service category"
      },
      status: {
        type: "string",
        enum: ["active", "beta", "deprecated", "planned"],
        description: "Filter by service status"
      },
      search: {
        type: "string",
        description: "Search term to match against name/description"
      },
      include_capabilities: {
        type: "boolean",
        default: false,
        description: "Include detailed capabilities for each service"
      }
    }
  }
}

// Implementation
async function getAvailableServices(params: {
  category?: string;
  status?: string;
  search?: string;
  include_capabilities?: boolean;
}): Promise<ServiceInfo[]> {
  let sql = `
    SELECT s.*, 
           GROUP_CONCAT(DISTINCT sp.provider_name) as providers
    FROM services s
    LEFT JOIN service_providers sp ON s.id = sp.service_id
    WHERE 1=1
  `;
  const bindings: string[] = [];

  if (params.category) {
    sql += ` AND s.category = ?`;
    bindings.push(params.category);
  }

  if (params.status) {
    sql += ` AND s.status = ?`;
    bindings.push(params.status);
  }

  if (params.search) {
    sql += ` AND (s.name LIKE ? OR s.description LIKE ?)`;
    bindings.push(`%${params.search}%`, `%${params.search}%`);
  }

  sql += ` GROUP BY s.id`;

  const services = await env.DB.prepare(sql).bind(...bindings).all();

  if (params.include_capabilities) {
    // Fetch capabilities for each service
    for (const service of services.results) {
      const caps = await env.DB.prepare(
        `SELECT capability, description FROM service_capabilities WHERE service_id = ?`
      ).bind(service.id).all();
      service.capabilities = caps.results;
    }
  }

  return services.results;
}
```

---

## 🔴 TASK 2: Automated Registry Update on DE Deploy

### Purpose
When DE is deployed, automatically update the service registry.

### Approach: GitHub Actions Webhook

In the **DE repository** (`cloudflare-multiagent-system`), add a deploy hook:

```yaml
# .github/workflows/deploy.yml (add to existing)

jobs:
  deploy:
    # ... existing deploy steps ...
    
    steps:
      # ... existing steps ...
      
      - name: Update Service Registry
        if: success()
        run: |
          # Call the developer-guides MCP server to update registry
          curl -X POST ${{ secrets.DEVELOPER_GUIDES_WEBHOOK_URL }}/api/sync-registry \
            -H "Authorization: Bearer ${{ secrets.REGISTRY_SYNC_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "source": "de-deploy",
              "commit": "${{ github.sha }}",
              "services_manifest": "workers/manifest.json"
            }'
```

### In Developer Guides MCP Server

Add webhook endpoint:

```typescript
// POST /api/sync-registry
app.post('/api/sync-registry', async (c) => {
  // Verify auth token
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.REGISTRY_SYNC_TOKEN}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  
  // Fetch manifest from DE repo or deployment
  // Parse workers and their capabilities
  // Update D1 registry
  
  // Log the sync
  await c.env.DB.prepare(
    `INSERT INTO registry_sync_log (source, commit_sha, synced_at) VALUES (?, ?, ?)`
  ).bind(body.source, body.commit, new Date().toISOString()).run();

  return c.json({ success: true, synced_at: new Date().toISOString() });
});
```

### Alternative: DE Manifest File

Create a `services-manifest.json` in DE that's the source of truth:

```json
{
  "version": "1.0.0",
  "last_updated": "2025-12-04T00:00:00Z",
  "services": [
    {
      "id": "text-gen",
      "name": "Text Generation",
      "category": "llm",
      "status": "active",
      "worker": "text-gen",
      "capabilities": ["chat_completion", "text_completion"],
      "providers": ["openai", "anthropic"]
    }
  ]
}
```

The sync endpoint reads this manifest and updates D1.

---

## 🔴 TASK 3: Add claude-mcp-config to Guides

### New Guide Section

Create or update a setup/onboarding guide with:

```markdown
## MCP Server Management

### Required: claude-mcp-config

All developers must install the MCP configuration manager for consistent server management.

#### Installation

\`\`\`bash
# Prerequisites
sudo apt-get update && sudo apt-get install -y jq

# Install
git clone https://github.com/CyberBrown/claude-mcp-config.git
cd claude-mcp-config
chmod +x install.sh
./install.sh

# Configure API keys
nano ~/mcp-management/.env

# Reload shell
source ~/.bashrc
\`\`\`

#### Daily Usage

\`\`\`bash
# See what's available
mcp-manager list

# Enable servers for your project
mcp-manager enable developer-guides cloudflare vibe-check

# Check what's active
mcp-manager active
\`\`\`

#### Recommended Server Sets

**For DE Development:**
\`\`\`bash
mcp-manager enable developer-guides cloudflare sequential-thinking
\`\`\`

**For Frontend Development:**
\`\`\`bash
mcp-manager enable developer-guides vibe-check
\`\`\`

**For Full Stack:**
\`\`\`bash
mcp-manager enable developer-guides cloudflare github linear vibe-check
\`\`\`

### Adding New Servers

When creating a new MCP server:
1. Add configuration to `~/mcp-management/servers-library.json`
2. Document in the developer-guides (this MCP server)
3. Update claude-mcp-config repo if it's a shared server
```

---

## 🔴 TASK 4: Update Guide Content

### Files to Update

1. **00-Developer-Guide-Index.md**
   - Add "Ecosystem Architecture" section
   - Add quick link to Service Registry
   - Add MCP setup requirements

2. **02-Architecture-Guide.md** (or create new section)
   - Add Three Pillars (DE/Mnemo/Nexus) diagram
   - Add "Build it once" philosophy
   - Add service extraction pattern
   - Add instance model explanation

3. **06-AI-ML-Guide.md**
   - Add "Route through DE" as primary pattern
   - Add provider adapter pattern
   - Add note about Gemini/Mnemo special handling

4. **NEW: 12-Scale-and-Orchestration-Guide.md**
   - Multi-agent development paradigm
   - 16-agent (4x4) structure
   - Resource acquisition loop
   - Parallel development patterns

---

## 🔴 TASK 5: Delegation Mindset Guide

### Add to Fundamentals or Create New Section

```markdown
## Delegation Mindset

### The Core Question

Before asking a human to do something, always ask:

1. **Can I do this myself?**
2. **If not, can Claude Code do this?**
3. **Can another MCP server/tool handle this?**
4. **Only then: Does the human need to do this?**

### Practical Examples

| Task | Who Should Do It |
|------|------------------|
| Write documentation | Claude (claude.ai) |
| Deploy code changes | Claude Code |
| Create D1 migrations | Claude Code |
| Design architecture | Claude (claude.ai) |
| Run tests | Claude Code |
| Make business decisions | Human |
| Approve major changes | Human |

### Handoff Pattern

When handing off to Claude Code:

1. Create a clear task description
2. Provide all necessary context
3. Include code snippets/schemas ready to implement
4. Specify success criteria
5. Note any dependencies or blockers

### Example Handoff

\`\`\`markdown
# Task: Implement Service Registry

## Context
[Link to architecture doc]

## What to Build
[Schema, code snippets]

## Success Criteria
- [ ] D1 migration runs successfully
- [ ] New MCP tool responds to queries
- [ ] Seed data loads correctly

## Dependencies
- None (can start immediately)
\`\`\`
```

---

## 🟢 TASK 6: Note for Nexus (Strategic Planning)

### For Future Implementation

The Work-in-Progress / Strategic Planning functionality belongs in **Nexus**, not this MCP server.

When Nexus is ready, it should implement:

```
TACTICAL ←→ STRATEGIC LOOP

Input: What are we planning to do tactically?
        ↓
Processing:
  1. How does this fit strategically?
  2. Are we building the same thing twice?
  3. Will this design decision create technical debt?
  4. What's the priority given current resources?
  5. Should something else get bumped up?
        ↓
Output: Prioritized action plan with dependencies
```

For now, document this requirement so Nexus development can incorporate it.

---

## Summary: What Claude Code Should Do

### Immediate (This Session)
1. [ ] Create D1 migration for service registry
2. [ ] Implement `get_available_services` MCP tool
3. [ ] Add seed data for known DE services
4. [ ] Update/create guide markdown files

### Soon (Next Session)
1. [ ] Set up webhook endpoint for registry sync
2. [ ] Add GitHub Action to DE repo for auto-sync
3. [ ] Create 12-Scale-and-Orchestration-Guide

### Verify
1. [ ] Service registry queries work
2. [ ] New tool appears in MCP tool list
3. [ ] Guide updates are searchable

---

## Questions for Claude Code

If anything is unclear:
1. Where is the MCP server repository located?
2. What's the current D1 database name?
3. Are there existing webhook patterns to follow?
4. What's the deployment process for this MCP server?

---

*This handoff was prepared by Claude (claude.ai). Execute in Claude Code.*
