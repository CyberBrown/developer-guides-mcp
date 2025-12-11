# Ecosystem Review Report

**Date:** 2025-12-11
**Repos Analyzed:** Nexus, Mnemo, Distributed Electrons (blocked)

---

## Executive Summary

This report documents the current state of the AI infrastructure ecosystem comprising three core services:

| Service | Role | Status |
|---------|------|--------|
| **Nexus** | "The Brain" - Strategy layer + long-term memory | Production-ready foundation |
| **Mnemo** | "Working Memory" - Short-term context buffer | Deployed and functional |
| **DE** | "Arms & Legs" - Backend execution layer | Unable to access (private repo) |

**Key Finding:** Significant documentation/reality mismatches discovered. The "voice-first" positioning needs removal from Nexus, and Mnemo's roadmap incorrectly describes DE's architecture.

---

## Repository Status Reports

### 1. Nexus - "The Brain"

**Repo:** `https://github.com/CyberBrown/nexus`

#### What's Actually Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| Full CRUD API | Working | Tasks, Projects, Inbox, Ideas, People, Commitments |
| D1 Database | Working | Multi-tenant schema with encryption |
| Durable Objects | Working | InboxManager, CaptureBuffer, SyncManager, UserSession |
| AI Classification | Working | Claude API integration, auto-creates tasks at >= 80% confidence |
| Recurring Tasks | Complete | Full RRULE support, scheduled cron job |
| App-Layer Encryption | Working | AES-256-GCM for sensitive fields |
| Zod Validation | Working | All inputs validated |
| Web Dashboard | Partial | Qwik-based, home/capture/inbox/tasks pages done |
| Test Suite | Passing | 93 tests (53 originally, more added) |
| Auth | Dev Mode | JWT tokens, needs production OAuth |

#### Tech Stack

- Runtime: Cloudflare Workers
- Database: Cloudflare D1 with app-layer encryption
- State: Durable Objects
- Package Manager: Bun (correct)
- Frontend: Qwik (Cloudflare Pages)

#### Documentation Issues Found

1. **README.md** - Just a boilerplate `bun init` stub. Completely inadequate.
2. **CLAUDE.md Line 6** - Says "voice-first, AI-native productivity system" - **NEEDS REMOVAL**
3. **WEB_DASHBOARD_SUMMARY.md** - Repeatedly mentions "voice-first" - needs updating
4. **Next Phase section** - Mentions "Android client with continuous voice capture" - misleading priority

#### Files Needing Updates

| File | Issue |
|------|-------|
| `README.md` | Complete rewrite needed |
| `CLAUDE.md` | Remove "voice-first" positioning |
| `WEB_DASHBOARD_SUMMARY.md` | Update terminology |

---

### 2. Mnemo - "Working Memory"

**Repo:** `https://github.com/Logos-Flux/mnemo`
**Deployed:** `https://mnemo.solamp.workers.dev/mcp`

#### What's Actually Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| MCP Server | Working | JSON-RPC 2.0 protocol |
| context_load | Working | Load repos, URLs, PDFs into Gemini cache |
| context_query | Working | Natural language queries |
| context_list | Working | List active caches |
| context_evict | Working | Remove caches |
| context_stats | Working | Usage tracking with cost estimates |
| context_refresh | Working | Reload cache content |
| URL Adapter | Working | Crawling, PDF extraction, robots.txt |
| D1 Storage | Working | Cache metadata persistence |
| Rate Limiting | Working | 30 req/min per IP |
| Auth Middleware | Working | Optional Bearer token |

#### Tech Stack

- Runtime: Bun (local), Cloudflare Workers (deployed)
- Package Structure: Monorepo (@mnemo/core, @mnemo/mcp-server, @mnemo/cf-worker, @mnemo/local)
- Database: D1 (Workers), SQLite (local)
- LLM: Gemini 1M token context cache

#### Documentation Issues Found

