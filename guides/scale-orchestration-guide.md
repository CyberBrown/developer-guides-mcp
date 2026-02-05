---
id: scale-orchestration-guide
title: Scale & Multi-Agent Orchestration Guide
category: architecture
type: guide
status: draft
version: 1.1.0
last_updated: 2026-02-05
tags: [scale, multi-agent, orchestration, parallel-development, claude-code, nexus, queue]
related_guides: [ecosystem-architecture-reference, mcp-usage-guide, guide-02-11-arch-devops]
---

# Scale & Multi-Agent Orchestration Guide

## Overview

This guide covers scaling development through multi-agent orchestration. The goal is to push scale as hard as possible given available resources.

**Key Principle:** Multi-agent development is a paradigm, not an exception. We should be comfortable running multiple clusters of agents in parallel.

---

## Integration with Nexus

> **NEW:** Multi-agent orchestration now integrates with Nexus for task management.
> Use Nexus to create ideas, plan them into tasks, and dispatch to the queue.
> External executors (Claude Code instances) claim tasks from the queue.

### Nexus-Powered Workflow

```
1. Create idea in Nexus: nexus_create_idea
2. Plan the idea: nexus_plan_idea
3. Execute (create tasks): nexus_execute_idea
4. Dispatch tasks to queue: nexus_dispatch_ready
5. Each agent claims work: nexus_check_queue -> nexus_claim_queue_task
6. Agent completes work: nexus_complete_queue_task
```

This replaces manual task assignment with a queue-based system where agents self-organize.

---

## The Scale Mindset

### Traditional vs Scale Thinking

| Traditional | Scale Thinking |
|-------------|----------------|
| One developer, one task | Multiple agents, parallel tasks |
| Sequential development | Concurrent development |
| Wait for completion | Progress on multiple fronts |
| Manual resource allocation | Queue-based self-organization |

### Core Philosophy

> We should not be worried about having four clusters of four leaders running four coders each. This is about scale.

---

## Multi-Agent Architecture

### The 4x4x4 Model

Proven structure from production use:

```
                    +------------------+
                    |   YOU (Human)    |
                    |   Strategic      |
                    |   Oversight      |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
              v              v              v
        +-----------+  +-----------+  +-----------+
        | Leader 1  |  | Leader 2  |  | Leader 3  |  ... (up to 4)
        | Team A    |  | Team B    |  | Team C    |
        +-----+-----+  +-----+-----+  +-----+-----+
              |              |              |
    +----+----+----+----+   ...           ...
    |    |    |    |    |
    v    v    v    v    v
  +--+ +--+ +--+ +--+ +--+
  |C1| |C2| |C3| |C4| |..| (4 coders per team)
  +--+ +--+ +--+ +--+ +--+
```

### Roles

**Human (You)**
- Strategic decisions
- Resource allocation
- Conflict resolution
- Final approval

**Team Leaders (4 max)**
- Coordinate their team
- Break down work into coder tasks
- Integrate team outputs
- Escalate blockers

**Coders (4 per leader)**
- Execute specific tasks
- Self-contained work units
- Report to team leader
- No cross-team dependencies (ideally)

---

## Implementation Patterns

### Phase-Based Execution

> **IMPORTANT:** Use phases for sequencing, NOT calendar dates.
> Claude consistently underestimates human execution speed by 10-20x.

```
Phase 1: Infrastructure (Sequential)
         Team 1 completes foundation
                |
Phase 2: Workers + Ops (Parallel)
         Teams 2 & 3 work simultaneously
                |
Phase 3: Interfaces (Sequential)
         Team 4 builds on completed work
```

### Task Decomposition

Each coder task should be:
- **Self-contained:** No waiting on other coders
- **Clearly scoped:** Specific deliverable
- **Testable:** Can verify completion
- **Repo-tagged:** Include which repo and branch

#### Good Task Examples
```
GOOD: "Create D1 schema for user authentication in nexus repo, branch feat/auth"
GOOD: "Implement rate limiter using Durable Objects in DE repo"
GOOD: "Build admin panel component for service list in bridge repo"
```

#### Bad Task Examples
```
BAD: "Work on the backend" (too vague)
BAD: "Fix bugs" (not scoped)
BAD: "Help Team 2" (dependency, not deliverable)
```

