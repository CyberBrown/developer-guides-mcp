---
id: mcp-usage-guide
title: MCP Server Usage Guide
category: tools
type: guide
status: draft
version: 1.1.0
last_updated: 2025-12-13
tags: [mcp, mnemo, nexus, de, context-management, tools]
related_guides: [ecosystem-architecture-reference, scale-orchestration-guide]
---

# MCP Server Usage Guide

## Purpose

This guide is the **single source of truth** for MCP server usage patterns. Claude (both Claude.ai and Claude Code) should consult this guide before using ecosystem MCP servers.

**Memory points here** — update this guide to change behavior, not memory.

---

## Confirming Sync

When starting a session involving MCP servers, confirm you have access to this guide:

```
developer-guides: get_guide guideId="mcp-usage-guide"
```

If this returns successfully, you're in sync. No need to loop — just confirm once and proceed.

---

## Mnemo - Extended Context Memory

Mnemo provides 1M+ token context via Gemini's caching. Use it to keep conversation context lean while maintaining access to large codebases.

### When to Proactively Load Context

**ALWAYS load into Mnemo BEFORE:**
- Pulling large code files into conversation context
- Starting work on any codebase (Nexus, DE, Mnemo, Content Forge, etc.)
- Debugging across multiple files or repositories
- When a conversation is getting long and you need to reference code repeatedly

**Trigger patterns — load proactively when:**
- User says "let's work on [project]" or "can you help with [codebase]"
- You're about to use `workers_get_worker_code` or similar large-payload tools
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
❌ Pull entire worker code into context with workers_get_worker_code
❌ Pull multiple large files sequentially
❌ Let context grow unbounded with code blocks
❌ Paste full file contents when debugging
```

**Correct pattern:**
```
✅ context_load the repo/source first
✅ context_query for specific information needed
✅ Only paste small, relevant snippets into conversation
✅ Reference Mnemo for "what does X do" questions
```

### Workflow Example

```
User: "Let's debug the planning issue in Nexus"

Step 1: Check existing caches
→ context_list

Step 2: Load if not cached
→ context_load: source="https://github.com/CyberBrown/nexus", alias="nexus"

Step 3: Query for specific info
→ context_query: alias="nexus", query="Show me the planning implementation in IdeaExecutor"

Step 4: Work with the response in conversation
(Keep the conversation lean, query Mnemo as needed)
```

### Active Cache Management

- Check `context_list` at conversation start to see what's already loaded
- Reuse existing caches when possible
- Use `context_refresh` if cache expired mid-conversation
- Use `context_evict` when done to free resources

### Configuration

- **Passphrase for writes:** Required (see secure credentials)
- **Default TTL:** 1 hour (3600 seconds)
- **Max TTL:** 24 hours (86400 seconds)

---

## Nexus - Task & Idea Management

Nexus handles idea capture, planning, and task execution. **Currently under active development.**

For detailed architecture and current status, see: `get_guide guideId="ecosystem-architecture-reference"`

### When to Use

| Tool | Use When |
|------|----------|
| `nexus_create_idea` | User mentions something to do later, or wants to capture a thought |
| `nexus_list_ideas` | Need overview of what's in the pipeline |
| `nexus_get_status` | Checking progress on specific idea |
| `nexus_plan_idea` | Ready to break idea into actionable steps |
| `nexus_capture` | Raw input that needs AI classification |
| `nexus_list_tasks` | Checking task backlog |

### Current Status

Nexus is under active development. Check the ecosystem architecture reference for current capabilities and roadmap.

### Configuration

- **Passphrase for writes:** Required (see secure credentials)

---

## Developer Guides MCP

### When to Consult

- Before implementing new patterns (validation, error handling, security)
- When starting work on any project in the ecosystem
- To find established patterns and avoid reinventing
- When you need architecture context

### Key Searches

| Need | Query |
|------|-------|
| Input validation | `query="zod validation"` |
| Error handling | `query="error classes"` |
| Security patterns | `query="authentication"` |
| Database queries | `query="parameterized queries"` |
| Architecture overview | `guideId="ecosystem-architecture-reference"` |

---

## Distributed Electrons (DE)

DE will be the canonical LLM orchestration layer for the ecosystem.

### Current Status

DE is in active development. Currently used for testing with specific apps (e.g., Living Arts).

### Future Architecture

All apps will route LLM calls through DE:
- **App responsibility:** Internal function orchestration, business logic
- **DE responsibility:** LLM orchestration, model selection, prompt management, rate limiting

### Building for DE Compatibility

When writing LLM-dependent code now:

**DO:**
- Abstract LLM calls behind a service interface
- Keep prompts separate from business logic
- Design for swappable providers
- Use dependency injection for LLM services

**DON'T:**
- Hard-code specific LLM provider APIs throughout codebase
- Tightly couple business logic with prompt construction
- Over-invest in custom orchestration that DE will replace

### Service Discovery (When Ready)

Use `get_available_services` to see what backend capabilities exist:

```
get_available_services: category="llm"
get_available_services: search="text generation"
```

---

## General Principles

1. **Load context early** — Don't wait until conversation context is full
2. **Query, don't dump** — Use Mnemo queries instead of pasting large code blocks
3. **Check what exists** — Use `context_list` and service discovery before creating
4. **Single source of truth** — This guide is canonical; update it when patterns change
5. **Passphrase required** — Write operations on Mnemo/Nexus need credentials (see secure store)
6. **Build for DE** — Abstract LLM calls now for easy migration later

---

## Updating This Guide

When you discover better patterns or encounter issues:
1. Note what went wrong (e.g., "conversation failed to compact")
2. Identify the root cause (e.g., "pulled too much code into context")
3. Update this guide with the lesson learned
4. Memory stays stable, guide evolves

---

*Last updated: 2025-12-13*
*Version: 1.1.0*