1. **ROADMAP.md** - Major problem! Describes "Digital Executive (DE) Architecture" as if it's Mnemo's vision
2. **ROADMAP.md v0.3** - "Active Memory Manager" describes functionality that belongs to Nexus
3. **The tier system** described in ROADMAP should be in DE, not Mnemo
4. **README.md** - Actually good and accurate for current features

#### Roadmap Items That Should Move

| Item | Currently In | Should Be In | Reason |
|------|--------------|--------------|--------|
| Active Memory Manager | Mnemo v0.3 | Nexus | Nexus decides WHAT context is relevant |
| Session Awareness | Mnemo v0.3 | Nexus | Nexus tracks conversation/session state |
| Proactive Loading triggers | Mnemo v0.3 | Nexus | Nexus detects entities, orchestrates loading |
| Tier 1/Tier 2 architecture | Mnemo ROADMAP | DE | DE handles tiered processing |
| Entity extraction | Mnemo v0.3 | Nexus | Nexus owns entity recognition |

---

### 3. Distributed Electrons (DE) - "Arms & Legs"

**Repo:** `https://github.com/Logos-Flux/distributed-electrons`
**Status:** UNABLE TO ACCESS (private repository)

#### Known Information (from context provided)

| Component | Expected Status |
|-----------|-----------------|
| Multi-tenant architecture | Mature |
| Provider adapters | Working |
| Rate limiting per provider | Working |
| Workers (text/image/audio/video) | Working |
| Service Registry | Static config (needs D1 migration) |
| Prompt Library | Unknown |
| Feedback Loop | Missing |

#### Gaps Identified (from context)

1. **Service Registry** - Uses static config, needs D1 database
2. **Feedback Loop** - No mechanism for apps to grade responses and improve prompts

---

## Boundary Clarification

### The Request Flow

```
User → Bridge → Nexus → (Tier 1 local OR Tier 2 via DE) → Response
                  ↓
               Mnemo (context loading/querying as needed)
```

### Service Responsibilities

#### Nexus (The Brain)

| Responsibility | Description |
|----------------|-------------|
| Long-term memory | Store/retrieve persistent facts, relationships |
| Tier 1 classification | Fast/cheap edge AI for initial triage |
| Escalation decisions | Determine when to escalate to Tier 2 (DE) |
| Input/output coordination | Route inputs to correct handlers |
| Email ingestion | Receive and classify incoming emails |
| Task/project/inbox management | Core productivity data model |
| **Context orchestration** | Tell Mnemo WHAT context to load |
| **Entity detection** | Extract entities from conversation, trigger context loading |

#### Mnemo (Working Memory)

| Responsibility | Description |
|----------------|-------------|
| Context caching | Hold large context in Gemini's 1M token cache |
| Real-time querying | Answer questions about cached context |
| Source loading | Load repos, URLs, PDFs into cache |
| Token management | Track usage, costs, cache expiry |
| **NOT** deciding what to load | That's Nexus's job |
| **NOT** session tracking | That's Nexus's job |

#### DE (Arms & Legs)

| Responsibility | Description |
|----------------|-------------|
| Tier 2+ processing | LLM-powered analysis requiring heavy compute |
| Provider routing | Send requests to correct LLM/service |
| Rate limiting | Manage per-provider quotas |
| Worker execution | Text, image, audio, video processing |
| Prompt library | Manage optimized prompts |
| Service registry | Track available workers |
| **NOT** the brain | Receives requests, figures out HOW to fulfill |

#### Bridge (Future UI)

| Responsibility | Description |
|----------------|-------------|
| User interface | Command center for all interactions |
| Multi-modal input | Text, voice, audio, video, images |
| Platform coverage | PC, phone, web, system tray |
| Direct Nexus access | Bridge talks to Nexus |
| **NOT** built yet | Future project |

### Boundary Examples

