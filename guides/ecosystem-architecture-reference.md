---
id: ecosystem-architecture-reference
title: Ecosystem Architecture Reference - Development Philosophy & Patterns
category: architecture
type: reference
status: finalized
version: 2.0.0
last_updated: 2026-02-05
tags: [architecture, DE, distributed-electrons, mnemo, nexus, philosophy, patterns, service-registry]
related_guides: [scale-orchestration-guide, mcp-usage-guide, guide-02-11-arch-devops]
---

# Ecosystem Architecture Reference
## The Definitive Guide to Our Development Philosophy

**Version:** 2.0.0
**Date:** February 5, 2026
**Status:** Living Document
**Purpose:** Capture architectural decisions, philosophy, and patterns for the development ecosystem

---

## Core Architecture Philosophy

### The Three Pillars

```
+----------------------------------------------------------------+
|                    DISTRIBUTED ELECTRONS (DE)                    |
|                   Canonical Service Layer                        |
|         All compute, LLM calls, reusable services                |
|         "Build it once, use it everywhere"                       |
+----------------------------------------------------------------+
                              |
+----------------------------------------------------------------+
|                          MNEMO                                   |
|              Extended Working Memory (RAG)                        |
|         Tiered query routing, context caching                    |
|         AI Search + Nemotron synthesis                            |
+----------------------------------------------------------------+
                              |
+----------------------------------------------------------------+
|                          NEXUS                                   |
|          Task Orchestration + Idea Management                    |
|         Queue-based execution, external executors                |
|         Ideas -> Plans -> Tasks -> Queue -> Completion           |
+----------------------------------------------------------------+
```

### The Fundamental Rule

> **Custom frontends + Distributed backend**
>
> Apps are just interfaces. All compute happens in the worker swarm.

---

## Distributed Electrons (DE)

### What DE Is

DE is the **canonical service layer** for the entire ecosystem. It provides:

- All LLM/AI API calls via tiered routing
- All reusable compute functions
- Shared rate limiting
- Centralized API key management
- Admin panel for service management
- Executor interface for task execution

### Repository

**URL:** https://github.com/CyberBrown/distributed-electrons

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
- It contains proprietary data/logic
- It has no reuse potential

### Worker Extraction Pattern

When bringing an app to market:
```
1. Identify which DE workers the app uses
2. Copy those workers to isolated environment
3. Configure for the new app's specific needs
4. Maintain link to upstream for improvements (optional)
```

### LLM Routing

DE implements tiered LLM routing for text generation:

| Priority | Provider | Notes |
|----------|----------|-------|
| 1 | Spark (Nemotron) | Local, free, fast |
| 2 | z.ai | Cheap cloud alternative |
| 3 | Gemini Flash | Fast, cheap fallback |
| 4 | OpenAI GPT-4o-mini | Reliable fallback |

### Instance Model

```
Instance (= "org" or "company")
+-- Shared API Resources (keys, rate limits)
+-- Users (can access multiple instances)
+-- Apps (access specific instances)
+-- Workers (deployed per instance)
```

---

## Mnemo (Extended Working Memory)

### What Mnemo Is

Mnemo is **extended working memory** via context caching and tiered query routing. It enables AI assistants to work with large codebases and documents without overwhelming conversation context.

### Repository

**URL:** https://github.com/CyberBrown/mnemo
**MCP Endpoint:** `mnemo.solamp.workers.dev/mcp`

### Current Architecture

> **IMPORTANT:** Gemini context caching is currently **disabled for cost reasons**.

Mnemo uses a tiered query routing system:

```
Query arrives
      |
      v
Layer 1: Cloudflare AI Search (fast RAG)
      |
      +-- Confidence >= threshold?
      |       |
      |       YES --> Synthesize with Nemotron (Spark) --> Return
      |       |       (fast, free, local)
      |       |
      |       NO --> Escalate to Layer 2
      |
Layer 2: Full Context Load
      |
      +-- Primary: Nemotron (Spark local)
      +-- Fallback: Gemini (DISABLED for cost)
```

### MCP Tools

