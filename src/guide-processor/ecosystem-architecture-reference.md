---
id: ecosystem-architecture-reference
title: Ecosystem Architecture Reference - Development Philosophy & Patterns
category: architecture
type: reference
status: finalized
version: 1.0.0
last_updated: 2025-12-04
tags: [architecture, DE, distributed-electrons, mnemo, nexus, philosophy, patterns, service-registry]
related_guides: [02-architecture, scale-orchestration-guide, 04-cloudflare-workers]
---

# Ecosystem Architecture Reference
## The Definitive Guide to Our Development Philosophy

**Version:** 1.0.0
**Date:** December 4, 2025
**Status:** Living Document
**Purpose:** Capture architectural decisions, philosophy, and patterns for the development ecosystem

---

## Core Architecture Philosophy

### The Three Pillars

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTED ELECTRONS (DE)                    │
│                      Backend Processes                           │
│         All compute, LLM calls, reusable services                │
│         "Build it once, use it everywhere"                       │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                          MNEMO                                   │
│                Working Memory + Tactics                          │
│         Real-time context curation, conversation history         │
│         Active thought, immediate recall                         │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                          NEXUS                                   │
│                Long-term Memory + Strategy                       │
│         Historical knowledge, decision patterns                  │
│         Persistent wisdom, strategic planning                    │
└─────────────────────────────────────────────────────────────────┘
```

### The Fundamental Rule

> **Custom frontends + Distributed backend**
>
> Apps are just interfaces. All compute happens in the worker swarm.

---

## Distributed Electrons (DE)

### What DE Is

DE is the **canonical service layer** for the entire ecosystem. It provides:

- All LLM/AI API calls
- All reusable compute functions
- Shared rate limiting
- Centralized API key management
- Admin panel for service management

### Key Principles

1. **Independence:** Each worker can run in isolation
2. **Modularity:** Workers can be extracted and replicated for specific apps
3. **Reusability:** Build once, deploy everywhere
4. **Sellability:** DE can be sold standalone (backend + admin panel, no frontend)

### When to Add Services to DE

Add to DE when:
- The function could be useful to **any other app** in the ecosystem
- It involves external API calls (especially paid APIs)
- It's a "solved problem" that shouldn't be solved again
- Improvement to the service should propagate everywhere

Keep app-specific when:
- It's truly unique to one application
- It contains proprietary data/logic (e.g., dog bark database)
- It has no reuse potential

### Worker Extraction Pattern

When bringing an app to market:
```
1. Identify which DE workers the app uses
2. Copy those workers to isolated environment
3. Configure for the new app's specific needs
4. Maintain link to upstream for improvements (optional)
```

### Instance Model

```
Instance (≈ "org" or "company")
├── Shared API Resources (keys, rate limits)
├── Users (can access multiple instances)
├── Apps (access specific instances)
└── Workers (deployed per instance)
```

Use cases:
- Separate instance per app user (isolation)
- Shared instance for all app users (efficiency)
- Depends on the application requirements

---

## Mnemo (Working Memory)

### What Mnemo Is

Mnemo is **expanded working memory** - what we're actively thinking about right now.

### The Vision

Not just codebase analysis. The full scope:

1. **Conversation Continuity**
   - Entire chat history loaded into context
   - When Claude compacts, still access full transcript
   - No lost context during long sessions

2. **Dual Claude Strategy**
   ```
   Claude A: Compacts at 50% context
   Claude B: Compacts at 75% context

   Result:
   - No downtime during compaction (one covers for other)
   - Leverage large context window for specific retrieval
   - Continuous conversation flow
   ```

3. **Preemptive Context Loading**
   ```
   User mentions "batteries" in conversation
                    ↓
   Workers automatically fetch:
   ├── Previous conversations about batteries
   ├── Local files with battery info
   ├── Relevant emails
   ├── Text messages on the topic
   ├── Phone call transcripts
   ├── Likely helpful web searches
   └── Related documentation
                    ↓
   1M token context window curated in real-time
   ```

### Integration with DE

Status: **Exploring both approaches**

Option A: Mnemo calls go through DE
- Consistent with "write once, update once" philosophy
- Centralized management

Option B: Mnemo runs standalone
- Gemini is "odd duck" - different from other providers
- May need special handling

Decision: Try both, see what works best.

### Cost Approach

- **Document costs:** Yes, always
- **Cost transparency:** Yes, essential
- **Budget constraints:** No - pedal to the metal
- **Optimization:** Later (maybe open source LLM swarm on CF Workers)

---

## Nexus (Long-term Memory)

### What Nexus Is

Nexus is **long-term memory + strategy** - accumulated wisdom and decision patterns.

### Current Status

- Early development (1 commit)
- Voice-first was overhyped in planning
- Other features more critical
- Will leverage DE worker swarm (voice-to-text, text-to-voice workers)

### Key Insight

> Voice is a "nice to have." The real value is in:
> - Strategic memory
> - Decision pattern recognition
> - Historical knowledge access
> - Cross-session learning

---

## Service Registry

### The Problem

"There is so much going on it is hard to keep up" - We don't always know what services are live.

### The Solution

A **Service Registry** that:
1. Lists all available DE services
2. Queryable by this MCP server (developer-guides)
3. Updated whenever DE is updated
4. Provides "picture of what we have to work with"

### Implementation (D1 Database)

```sql
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  endpoint TEXT,
  status TEXT DEFAULT 'active',
  category TEXT,
  dependencies TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_capabilities (
  service_id TEXT,
  capability TEXT,
  input_schema TEXT, -- JSON
  output_schema TEXT, -- JSON
  FOREIGN KEY (service_id) REFERENCES services(id)
);
```

### Update Requirement

> **CRITICAL:** Whenever DE is updated, the registry MUST be updated.
>
> This should be a PR checklist item.

---

## MCP Server Management

### Best Practice: claude-mcp-config

**Repository:** https://github.com/CyberBrown/claude-mcp-config

All developers should install and use this tool for managing MCP servers.

### Installation

```bash
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
```

### Usage

```bash
# List available servers
mcp-manager list