| Scenario | Nexus Does | Mnemo Does | DE Does |
|----------|-----------|-----------|---------|
| User mentions "Istanbul" | Detects entity, decides to load Turkey/warehouse context | Receives load command, caches content | Not involved |
| Complex code analysis needed | Classifies as Tier 2, routes to DE | May be queried for codebase context | Runs analysis with Claude/GPT |
| Email arrives | Ingests, classifies, stores in inbox | Not involved | Called if Tier 2 classification needed |
| User asks "What's in my calendar?" | Queries Google Calendar integration | Not involved | Not involved |

---

## Updated README Proposals

### Nexus README.md (Proposed)

```markdown
# Nexus

**The Brain** - AI-powered personal productivity system that captures, organizes, and surfaces information at the right time.

## Ecosystem Role

Nexus is the strategy layer and long-term memory coordinator in the AI infrastructure ecosystem:

| Pillar | Role |
|--------|------|
| **Nexus** (this) | The Brain - strategy, memory, classification |
| [Mnemo](https://github.com/Logos-Flux/mnemo) | Working Memory - context caching |
| [DE](https://github.com/Logos-Flux/distributed-electrons) | Arms & Legs - execution layer |
| Bridge (future) | User Interface - command center |

## Current Status: Foundation Complete

### What's Working

- Full CRUD API for tasks, projects, inbox, ideas, people, commitments
- AI classification via Claude (auto-creates tasks at >= 80% confidence)
- Recurring tasks with RRULE support
- App-layer encryption (AES-256-GCM)
- Multi-tenant architecture
- 4 Durable Objects for real-time state
- Web dashboard (partial - Qwik/Cloudflare Pages)
- 93 passing tests

### Tech Stack

- **Runtime:** Cloudflare Workers
- **Database:** Cloudflare D1
- **State:** Durable Objects
- **Package Manager:** Bun

## Quick Start

```bash
bun install
bun run dev          # Start local server
bun test             # Run tests
bun run deploy       # Deploy to Cloudflare
```

## Roadmap

### Next Up
1. Production auth (OAuth/Clerk)
2. Complete web dashboard pages
3. Mnemo integration for context loading
4. Email ingestion (Gmail/IMAP)

### Future
- Google Calendar sync
- Cross-device sync
- Android/iOS clients (via Bridge)

## API

| Endpoint | Description |
|----------|-------------|
| `/api/tasks` | Task management |
| `/api/projects` | Project management |
| `/api/inbox` | Inbox processing |
| `/api/capture` | AI-classified capture |
| `/api/ideas` | Someday/maybe items |
| `/api/people` | Contacts |
| `/api/commitments` | Waiting-for/owed-to |
```

### Mnemo README.md (Current is mostly fine, add ecosystem section)

Add this section after the intro:

```markdown
## Ecosystem Role

Mnemo is the working memory layer in the AI infrastructure ecosystem:

| Pillar | Role |
|--------|------|
| [Nexus](https://github.com/CyberBrown/nexus) | The Brain - orchestrates what context to load |
| **Mnemo** (this) | Working Memory - holds and queries context |
| [DE](https://github.com/Logos-Flux/distributed-electrons) | Arms & Legs - execution layer |
| Bridge (future) | User Interface |

### Integration with Nexus

Current: Mnemo works standalone; users manually load context.

Future: Nexus will orchestrate Mnemo:
- Nexus detects entities in conversation
- Nexus tells Mnemo what context to load
- Mnemo holds the context, Nexus queries it
```

---

## Consolidated Roadmap

### Priority 1: Foundation Fixes (Now)

| Item | Repo | Description |
|------|------|-------------|
| Remove "voice-first" | Nexus | Update CLAUDE.md, dashboard summaries |
| Fix Nexus README | Nexus | Complete rewrite |
| Clarify Mnemo ROADMAP | Mnemo | Move DE architecture to DE, Nexus items to Nexus |
| Add ecosystem sections | All | Cross-reference other pillars |

### Priority 2: Nexus Completion

| Item | Description |
|------|-------------|
| Production auth | OAuth/Clerk integration |
| Complete dashboard | Projects, Ideas, People, Commitments pages |
| Email ingestion | Gmail/IMAP integration |
| Speech-to-text | Integrate with Cloudflare AI or external service |

