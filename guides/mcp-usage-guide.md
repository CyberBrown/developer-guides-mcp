---
id: mcp-usage-guide
title: MCP Server Usage Guide
category: tools
type: guide
status: finalized
version: 2.0.0
last_updated: 2026-02-05
tags: [mcp, mnemo, nexus, de, context-management, tools, queue, execution]
related_guides: [ecosystem-architecture-reference, scale-orchestration-guide]
---

# MCP Server Usage Guide

## Purpose

This guide is the **single source of truth** for MCP server usage patterns. Claude (both Claude.ai and Claude Code) should consult this guide before using ecosystem MCP servers.

**Memory points here** -- update this guide to change behavior, not memory.

---

## MCP Server Endpoints

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Mnemo | `mnemo.solamp.workers.dev/mcp` | Context caching & RAG queries |
| Nexus | `nexus-mcp.solamp.workers.dev/mcp` | Task orchestration & idea management |
| Developer Guides | `developer-guides-mcp.solamp.workers.dev/mcp` | Development guidelines & patterns |

### Passphrase

Write operations on Mnemo and Nexus require passphrase: `stale-coffee-44`

---

## Mnemo - Extended Context Memory

Mnemo provides extended working memory via tiered query routing. Use it to keep conversation context lean while maintaining access to large codebases.

> **IMPORTANT:** Gemini context caching is **DISABLED** for cost reasons.
> Current routing: AI Search (fast RAG) -> Nemotron/Spark synthesis -> Gemini fallback (disabled).

### MCP Tools

| Tool | Purpose | Passphrase Required |
|------|---------|-------------------|
| `context_load` | Load repos/files into cache | Yes |
| `context_query` | Query cached context | No |
| `context_list` | List active caches | No |
| `context_evict` | Remove a cache | Yes |
| `context_stats` | Usage statistics | No |
| `context_refresh` | Reload cache with fresh content | Yes |
| `context_index` | Generate lightweight context index | No |

### When to Proactively Load Context

**ALWAYS load into Mnemo BEFORE:**
- Pulling large code files into conversation context
- Starting work on any codebase (Nexus, DE, Mnemo, etc.)
- Debugging across multiple files or repositories
- When a conversation is getting long and you need to reference code repeatedly

**Trigger patterns -- load proactively when:**
- User says "let's work on [project]" or "can you help with [codebase]"
- You're about to read multiple large files
- Conversation has 10+ exchanges and involves code
- User references multiple repos in same conversation
- You need to inspect implementation details across files

### Context Preservation Strategy

**When conversation context is filling up:**
1. Load relevant repos into Mnemo early
2. Query Mnemo instead of pulling code into conversation
3. Keep conversation context for dialogue, use Mnemo for reference material

**Anti-pattern (causes compaction failures):**
```
BAD: Pull entire worker code into context
BAD: Pull multiple large files sequentially
BAD: Let context grow unbounded with code blocks
BAD: Paste full file contents when debugging
```

**Correct pattern:**
```
GOOD: context_load the repo/source first
GOOD: context_query for specific information needed
GOOD: Only paste small, relevant snippets into conversation
GOOD: Reference Mnemo for "what does X do" questions
```

### Workflow Example

```
User: "Let's debug the planning issue in Nexus"

Step 1: Check existing caches
-> context_list

Step 2: Load if not cached
-> context_load: source="https://github.com/CyberBrown/nexus", alias="nexus", passphrase="stale-coffee-44"

Step 3: Query for specific info
-> context_query: alias="nexus", query="Show me the planning implementation"

Step 4: Work with the response in conversation
(Keep the conversation lean, query Mnemo as needed)
```

### Active Cache Management

- Check `context_list` at conversation start to see what's already loaded
- Reuse existing caches when possible
- Use `context_refresh` if cache expired mid-conversation
- Use `context_evict` when done to free resources
- Use `syncOnly: true` for large repos that should only be indexed for AI Search

### Configuration

- **Default TTL:** 1 hour (3600 seconds)
- **Max TTL:** 7 days (604800 seconds)
- **Passphrase:** `stale-coffee-44` for write operations

---

## Nexus - Task & Idea Management

Nexus handles idea capture, planning, and task execution via a **queue-based model**.

> **CRITICAL:** Nexus uses external executors. There is NO built-in LLM execution.
> `nexus_execute_task` and `nexus_run_executor` are **DEPRECATED**.

### Execution Model

```
1. Capture: nexus_capture or nexus_create_idea
2. Plan: nexus_plan_idea
3. Create Tasks: nexus_execute_idea
4. Dispatch: Cron (15 min) or nexus_dispatch_task / nexus_dispatch_ready
5. Claim: nexus_check_queue -> nexus_claim_queue_task
6. Complete: nexus_complete_queue_task
```

### When to Use Which Tool