| Tool | Purpose |
|------|---------|
| `context_load` | Load sources (repos, files) into cache for querying |
| `context_query` | Query a cached context using tiered routing |
| `context_list` | List all active caches |
| `context_evict` | Remove a cache |
| `context_stats` | Get usage statistics |
| `context_refresh` | Reload a cache with fresh content |
| `context_index` | Generate lightweight context index |

### Integration with DE

Mnemo operates as a standalone MCP server. It uses Cloudflare AI Search for RAG and routes synthesis through Nemotron (Spark local) rather than through DE's LLM routing. This is because Mnemo's query patterns are specialized for context retrieval rather than general text generation.

### Cost Approach

- Gemini caching disabled to reduce costs
- Nemotron (local Spark) is free for synthesis
- AI Search (Cloudflare) is included in Workers plan
- Net operational cost: near zero for most queries

### Passphrase

Write operations require passphrase: `stale-coffee-44`

---

## Nexus (Task Orchestration + Idea Management)

### What Nexus Is

Nexus is a **task orchestration and idea management system**. It captures ideas, breaks them into plans with tasks, and dispatches tasks to a queue for external executors to claim and complete.

### Repository

**URL:** https://github.com/CyberBrown/nexus
**MCP Endpoint:** `nexus-mcp.solamp.workers.dev/mcp`

### Current Architecture: Queue-Only Model

> **CRITICAL:** Nexus uses a **queue-only execution model**. There is NO built-in LLM execution.
> External executors (Claude Code, other agents) poll the queue, claim tasks, and report results.

```
Ideas --> Planning --> Tasks --> Queue --> External Executors
                                  ^              |
                                  |              v
                              Cron dispatch   Complete/Fail
                              (15 min)
```

### Execution Flow

1. **Capture:** `nexus_capture` or `nexus_create_idea` to capture raw input
2. **Plan:** `nexus_plan_idea` generates an AI execution plan
3. **Execute Idea:** `nexus_execute_idea` creates tasks from the plan
4. **Dispatch:** Cron (15 min) or manual `nexus_dispatch_task` / `nexus_dispatch_ready`
5. **Claim:** External executor calls `nexus_check_queue` then `nexus_claim_queue_task`
6. **Complete:** Executor calls `nexus_complete_queue_task` with results

### MCP Tools

**Idea Management:**

| Tool | Purpose |
|------|---------|
| `nexus_create_idea` | Create a new idea for future planning |
| `nexus_plan_idea` | Generate an AI execution plan for an idea |
| `nexus_execute_idea` | Create tasks from a planned idea |
| `nexus_get_idea` | Get details of a specific idea |
| `nexus_get_status` | Get execution status for an idea |
| `nexus_list_ideas` | List all ideas with filtering |
| `nexus_update_idea` | Update an idea |
| `nexus_complete_idea` | Mark an idea as complete |
| `nexus_archive_idea` | Archive an idea |
| `nexus_delete_idea` | Delete an idea |

**Task Management:**

| Tool | Purpose |
|------|---------|
| `nexus_create_task` | Create a task directly |
| `nexus_list_tasks` | List tasks with filtering |
| `nexus_claim_task` | Claim a task for execution |
| `nexus_complete_task` | Mark a task as complete |
| `nexus_update_task` | Update a task |
| `nexus_delete_task` | Delete a task |
| `nexus_task_status` | Get task status |

**Queue Management:**

| Tool | Purpose |
|------|---------|
| `nexus_check_queue` | Poll for available tasks by executor type |
| `nexus_claim_queue_task` | Claim a queued task for execution |
| `nexus_complete_queue_task` | Report results for a claimed task |
| `nexus_queue_stats` | Get queue statistics |
| `nexus_dispatch_task` | Manually dispatch a task to queue |
| `nexus_dispatch_ready` | Dispatch all ready tasks by executor type |

**Execution & Monitoring:**

| Tool | Purpose |
|------|---------|
| `nexus_list_active` | List active executions |
| `nexus_list_blocked` | List blocked executions needing input |
| `nexus_resolve_blocker` | Resolve a blocker on an execution |
| `nexus_cancel_execution` | Cancel an in-progress execution |
| `nexus_list_quarantined` | List quarantined tasks |
| `nexus_reset_quarantine` | Reset quarantine on a task |

**Utility:**