---

## Delegation Mindset

### The Cascade

Before involving a human, cascade through options:

```
Can I (Claude) do this myself?
        | No
Can another MCP server handle this?
        | No
Can we dispatch to Nexus queue for another executor?
        | No
-> Then involve the human
```

---

## Practical Setup

### Starting a Multi-Agent Session

1. **Define the work** - Create idea in Nexus
2. **Plan it** - Use `nexus_plan_idea` to break down
3. **Create tasks** - Use `nexus_execute_idea`
4. **Dispatch** - Use `nexus_dispatch_ready`
5. **Agents claim work** - Each agent polls `nexus_check_queue`
6. **Monitor** - Use `nexus_list_active` and `nexus_queue_stats`

### Tool Requirements

Each agent needs:
- [ ] claude-mcp-config installed
- [ ] Relevant MCP servers enabled (mnemo, nexus, developer-guides)
- [ ] Access to shared resources (repos, D1, R2)
- [ ] Passphrase for write operations: `stale-coffee-44`

---

## Session Wrap-Up Protocol

### Why Wrap-Up Matters

**Critical Rule:** Nothing stays local. All work must be pushed to remote before ending a session.

### Wrap-Up Checklist

```
1. GIT STATUS
   [ ] Check for uncommitted changes: git status
   [ ] Stage and commit any work
   [ ] Push to remote: git push
   [ ] Verify push succeeded

2. DEPLOYMENTS
   [ ] Workers deployed to Cloudflare? (bunx wrangler deploy)
   [ ] Database migrations applied? (D1)
   [ ] Secrets updated? (wrangler secret put)

3. DOCUMENTATION
   [ ] CLAUDE.md updated with new info?
   [ ] Developer guides updated? (propose_guide_change)

4. NEXUS UPDATE
   [ ] Mark completed tasks: nexus_complete_queue_task
   [ ] Update task status: nexus_complete_task
   [ ] Note any blockers: nexus_resolve_blocker

5. SESSION SUMMARY
   [ ] What was accomplished?
   [ ] What's next?
   [ ] Any blockers?
```

### Remote Destinations by Asset Type

| Asset Type | Remote Destination | Command |
|------------|-------------------|---------|
| Code | GitHub | `git push` |
| Workers | Cloudflare | `bunx wrangler deploy` |
| Database schema | D1 | `wrangler d1 migrations apply` |
| Secrets | CF Workers | `wrangler secret put` |
| R2 assets | Cloudflare R2 | Already remote |
| Documentation | GitHub (in repo) | `git push` |
| Task status | Nexus | `nexus_complete_queue_task` |

---

## Coordination Strategies

### Avoiding Conflicts

**Code conflicts:**
- Each coder works in separate files/modules
- Integration happens at leader level
- Use feature branches

**Resource conflicts:**
- Rate limits shared at instance level
- Coordinate API-heavy work
- Stagger deployments

**Knowledge conflicts:**
- Single source of truth (developer-guides MCP)
- Leader resolves team ambiguity
- Human resolves cross-team ambiguity

---

## Anti-Patterns

### What NOT to Do

- **Tight coupling between coders** - Creates blocking dependencies
- **Unclear task boundaries** - Multiple coders touch same files
- **No escalation path** - Blockers sit unresolved
- **Using deprecated tools** - `nexus_execute_task` and `nexus_run_executor` are gone
- **Calendar-based estimates** - Use phases instead
- **Skipping Nexus** - Manual task tracking doesn't scale

---

## Related Guides

- [Ecosystem Architecture Reference](./ecosystem-architecture-reference.md)
- [MCP Usage Guide](./mcp-usage-guide.md)

---

## Changelog

### v1.1.0 (2026-02-05)
- Added Nexus queue-based integration for multi-agent orchestration
- Updated deployment command to `bunx wrangler deploy`
- Added Nexus task update to wrap-up checklist
- Added phase-based planning guidance (no calendar estimates)
- Updated anti-patterns with deprecated tools warning
- Added passphrase documentation

### v1.0.0 (2025-12-04)
- Initial guide creation
- 4x4x4 model documentation
- Resource acquisition loop
- Delegation mindset

---

**Remember:** Scale is a paradigm, not a special case. Push it as hard as resources allow.
