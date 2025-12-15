---
id: open-source-patterns-synthesis
title: Open Source Patterns Synthesis - Feature Adoption Roadmap
category: architecture
type: planning
status: draft
version: 1.0.0
last_updated: 2025-12-12
tags: [mnemo, nexus, DE, distributed-electrons, memory, orchestration, patterns, roadmap, progressive-disclosure, recipes, events]
related_guides: [ecosystem-architecture-reference, guide-05-10-db-perf, guide-01-fundamentals, guide-02-11-arch-devops]
---

# Open Source Patterns Synthesis
## Feature Adoption Roadmap for Mnemo, Nexus & DE

**Date:** December 12, 2025  
**Version:** 1.0.0  
**Status:** Draft  
**Related:** [Ecosystem Architecture Reference](developer-guides-mcp://ecosystem-architecture-reference)

**Sources Analyzed:**
- [CaviraOSS/OpenMemory](https://github.com/CaviraOSS/OpenMemory) - Cognitive memory system (337K tokens)
- [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) - Claude Code persistent memory
- [basecamp/fizzy](https://github.com/basecamp/fizzy) - Project management, entropy, events
- [refly-ai/refly](https://github.com/refly-ai/refly) - Canvas, multi-threaded conversations
- [block/goose](https://github.com/block/goose) - Autonomous agent, recipes, scheduling

---

## Alignment with Ecosystem Architecture

This document extends the core architecture defined in the [Ecosystem Architecture Reference](developer-guides-mcp://ecosystem-architecture-reference). All patterns follow the **Three Pillars** philosophy:

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

**Fundamental Rule:** Custom frontends + Distributed backend. Apps are just interfaces. All compute happens in the worker swarm.

---

## Current DE Service Status

Per the Service Registry, these services are relevant to this planning document:

| Service | Status | Category | Relevance |
|---------|--------|----------|-----------|
| **mnemo** | beta | memory | Progressive disclosure, context indexing |
| **nexus** | planned | memory | Temporal facts, observations, events |
| **text-gen** | active | llm | Recipe execution, classification |
| **config-service** | active | utility | Tenant/project AI hints |

> **CRITICAL:** When implementing these patterns, the Service Registry MUST be updated. This is a PR checklist item per ecosystem guidelines.

---

## Executive Summary

This document synthesizes patterns from five open source projects that directly address gaps in the Distributed Electrons ecosystem. The analysis reveals complementary capabilities across two domains:

**Memory & Context Management** (Mnemo enhancement):
- Progressive disclosure reduces token usage by 90%+
- Lightweight indexing enables on-demand context fetching
- Temporal knowledge graphs track fact evolution

**Orchestration & Automation** (Nexus enhancement):
- Recipe-based workflow automation with retry logic
- Event-driven activity tracking enables analytics
- Automatic entropy/decay keeps lists manageable
- Structured observation compression for AI outputs

### Priority Stack (Recommended Implementation Order)

| Priority | Pattern | Source | Target | Value |
|----------|---------|--------|--------|-------|
| 1 | Events & Activity Tracking | Fizzy | Nexus | Foundation for all analytics |
| 2 | Progressive Disclosure | Claude-Mem | Mnemo | 90%+ token savings |
| 3 | Temporal Knowledge Graph | OpenMemory | Nexus | Track entity state changes |
| 4 | Recipe System | Goose | Nexus | Autonomous workflows |
| 5 | Observation Compression | Claude-Mem | Nexus | Structured AI outputs |
| 6 | Multi-Sector Classification | OpenMemory | Nexus | Cognitive memory typing |
| 7 | Automatic Entropy | Fizzy | Nexus | Self-managing lists |
| 8 | Multi-Threaded Conversations | Refly | Nexus | Per-entity AI context |
| 9 | Token Economics | Claude-Mem | Both | ROI visibility |
| 10 | Scheduled Execution | Goose | Nexus | Cron-based automation |

---

## Part 1: Memory Patterns

### 1.1 Progressive Disclosure (Claude-Mem) ⭐⭐⭐

**Problem:** Loading full context (up to 1M tokens) is wasteful. Most context isn't needed for most queries.

**Solution:** Inject a lightweight index at session start; let the agent fetch details on-demand.

**How It Works:**
```
1. SESSION START
   ┌─────────────────────────────────────────┐
   │ Inject lightweight index:               │
   │ - Recent session titles + dates         │
   │ - Observation summaries (title, type)   │
   │ - Token estimates per section           │
   │ - "Use search to get full details"      │
   └─────────────────────────────────────────┘
                    ↓
2. AGENT PROCESSES REQUEST
   - Reads index, understands what's available
   - Determines what details are needed
                    ↓
3. ON-DEMAND FETCH
   - Agent queries for specific items
   - Only loads what's actually needed
   - Saves 90%+ tokens in most cases
```

**Context Index Format:**
```markdown
# [project-name] Context Index

**Last updated:** 2 hours ago | **Total sections:** 47 | **Est. tokens:** 234K

## Quick Reference
🎯 Active work: JWT authentication refactor
📁 Key files: src/auth/*, tests/auth/*
⚠️ Known issues: Token refresh race condition

## Available Sections
| ID | Title | Type | Tokens | When to Load |
|----|-------|------|--------|--------------|
| s1 | Auth Module | code | 12K | Auth questions |
| s2 | API Routes | code | 8K | Endpoint questions |
| s3 | Schema Docs | doc | 3K | Data model questions |

💡 **To load details:** `mnemo.query("project", "your specific question")`
```

**Application to Mnemo:**
```typescript
// New MCP Tool: context_index
interface ContextIndex {
  alias: string;
  index: {
    files: {
      path: string;
      description: string;
      tokens: number;
      concepts: string[];
    }[];
    entities: string[];
    total_tokens: number;
    last_updated: string;
  }
}

// Enhanced workflow
const contextIndex = await mnemo.generateIndex(alias);  // ~5K tokens
// vs
const fullContext = await mnemo.loadFullContext(alias);  // 1M tokens
```

**Action Items:**
- [ ] Add `context_index` tool to Mnemo
- [ ] Generate index on `context_load` (parallel to cache creation)
- [ ] Store index in KV for fast retrieval
- [ ] Add `index_only` option for lightweight loading

---

### 1.2 Temporal Knowledge Graph (OpenMemory) ⭐⭐⭐⭐

**Problem:** Facts change over time. "Who is the CEO?" has different answers at different times.

**Solution:** Facts have validity periods, enabling time-aware queries and fact evolution tracking.

**Schema:**
```sql
CREATE TABLE temporal_facts (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,     -- 'person', 'project', 'company'
  entity_id TEXT NOT NULL,       -- FK to people/projects/etc
  predicate TEXT NOT NULL,       -- 'role', 'status', 'owner'
  object TEXT NOT NULL,
  valid_from INTEGER NOT NULL,
  valid_to INTEGER,              -- NULL = still valid
  confidence REAL DEFAULT 1.0,
  source TEXT,                   -- 'user', 'ai_inferred', 'email'
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(entity_type, entity_id, predicate, object, valid_from)
);

CREATE INDEX idx_tf_entity ON temporal_facts(entity_type, entity_id);
CREATE INDEX idx_tf_valid ON temporal_facts(valid_from, valid_to);
```

**Key Operations:**
```typescript
// Insert fact (auto-closes previous facts)
const insert_fact = async (subject, predicate, object, valid_from, confidence) => {
  // Close any existing open facts for same subject+predicate
  await run(`UPDATE temporal_facts SET valid_to = ? 
    WHERE subject = ? AND predicate = ? AND valid_to IS NULL`,
    [valid_from - 1, subject, predicate]);
  
  // Insert new fact
  await run(`INSERT INTO temporal_facts (...) VALUES (...)`, [...]);
};

// Query facts at specific time
const query_facts_at_time = async (subject, predicate, at_date) => {
  return await all(`SELECT * FROM temporal_facts 
    WHERE subject = ? AND predicate = ?
    AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)`,
    [subject, predicate, at_date, at_date]);
};
```

**Use Case:** "Who was the primary contact for Project X in Q3?" becomes answerable.

---

### 1.3 Multi-Sector Memory Classification (OpenMemory) ⭐⭐⭐

**Problem:** Not all memories decay at the same rate. Procedural knowledge should persist longer than episodic events.

**Solution:** Classify content into cognitive memory types with different decay rates.

**Sector Configurations:**

| Sector | decay_lambda | Purpose | Pattern Examples |
|--------|--------------|---------|------------------|
| episodic | 0.015 | Events/experiences | "today", "yesterday", "remember when" |
| semantic | 0.005 | Facts/knowledge | "define", "meaning", "concept" |
| procedural | 0.008 | How-to/processes | "how to", "step by step", "configure" |
| emotional | 0.020 | Feelings/sentiment | "feel", "happy", "worried" |
| reflective | 0.001 | Meta-cognition | "think", "realize", "insight" |

**Classification Function:**
```typescript
const classifyContent = (text: string): Classification => {
  const scores = Object.entries(sector_configs).map(([sector, cfg]) => ({
    sector,
    score: cfg.patterns.reduce((sum, pattern) => 
      sum + (pattern.test(text) ? cfg.weight : 0), 0)
  }));
  
  const sorted = scores.sort((a, b) => b.score - a.score);
  return {
    primary: sorted[0].sector,
    additional: sorted.slice(1, 3).filter(s => s.score > 0).map(s => s.sector),
    confidence: sorted[0].score / (sorted[0].score + sorted[1].score + 0.1)
  };
};
```

**Application to Nexus:** Enhance inbox classification beyond simple categories. Items classified as "procedural" decay slower than "episodic."

---

### 1.4 Salience Decay with Tiers (OpenMemory) ⭐⭐⭐

**Problem:** Old, unreferenced items clutter the system. Manual cleanup is tedious.

**Solution:** Memories fade naturally unless reinforced. Tier assignment affects decay rate.

**Tier Classification:**
```typescript
const pick_tier = (memory, now_ts): "hot" | "warm" | "cold" => {
  const dt = now_ts - (memory.last_seen_at || memory.updated_at);
  const recent = dt < 6 * 86_400_000; // 6 days
  const high = memory.coactivations > 5 || memory.salience > 0.7;
  
  if (recent && high) return "hot";
  if (recent || memory.salience > 0.4) return "warm";
  return "cold";
};

// Tier-specific decay rates
const lambda = {
  hot: 0.005,   // Slow decay
  warm: 0.02,   // Medium decay
  cold: 0.05    // Fast decay
};

// Decay formula
// new_salience = salience × e^(-λ × days_since_seen / (salience + 0.1))
```

**Reinforcement on Query:**
```typescript
const on_query_hit = async (mem_id: string) => {
  const new_sal = Math.min(1, memory.salience + 0.1);
  await run(`UPDATE memories SET salience=?, last_seen_at=? WHERE id=?`,
    [new_sal, Date.now(), mem_id]);
};
```

---

## Part 2: Orchestration Patterns

### 2.1 Events & Activity Tracking (Fizzy) ⭐⭐⭐⭐

**Problem:** No audit trail of entity changes. Can't power activity feeds, webhooks, or analytics.

**Solution:** Universal event system. Every significant action creates an event record.

**D1 Schema:**

> **Guide Compliance:** This schema follows patterns from [guide-05-10-db-perf](developer-guides-mcp://guide-05-10-db-perf):
> - UUID primary keys via `lower(hex(randomblob(16)))`
> - Proper foreign key constraints
> - Strategic indexing on query patterns
> - NOT NULL constraints where appropriate

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  eventable_type TEXT NOT NULL,
  eventable_id TEXT NOT NULL,
  particulars TEXT,  -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_events_tenant_created ON events(tenant_id, created_at DESC);
CREATE INDEX idx_events_eventable ON events(eventable_type, eventable_id);
CREATE INDEX idx_events_user ON events(user_id, created_at DESC);
```

**Action Types:**

| Entity | Actions |
|--------|---------|
| InboxItem | `inbox_captured`, `inbox_classified`, `inbox_promoted`, `inbox_archived` |
| Task | `task_created`, `task_updated`, `task_completed`, `task_delegated`, `task_postponed` |
| Project | `project_created`, `project_updated`, `project_completed`, `project_archived` |
| Idea | `idea_created`, `idea_promoted`, `idea_archived` |
| Commitment | `commitment_created`, `commitment_fulfilled`, `commitment_reminded` |

**Unlocks:**
- Activity timelines in Bridge
- Webhook dispatch system
- Notification triggers
- Analytics/patterns
- AI insights ("you complete 80% of tasks captured before noon")

---

### 2.2 Recipe System for Workflows (Goose) ⭐⭐⭐⭐

**Problem:** No way to define reusable, automated workflows. Recurring patterns require manual intervention.

**Solution:** YAML-defined recipes with instructions, parameters, retry logic, and scheduling.

**D1 Schema:**
```sql
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  
  -- Core recipe definition
  instructions TEXT NOT NULL,  -- AI instructions (supports templates)
  parameters TEXT,  -- JSON array of parameter definitions
  extensions TEXT,  -- JSON array of required DE services
  
  -- Execution settings
  timeout_seconds INTEGER DEFAULT 300,
  max_turns INTEGER DEFAULT 10,  -- Autonomy limit
  
  -- Retry configuration
  retry_config TEXT,  -- JSON: {max_retries, checks[], on_failure}
  
  -- Scheduling
  schedule TEXT,  -- Cron expression (null = manual only)
  schedule_enabled INTEGER DEFAULT 0,
  last_run_at TEXT,
  next_run_at TEXT,
  
  -- Metadata
  is_template INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE recipe_runs (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'running', 'completed', 'failed'
  trigger_type TEXT NOT NULL,  -- 'manual', 'scheduled', 'webhook'
  parameters_used TEXT,
  output TEXT,
  error TEXT,
  turns_used INTEGER,
  tokens_used INTEGER,
  started_at TEXT,
  completed_at TEXT,
  duration_ms INTEGER,
  attempt_number INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);
```

**Recipe YAML Format:**
```yaml
version: "1.0.0"
title: "Inbox Triage"
description: "Classify and route new inbox items"

instructions: |
  You are an inbox classifier for a GTD productivity system.
  Analyze each inbox item and classify it as one of:
  - task: Actionable item with clear next step
  - project: Multi-step outcome requiring planning
  - idea: Someday/maybe item for future consideration
  - reference: Information to file, not actionable
  - commitment: Promise made to/by someone

parameters:
  - key: batch_size
    type: integer
    default: 10
  - key: confidence_threshold
    type: number
    default: 0.8

extensions:
  - name: inbox-classifier
    service: de/classifier

retry:
  max_retries: 3
  checks:
    - type: output_contains
      value: "classification_complete"

settings:
  max_turns: 15
  temperature: 0.3
```

**Sub-Recipe Pattern:**
```yaml
# main-inbox-processor.yaml
sub_recipes:
  - name: "classify_item"
    path: "./sub-recipes/classifier.yaml"
    values:
      model: "fast"
      
  - name: "create_task"
    path: "./sub-recipes/task-creator.yaml"
```

---

### 2.3 Observation Compression (Claude-Mem) ⭐⭐⭐

**Problem:** AI outputs are unstructured text. Hard to query, index, or use programmatically.

**Solution:** Compress AI outputs into structured observations with defined fields.

**Observation Schema:**
```typescript
interface Observation {
  id: string;
  session_id: string;
  entity_type: string;  // 'inbox_item', 'task', 'project'
  entity_id: string;
  
  // Classification
  type: 'classification' | 'decision' | 'discovery' | 'change' | 'insight';
  
  // Hierarchical content (progressive detail)
  title: string;           // Short title (max 10 words)
  subtitle: string;        // One sentence (max 24 words)
  narrative: string;       // Full context (what, how, why)
  
  // Structured data
  facts: string[];         // Concise, self-contained statements
  concepts: string[];      // Knowledge categories/tags
  
  // Metadata
  confidence: number;      // 0-1 confidence score
  tokens_used: number;
  created_at: string;
}
```

**D1 Schema with FTS5:**
```sql
CREATE TABLE observations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  narrative TEXT,
  facts TEXT,       -- JSON array
  concepts TEXT,    -- JSON array
  confidence REAL,
  tokens_used INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- FTS5 for full-text search
CREATE VIRTUAL TABLE observations_fts USING fts5(
  title, subtitle, narrative, facts, concepts,
  content='observations',
  content_rowid='rowid'
);

-- Sync trigger
CREATE TRIGGER observations_ai AFTER INSERT ON observations BEGIN
  INSERT INTO observations_fts(rowid, title, subtitle, narrative, facts, concepts)
  VALUES (NEW.rowid, NEW.title, NEW.subtitle, NEW.narrative, NEW.facts, NEW.concepts);
END;
```

**AI Prompt for Structured Output:**
```xml
<observation>
  <type>[classification|decision|discovery|change|insight]</type>
  <title>[Short title, max 10 words]</title>
  <subtitle>[One sentence explanation, max 24 words]</subtitle>
  <facts>
    <fact>[Concise, self-contained statement 1]</fact>
    <fact>[Concise, self-contained statement 2]</fact>
  </facts>
  <narrative>[Full context: What, how, why]</narrative>
  <concepts>
    <concept>[knowledge-category-1]</concept>
  </concepts>
  <confidence>[0.0-1.0]</confidence>
</observation>
```

---

### 2.4 Automatic Entropy/Postponement (Fizzy) ⭐⭐⭐

**Problem:** Inbox and task lists grow unbounded. Stale items create overwhelm.

**Solution:** Auto-postpone items after configurable inactivity period.

**Schema Changes:**
```sql
ALTER TABLE inbox_items ADD COLUMN last_active_at TEXT;
ALTER TABLE tasks ADD COLUMN last_active_at TEXT;

-- Tenant settings (in tenants.settings JSON)
{
  "entropy": {
    "enabled": true,
    "inbox_postpone_days": 7,
    "task_postpone_days": 30
  }
}
```

**Cron Job Implementation:**
```typescript
async processEntropy(env: Env) {
  const tenants = await getAllTenants(env.DB);
  
  for (const tenant of tenants) {
    const settings = JSON.parse(tenant.settings || '{}');
    if (!settings.entropy?.enabled) continue;
    
    const inboxThreshold = settings.entropy.inbox_postpone_days || 7;
    const taskThreshold = settings.entropy.task_postpone_days || 30;
    
    // Postpone stale inbox items
    await env.DB.prepare(`
      UPDATE inbox_items 
      SET status = 'not_now', updated_at = ?
      WHERE tenant_id = ? 
        AND status = 'pending'
        AND last_active_at < datetime('now', '-' || ? || ' days')
    `).bind(now(), tenant.id, inboxThreshold).run();
    
    // Postpone stale tasks
    await env.DB.prepare(`
      UPDATE tasks
      SET status = 'not_now', updated_at = ?
      WHERE tenant_id = ?
        AND status IN ('inbox', 'next', 'waiting')
        AND last_active_at < datetime('now', '-' || ? || ' days')
    `).bind(now(), tenant.id, taskThreshold).run();
  }
}
```

**Activity Updates:** `last_active_at` refreshes on any interaction: view, edit, comment, assign, move.

---

### 2.5 Multi-Threaded Conversations (Refly) ⭐⭐⭐

**Problem:** AI conversations lose context. Each chat is isolated.

**Solution:** Each entity can have its own conversation thread that persists and can be forked.

**Schema:**
```sql
CREATE TABLE conversation_threads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  entity_type TEXT,  -- 'Task', 'Project', 'Idea', NULL for standalone
  entity_id TEXT,
  parent_thread_id TEXT,  -- For forked threads
  title TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE conversation_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  metadata TEXT,  -- JSON: model, tokens, etc.
  created_at TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES conversation_threads(id)
);

CREATE INDEX idx_threads_entity ON conversation_threads(entity_type, entity_id);
```

**Use Cases:**
- **Task-attached conversations:** Discuss a task with AI, context persists
- **Project brainstorming:** Fork threads when ideas diverge
- **Inbox triage:** AI explains classification, user can follow up

**Per-Entity Context Loading:**
```typescript
async function loadEntityContext(entity: EntityContext) {
  const sources = await gatherRelevantSources(entity);
  
  await mnemo.loadContext({
    alias: `${entity.entityType.toLowerCase()}-${entity.entityId}`,
    sources: sources.map(s => s.reference),
    ttl: 3600
  });
}
```

---

### 2.6 Token Economics & ROI Tracking (Claude-Mem) ⭐⭐

**Problem:** No visibility into AI processing costs. Can't justify automation ROI.

**Solution:** Track tokens spent vs. tokens saved. Display ROI to users.

**Schema:**
```sql
CREATE TABLE token_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  
  -- Discovery costs
  discovery_tokens INTEGER DEFAULT 0,
  discovery_cost_usd REAL DEFAULT 0,
  
  -- Compression savings
  original_tokens INTEGER DEFAULT 0,
  compressed_tokens INTEGER DEFAULT 0,
  savings_tokens INTEGER DEFAULT 0,
  savings_pct REAL DEFAULT 0,
  
  -- Counts
  observations_created INTEGER DEFAULT 0,
  recipes_run INTEGER DEFAULT 0,
  
  UNIQUE(tenant_id, date)
);
```

**Display Format:**
```typescript
interface TokenEconomics {
  period: 'today' | 'week' | 'month';
  discovery: { tokens: number; cost_usd: number; };
  savings: {
    original_tokens: number;
    compressed_tokens: number;
    saved_tokens: number;
    saved_pct: number;
    saved_usd: number;
  };
  roi: {
    tokens_saved_per_token_spent: number;
    effective_multiplier: string;  // e.g., "45x"
  };
}
```

**Context Injection Display:**
```markdown
📊 **Context Economics** (Today)
- Discovery cost: 12.5K tokens ($0.25)
- Context compressed: 580K → 12K tokens (97.9% savings)
- Effective ROI: **45x** return on AI investment
```

---

### 2.7 Autonomy Limits (Goose) ⭐⭐

**Problem:** Autonomous AI processing can run away—infinite loops, excessive costs.

**Solution:** Configurable limits on agent turns without user input.

```typescript
interface AutonomyConfig {
  max_turns: number;
  auto_compact_threshold: number;  // 0.8 = compact at 80% context
  require_approval: string[];      // Actions requiring human approval
}

// Tenant-level defaults
{
  "autonomy": {
    "max_turns": 10,
    "require_approval": ["delete", "send_email", "create_commitment"]
  }
}

// Turn tracking
async function executeWithLimits(recipe: Recipe, context: ExecutionContext) {
  const maxTurns = recipe.settings?.max_turns ?? context.tenant.autonomy.max_turns;
  let turnCount = 0;
  
  while (turnCount < maxTurns) {
    const result = await executeTurn(recipe, context);
    turnCount++;
    
    if (result.complete) return { success: true, turns: turnCount };
    if (result.requires_approval) {
      return { paused: true, reason: 'approval_required', pending_action: result.action };
    }
  }
  
  return { success: false, reason: 'max_turns_exceeded' };
}
```

---

### 2.8 Privacy Tags (Claude-Mem) ⭐⭐

**Problem:** Users may capture sensitive content that shouldn't be stored or processed.

**Solution:** Dual-tag system for user-controlled and system-level privacy.

| Tag | Purpose | Behavior |
|-----|---------|----------|
| `<private>` | User-controlled | Content stripped before storage |
| `<system-context>` | System-level | Prevents recursive storage |

**Implementation:**
```typescript
function stripPrivateTags(content: string): string {
  content = content.replace(/<private>[\s\S]*?<\/private>/gi, '[REDACTED]');
  content = content.replace(/<system-context>[\s\S]*?<\/system-context>/gi, '');
  return content;
}
```

---

## Part 3: Implementation Roadmap

> **Note:** All implementations should follow the patterns in [guide-01-fundamentals](developer-guides-mcp://guide-01-fundamentals) for code organization, naming, and error handling.

### Phase 1: Foundation (Week 1-2)

| Item | System | Complexity | Guide Reference |
|------|--------|------------|-----------------|
| Add `events` table + `trackEvent()` | Nexus | Low | [guide-05-10-db-perf](developer-guides-mcp://guide-05-10-db-perf) |
| FTS5 tables + triggers | Nexus | Low | Database Guide - Query Optimization |
| Observation structuring schema | Nexus | Medium | Database Guide - Schema Design |
| Privacy tags implementation | Nexus | Low | [guide-07-security](developer-guides-mcp://guide-07-security) |
| `last_active_at` columns | Nexus | Low | Database Guide - Migration Strategy |

**D1 Migration Pattern (per guide-05-10-db-perf):**
```bash
# Create migration
wrangler d1 migrations create DB add_events_table

# Apply locally first
wrangler d1 migrations apply DB --local

# Then staging, then production
wrangler d1 migrations apply DB --env staging
wrangler d1 migrations apply DB --env production
```

### Phase 2: Progressive Disclosure (Week 3-4)

| Item | System | Complexity | Guide Reference |
|------|--------|------------|-----------------|
| `context_index` tool | Mnemo | Medium | Ecosystem Architecture |
| Lightweight index generation | Mnemo | Medium | Performance Guide - Caching |
| Token economics tracking | Both | Low | Database Guide |
| Index injection at session start | Mnemo | Medium | Architecture Guide - Caching Strategies |

**Caching Pattern (per guide-02-11-arch-devops):**
```typescript
// Store index in KV for fast retrieval
async function getCachedIndex(
  alias: string,
  fetchFn: () => Promise<ContextIndex>,
  env: Env,
  ttl: number = 300
) {
  const cached = await env.CACHE.get(`index:${alias}`, 'json');
  if (cached) return cached;
  
  const data = await fetchFn();
  await env.CACHE.put(`index:${alias}`, JSON.stringify(data), {
    expirationTtl: ttl
  });
  
  return data;
}
```

### Phase 3: Automation (Week 5-6)

| Item | System | Complexity | Guide Reference |
|------|--------|------------|-----------------|
| Recipe schema + CRUD | Nexus | Medium | Architecture Guide - Layered Architecture |
| Recipe execution engine | Nexus | High | Ecosystem Architecture - DE Worker Pattern |
| Scheduled execution | Nexus | Medium | CF Workers Guide |
| Autonomy limits | Nexus | Low | Security Guide |

**Error Handling Pattern (per guide-01-fundamentals):**
```typescript
// Custom error classes for recipe execution
export class RecipeExecutionError extends AppError {
  constructor(recipeId: string, message: string, public originalError?: Error) {
    super(message, 'RECIPE_EXECUTION_ERROR', 500, false);
  }
}

export class MaxTurnsExceededError extends AppError {
  constructor(recipeId: string, turns: number) {
    super(`Recipe ${recipeId} exceeded max turns (${turns})`, 'MAX_TURNS_EXCEEDED', 400);
  }
}
```

### Phase 4: Memory Enhancement (Week 7-8)

| Item | System | Complexity | Guide Reference |
|------|--------|------------|-----------------|
| Temporal knowledge graph | Nexus | Medium | Database Guide - Schema Design |
| Multi-sector classification | Nexus | Medium | DE text-gen service |
| Salience decay system | Nexus | Medium | Performance Guide |
| Entropy cron job | Nexus | Low | CF Workers - Scheduled Handlers |

### Phase 5: Conversations (Week 9-10)

| Item | System | Complexity | Guide Reference |
|------|--------|------------|-----------------|
| Conversation threads schema | Nexus | Medium | Database Guide |
| Thread UI in Bridge | Bridge | High | Frontend Guide |
| Per-entity context loading | Nexus/Mnemo | Medium | Ecosystem Architecture |
| Session summary generation | Nexus | Medium | DE text-gen service |

### Service Registry Updates Required

Per the Ecosystem Architecture Reference, when these features are implemented:

1. **Update Service Registry** with new capabilities
2. **Update developer-guides MCP** if new patterns emerge
3. **Add to changelog** for each service

```sql
-- Example: Adding context_index capability to mnemo
INSERT INTO service_capabilities (service_id, capability, description)
VALUES ('mnemo', 'context_index', 'Generate lightweight context index for progressive disclosure');
```

---

## Part 4: Tech Stack Decisions

### Adopted Patterns

| Source | Pattern | Why |
|--------|---------|-----|
| Fizzy | Events & activity tracking | Foundation for analytics |
| Fizzy | Automatic entropy | Self-managing lists |
| Refly | Multi-threaded conversations | Per-entity AI context |
| Refly | Per-entity context memory | Mnemo integration |
| Goose | Recipe system | Codified automation |
| Goose | Scheduled execution | Cron-based workflows |
| Goose | Autonomy limits | Safety rails |
| Goose | .goosehints pattern | AI customization |
| Claude-Mem | Progressive disclosure | Token efficiency |
| Claude-Mem | Observation compression | Structured AI output |
| Claude-Mem | Token economics | ROI visibility |
| Claude-Mem | Privacy tags | User control |
| Claude-Mem | FTS5 with triggers | Fast search |
| OpenMemory | Temporal knowledge graph | Fact evolution |
| OpenMemory | Multi-sector classification | Cognitive typing |
| OpenMemory | Salience decay | Auto-prioritization |

### NOT Adopted

| Source | Pattern | Reason |
|--------|---------|--------|
| Refly | NestJS | Staying on CF Workers |
| Refly | PostgreSQL/Elasticsearch | D1 + FTS5 sufficient |
| Refly | yjs | Durable Objects working |
| Goose | Rust backend | TypeScript preferred |
| Goose | Electron app | Bridge is web-first |
| Claude-Mem | PM2/Express | CF Workers |
| Claude-Mem | Chroma | Using Mnemo/Gemini |
| OpenMemory | Node.js runtime | Incompatible with Workers |
| OpenMemory | Full vector store | Mnemo handles embeddings |

---

## Part 5: Design Decisions

The following questions were resolved during planning review (2025-12-12):

### Resolved Decisions

| # | Question | Decision | Notes |
|---|----------|----------|-------|
| 1 | Event retention | Configurable per tenant, **default = forever** | Tenant setting allows override for compliance needs |
| 2 | Entropy defaults | Inbox: **14 days**, Tasks: **60 days** | Conservative defaults. **Future: self-learning/self-correcting thresholds based on user behavior patterns (resurrect rate, timing). Implementation TBD.** |
| 3 | Index generation | **Auto-generate on `context_load`** | Index always created when context is cached, immediately available for progressive disclosure |
| 4 | Observation granularity | **Hierarchical** | Every AI call logged for troubleshooting, organized in parent/child structure per entity |
| 5 | Recipe versioning | **Graceful transition** | Current runs complete with old version, new runs automatically use new version |
| 6 | Approval workflows | **Configurable with toggles**, default = `delete` + `send_email` | Users can add/remove approval requirements as needed |
| 7 | Token pricing | **Real-time pricing matrix** | Trading-style dashboard tracking all dimensions: token in/out, cached/uncached, local/cloud, by model/provider. This is a feature unto itself. |

### Deferred to Core Architecture

| # | Question | Status | Rationale |
|---|----------|--------|-----------|
| 8 | Summary/memory triggers | **⚠️ CORE ARCHITECTURE** | Not a configuration choice. This is the fundamental question of how memory flows through the ecosystem: Session Activity → Mnemo (Working Memory) → Nexus (Long-term Memory). Requires separate focused workstream to define the mechanism that transforms working memory into long-term memory. Central to Mnemo/Nexus integration design. |

---

## Key Insight

The common thread across all these projects:

```
DON'T: Load everything into context blindly
DO: 
  1. Generate a lightweight index of what's available
  2. Inject the index at session/conversation start
  3. Let the agent query for specific details as needed
  4. Track token savings to demonstrate ROI
```

**For Mnemo:** Don't just cache 1M tokens. Generate an index. Let Claude ask for what it needs.

**For Nexus:** Don't dump all inbox items. Show summaries. Let queries fetch details.

**For DE:** Observation compression IS a transform. Add it to the pipeline.

---

## References

### Open Source Projects Analyzed
- [OpenMemory Repository](https://github.com/CaviraOSS/OpenMemory)
- [Claude-Mem Repository](https://github.com/thedotmack/claude-mem)
- [Fizzy Repository](https://github.com/basecamp/fizzy)
- [Refly Repository](https://github.com/refly-ai/refly)
- [Goose Repository](https://github.com/block/goose)
- [Goose Recipes Documentation](https://block.github.io/goose/docs/guides/recipes/)

### Ecosystem Documentation
- [Ecosystem Architecture Reference](developer-guides-mcp://ecosystem-architecture-reference) - Core architecture philosophy
- [Fundamentals Guide](developer-guides-mcp://guide-01-fundamentals) - Code organization, naming, error handling
- [Architecture & DevOps Guide](developer-guides-mcp://guide-02-11-arch-devops) - Layered architecture, CI/CD
- [Database & Performance Guide](developer-guides-mcp://guide-05-10-db-perf) - Schema design, query optimization
- [Security Guide](developer-guides-mcp://guide-07-security) - Validation, authentication, privacy

### Internal Repositories
- [DE Repository](https://github.com/CyberBrown/cloudflare-multiagent-system)
- [Mnemo Repository](https://github.com/CyberBrown/mnemo)
- [Nexus Repository](https://github.com/CyberBrown/nexus)
- [claude-mcp-config](https://github.com/CyberBrown/claude-mcp-config)

---

## Changelog

### v1.0.0 (2025-12-12)
- Initial synthesis from 5 open source projects (OpenMemory, Claude-Mem, Fizzy, Refly, Goose)
- Aligned with Ecosystem Architecture Reference (Three Pillars philosophy)
- Added DE Service Registry integration notes
- Cross-referenced developer guides
- Resolved 7 design decisions:
  - Event retention: configurable, default forever
  - Entropy defaults: inbox 14d, tasks 60d (self-learning TBD)
  - Index generation: auto on context_load
  - Observation granularity: hierarchical parent/child
  - Recipe versioning: graceful transition
  - Approval workflows: configurable, default delete+send_email
  - Token pricing: real-time matrix dashboard
- Flagged Question 8 (summary/memory triggers) as **Core Architecture** decision requiring separate workstream

---

*Synthesized from 5 open source analyses totaling 500K+ tokens via Mnemo context caching.*