# Show active servers
mcp-manager active

# Enable servers
mcp-manager enable vibe-check cloudflare developer-guides

# Disable servers
mcp-manager disable server-name

# Reset all
mcp-manager reset
```

### Available Servers

| Server | Description | Requirements |
|--------|-------------|--------------|
| `developer-guides` | This MCP server | None |
| `vibe-check` | Peer review | `GEMINI_API_KEY` |
| `sequential-thinking` | Anthropic reasoning | None |
| `cloudflare` | CF integration | OAuth |
| `linear` | Issue tracking | OAuth |
| `github` | GitHub integration | `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `context7` | Document library | `CONTEXT7_API_KEY` |
| ... | See repo for full list | |

### Adding Servers

When a new MCP server is created:
1. Add to `servers-library.json`
2. Document in this guide
3. Update developer-guides MCP if relevant

---

## Work Under Construction Registry

### Purpose

Document **meta features** under development that could impact other apps.

### What TO Document Here

- ✅ Shared improvements (DB query optimizations, new algorithms)
- ✅ Meta features (things that help other apps)
- ✅ Infrastructure changes
- ✅ New DE services
- ✅ Best practices discovered

### What NOT to Document Here

- ❌ App-specific data (dog bark database)
- ❌ Proprietary business logic
- ❌ Frontend-only changes
- ❌ Single-use implementations

### Benefits

1. **Avoid duplication:** Don't solve the same problem twice
2. **Sequencing:** Know when to wait for a meta feature
3. **Coordination:** Multi-agent teams know what others are working on

### Template

```markdown
## [Feature Name]
**Status:** Planning | In Progress | Testing | Ready
**Owner:** [Agent/Person]
**Target Completion:** [Date]
**Impacts:** [List of apps/services affected]

### Description
[What is being built]

### Why It Matters
[How this helps the ecosystem]

### Dependencies
[What this needs to work]

### Blockers
[Current blockers, if any]
```

---

## Branching Strategy

### Ideal Model

```
branch → dev → prod → main
   │       │      │      │
   │       │      │      └── Live production
   │       │      └── Pre-release staging
   │       └── Integration of multiple branches
   └── Local development work
```

### Reality

> "We are moving very fast and commit to main all the time"

### When to Use Full Strategy

- Multi-agent parallel development (like the 16-agent team)
- Features that need coordination
- High-risk changes

### When to Move Fast

- Solo development
- Low-risk changes
- Experimental features
- Proof of concepts

### Guideline

> Don't create bureaucracy for bureaucracy's sake.
> Know the right way, use it when needed.

---

## Rate Limiting Philosophy

### Provider-Driven

Rate limits depend on the provider/service. Not one-size-fits-all.

### Considerations

- Each API key should have its own rate limit (generally)
- Some vendors limit by auth, not key
- Multiple keys + one auth = limited by auth
- Multiple auths + one key each = different limits

### Goal

> Allow apps in the swarm to share resources while managing rates in the big picture.

### Implementation

Tracked at instance level:
- Instance shares API resources
- Apps access instances
- Rate limits apply per instance

---

## Documentation Requirements

### When DE is Updated

**Mandatory:**
1. Update Service Registry
2. Update relevant developer guide sections
3. Add to changelog

**If new service:**
1. Add to Service Registry with full schema
2. Create usage documentation
3. Add to MCP tools if applicable
4. Update admin panel

### When Discovering Best Practices

**Always document:**
- DB query optimizations
- Algorithm improvements
- Error handling patterns
- Performance discoveries
- Integration patterns

**Use this MCP server** as the repository for shared knowledge.

---

## Open Questions

### Still Figuring Out

1. **Mnemo + DE integration:** Try both approaches, evaluate
2. **Gemini handling:** "Odd duck" - needs special consideration
3. **Exact services live in DE:** Need audit (part of why we're building these tools)
4. **Voice-first priority:** Deprioritized, other Nexus features more critical

### Need Resolution

1. **Service Registry storage:** D1, R2, or hybrid?
2. **Registry update automation:** Manual PR requirement or automated?
3. **Rate limit tracking:** How to surface rate limit status across swarm?

---

## Key Takeaways for Guide Updates

1. **DE is central:** All guides should reference DE for reusable services
2. **claude-mcp-config is required:** Should be in onboarding/setup guides
3. **Service Registry needed:** Must design and implement
4. **Work-in-progress visibility:** Create "Under Construction" section
5. **Documentation is critical:** Every update = guide update
6. **Memory architecture:** Mnemo (working) + Nexus (long-term) pattern
7. **Move fast, know the rules:** Pragmatic approach to process

---

## Related Documents

- [Scale & Orchestration Guide](./scale-orchestration-guide.md)
- [Developer Guide Index](project knowledge)
- [DE Repository](https://github.com/CyberBrown/cloudflare-multiagent-system)
- [Mnemo Repository](https://github.com/CyberBrown/mnemo)
- [Nexus Repository](https://github.com/CyberBrown/nexus)
- [claude-mcp-config](https://github.com/CyberBrown/claude-mcp-config)

---

*This document should be updated as architectural decisions evolve.*