| Tool | Purpose |
|------|---------|
| `nexus_capture` | Capture raw input for AI classification |
| `nexus_log_decision` | Log a decision |
| `nexus_get_note` | Get a note |
| `nexus_create_note` | Create a note |
| `nexus_update_note` | Update a note |
| `nexus_archive_note` | Archive a note |
| `nexus_delete_note` | Delete a note |
| `nexus_list_notes` | List notes |
| `nexus_search_notes` | Search notes |
| `nexus_search_archive` | Search archived items |

**Dependency Management:**

| Tool | Purpose |
|------|---------|
| `nexus_add_dependency` | Add a dependency between tasks |
| `nexus_remove_dependency` | Remove a dependency |
| `nexus_get_dependencies` | Get task dependencies |
| `nexus_get_dependents` | Get tasks that depend on a task |

### DEPRECATED Tools

> **WARNING:** The following tools are DEPRECATED and should NOT be used:
> - `nexus_execute_task` - Removed. Use queue-based execution instead.
> - `nexus_run_executor` - Removed. External executors poll the queue directly.

### Passphrase

Write operations require passphrase: `stale-coffee-44`

---

## MCP Server URLs

| Service | MCP Endpoint |
|---------|-------------|
| Mnemo | `mnemo.solamp.workers.dev/mcp` |
| Nexus | `nexus-mcp.solamp.workers.dev/mcp` |
| Developer Guides | `developer-guides-mcp.solamp.workers.dev/mcp` |

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

### Update Requirement

> **CRITICAL:** Whenever DE is updated, the registry MUST be updated.
>
> This should be a PR checklist item.

---

## MCP Server Management

### Best Practice: claude-mcp-config

**Repository:** https://github.com/CyberBrown/claude-mcp-config

All developers should install and use this tool for managing MCP servers.

### Available Servers

| Server | Description | Requirements |
|--------|-------------|--------------|
| `developer-guides` | This MCP server | None |
| `mnemo` | Context caching & RAG | `stale-coffee-44` passphrase |
| `nexus` | Task orchestration | `stale-coffee-44` passphrase |
| `sequential-thinking` | Anthropic reasoning | None |
| `cloudflare` | CF integration | OAuth |
| `github` | GitHub integration | `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `context7` | Document library | None |

---

## Branching Strategy

### Ideal Model

```
branch -> dev -> prod -> main
```

### Reality

> "We are moving very fast and commit to main all the time"

### Guideline

> Don't create bureaucracy for bureaucracy's sake.
> Know the right way, use it when needed.

---

## Planning Guidelines

> **IMPORTANT:** Do not use calendar-based time estimates. Claude consistently underestimates human execution speed by 10-20x.
> Use phases to communicate sequencing without false precision.

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

### When Discovering Best Practices

**Always document:**
- DB query optimizations
- Algorithm improvements
- Error handling patterns
- Performance discoveries
- Integration patterns

**Use this MCP server** as the repository for shared knowledge.

---

## Related Documents

- [Scale & Orchestration Guide](./scale-orchestration-guide.md)
- [MCP Usage Guide](./mcp-usage-guide.md)
- [DE Repository](https://github.com/CyberBrown/distributed-electrons)
- [Mnemo Repository](https://github.com/CyberBrown/mnemo)
- [Nexus Repository](https://github.com/CyberBrown/nexus)
- [claude-mcp-config](https://github.com/CyberBrown/claude-mcp-config)

---

## Changelog

### v2.0.0 (2026-02-05)
- **BREAKING:** Updated Nexus description from "long-term memory" to "task orchestration + idea management"
- **BREAKING:** Updated Mnemo description to reflect Gemini disabled, tiered routing active
- Updated DE repository URL to distributed-electrons
- Added complete MCP tool inventory for Nexus and Mnemo
- Added MCP server URLs
- Documented deprecated tools (nexus_execute_task, nexus_run_executor)
- Added queue-based execution model documentation
- Added planning guidelines (no calendar estimates)
- Removed outdated "Open Questions" (most resolved)
- Added passphrase documentation

### v1.0.0 (2025-12-04)
- Initial guide creation

---

*This document should be updated as architectural decisions evolve.*