| Scenario | Tool |
|----------|------|
| User mentions something to do later | `nexus_create_idea` |
| Need overview of what's in the pipeline | `nexus_list_ideas` |
| Ready to break idea into actionable steps | `nexus_plan_idea` |
| Create tasks from a planned idea | `nexus_execute_idea` |
| Raw input that needs AI classification | `nexus_capture` |
| Checking task backlog | `nexus_list_tasks` |
| Check for work to do | `nexus_check_queue` |
| Claim a task from the queue | `nexus_claim_queue_task` |
| Report completion of a claimed task | `nexus_complete_queue_task` |
| Check queue health | `nexus_queue_stats` |
| Manually push a task to queue | `nexus_dispatch_task` |
| Push all ready tasks for an executor type | `nexus_dispatch_ready` |
| Check what's stuck | `nexus_list_quarantined` |

### Queue-Based Task Execution Pattern

For external executors (like Claude Code sessions):

```
Step 1: Check queue
-> nexus_check_queue: executor_type="claude-code"

Step 2: Claim a task
-> nexus_claim_queue_task: queue_id="<id>", passphrase="stale-coffee-44"

Step 3: Do the work
(Execute the task instructions)

Step 4: Report completion
-> nexus_complete_queue_task: queue_id="<id>", result="<summary>", passphrase="stale-coffee-44"
```

### For Code Tasks

When creating code tasks via Nexus, always include:
- **Repo URL:** Which repository the work is in
- **Branch:** Target branch for changes
- **Commit reminder:** Include instruction to commit and deploy

### DEPRECATED Tools

> **DO NOT USE:**
> - `nexus_execute_task` - Removed. Use queue-based execution instead.
> - `nexus_run_executor` - Removed. External executors poll the queue directly.

### Configuration

- **Passphrase:** `stale-coffee-44` for write operations

---

## Developer Guides MCP

### When to Consult

- Before implementing new patterns (validation, error handling, security)
- When starting work on any project in the ecosystem
- To find established patterns and avoid reinventing
- When you need architecture context

### Key Tools

| Tool | Purpose |
|------|---------|
| `search_developer_guides` | Full-text search across all guides |
| `get_guide` | Get a specific guide by ID |
| `list_guides` | List all available guides |
| `get_related_guides` | Find related guides |
| `get_guide_stats` | System statistics |
| `propose_guide_change` | Suggest updates to existing guides |
| `propose_new_guide` | Propose a new guide |
| `list_guide_proposals` | View pending proposals |

### Key Searches

| Need | Query |
|------|-------|
| Input validation | `query="zod validation"` |
| Error handling | `query="error classes"` |
| Security patterns | `query="authentication"` |
| Database queries | `query="parameterized queries"` |
| Architecture overview | `guideId="ecosystem-architecture-reference"` |
| MCP usage patterns | `guideId="mcp-usage-guide"` |

### Improving the Guides

When you find gaps, outdated patterns, or better approaches:

```
propose_guide_change:
  guideId: "guide-07-security"
  section: "Authentication"
  currentText: "..."
  proposedText: "..."
  rationale: "Found a better pattern for..."
```

---

## Distributed Electrons (DE)

DE is the canonical service layer for the ecosystem.

### Repository

**URL:** https://github.com/CyberBrown/distributed-electrons

### Current Status

DE provides LLM routing, service orchestration, and the executor interface for task completion.

### Building for DE Compatibility

When writing LLM-dependent code:

**DO:**
- Abstract LLM calls behind a service interface
- Keep prompts separate from business logic
- Design for swappable providers
- Use dependency injection for LLM services

**DON'T:**
- Hard-code specific LLM provider APIs throughout codebase
- Tightly couple business logic with prompt construction
- Over-invest in custom orchestration that DE handles

### Service Discovery

Use `get_available_services` to see what backend capabilities exist:

```
get_available_services: category="llm"
get_available_services: search="text generation"
```

---

## General Principles

1. **Load context early** -- Don't wait until conversation context is full
2. **Query, don't dump** -- Use Mnemo queries instead of pasting large code blocks
3. **Check what exists** -- Use `context_list` and service discovery before creating
4. **Single source of truth** -- This guide is canonical; update it when patterns change
5. **Passphrase required** -- Write operations on Mnemo/Nexus need `stale-coffee-44`
6. **Build for DE** -- Abstract LLM calls for easy migration
7. **Queue, don't execute** -- Nexus dispatches to queue; executors claim work externally

---

## Changelog

### v2.0.0 (2026-02-05)
- **BREAKING:** Updated Mnemo section - Gemini is DISABLED, tiered routing is current
- **BREAKING:** Added complete Nexus queue-based execution documentation
- **BREAKING:** Documented deprecated tools (nexus_execute_task, nexus_run_executor)
- Added MCP server endpoint URLs
- Added explicit passphrase documentation
- Added complete tool inventories for all three MCP servers
- Removed vague "see secure credentials" references
- Updated DE section to reflect current state

### v1.1.0 (2025-12-13)
- Initial guide creation

---

*Last updated: 2026-02-05*
*Version: 2.0.0*