### Priority 3: Nexus-Mnemo Integration

| Item | Owner | Description |
|------|-------|-------------|
| Context orchestration | Nexus | Nexus decides what to load |
| Entity detection | Nexus | Extract entities from conversation |
| Mnemo client | Nexus | API client to call Mnemo |
| Session awareness | Nexus | Track conversation state |

### Priority 4: DE Improvements (when accessible)

| Item | Description |
|------|-------------|
| D1 service registry | Replace static config |
| Feedback loop | Apps grade responses, improve prompts |

### Deferred (Bridge)

Bridge is explicitly a future project. Do not build yet.

---

## Items Needing Human Decision

### 1. Private Repo Access

**Issue:** Cannot access `distributed-electrons` repo
**Decision Needed:** Grant access or provide exported documentation

### 2. Mnemo ROADMAP Restructure

**Issue:** Mnemo's ROADMAP.md describes the entire DE architecture (Tier 1/Tier 2) and includes items that belong to Nexus (Active Memory Manager).

**Options:**
a) Completely rewrite Mnemo ROADMAP to focus only on Mnemo's role
b) Move v0.3+ items to respective repos and note them as "integration points"
c) Create a separate ECOSYSTEM_ARCHITECTURE.md document

**Recommendation:** Option (a) - cleaner separation

### 3. "Active Memory Manager" Ownership

**Issue:** Mnemo ROADMAP v0.3 describes proactive context loading based on conversation signals. This should be Nexus's responsibility.

**Decision Needed:** Confirm that:
- Nexus owns entity detection and context orchestration
- Mnemo remains a "dumb" cache that does what it's told
- Move Active Memory Manager roadmap items to Nexus

### 4. Nexus Web Dashboard - Voice UI

**Issue:** The web dashboard was built with "voice-first" positioning. Should we:
a) Remove voice capture entirely (Bridge's job)
b) Keep basic voice capture as a Nexus feature
c) Refocus as "text capture with optional voice"

**Recommendation:** Option (c) - Voice capture is useful, just shouldn't be the primary positioning

### 5. Naming Consistency

**Issue:** "Digital Executive" (DE) is sometimes used to mean:
- The `distributed-electrons` repo specifically
- The entire ecosystem vision

**Decision Needed:** Clarify naming:
- DE = `distributed-electrons` repo (execution layer)
- Ecosystem = all four pillars together (needs a name?)

---

## Technical Debt Identified

### Nexus

1. TypeScript errors in Qwik event handlers (cosmetic, runtime works)
2. Dev-only JWT auth needs production replacement
3. 2 skipped tests for BYDAY off-by-one bug
4. Missing database migration for recurring task indexes

### Mnemo

1. Rate limit store is in-memory (resets on worker restart)
2. pnpm-workspace.yaml exists but decision was Bun (clarify)
3. No tests visible in cf-worker package

---

## Appendix: Files Changed/Created

This review created the following files:

| File | Location | Purpose |
|------|----------|---------|
| `ECOSYSTEM_REVIEW_REPORT.md` | This repo | Main deliverable |

Files recommended for update:

| File | Repo | Change Needed |
|------|------|---------------|
| `README.md` | Nexus | Complete rewrite |
| `CLAUDE.md` | Nexus | Remove "voice-first" |
| `WEB_DASHBOARD_SUMMARY.md` | Nexus | Update terminology |
| `ROADMAP.md` | Mnemo | Major restructure |
| `README.md` | Mnemo | Add ecosystem section |

---

## Next Steps

1. **Review this report** with stakeholders
2. **Decide on items** in "Needs Human Decision" section
3. **Update documentation** in Nexus (README, CLAUDE.md)
4. **Restructure** Mnemo ROADMAP
5. **Access DE repo** for full audit
6. **Create boundary documentation** in each repo

---

*Report generated by Claude Code ecosystem review*
