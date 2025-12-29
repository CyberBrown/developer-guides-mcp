---
id: DE-Workflows-Architecture
title: DE Workflows Architecture - Single Entry Point Pattern
category: architecture
type: reference
status: finalized
version: 1.0.0
last_updated: 2025-12-29
tags: [architecture, DE, distributed-electrons, workflows, routing, PrimeWorkflow, code-execution, single-entry-point]
related_guides: [ecosystem-architecture-reference, scale-orchestration-guide, Cloudflare-Workers-Guide]
---

# DE Workflows Architecture
## Single Entry Point Routing Pattern

**Version:** 1.0.0
**Date:** December 29, 2025
**Status:** Finalized
**Purpose:** Document the correct routing architecture for DE Workflows, emphasizing the single entry point pattern through PrimeWorkflow.

---

## Overview

DE Workflows (`de-workflows`) is the Cloudflare Workflows-based execution layer of Distributed Electrons. It orchestrates multi-step AI tasks including code execution, text generation, video rendering, and research workflows.

**Critical Principle:** All external requests MUST go through the single entry point at `POST /execute`. Direct calls to sub-workflow endpoints (e.g., `/workflows/code-execution`) are forbidden for external callers.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL CALLERS                               │
│              (Nexus, MCP tools, scheduled tasks, etc.)                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │ ONLY allowed endpoint
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        POST /execute                                     │
│                    (Single Entry Point)                                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PrimeWorkflow                                    │
│                                                                          │
│  1. Validates request                                                    │
│  2. Classifies task type                                                 │
│  3. Selects appropriate sub-workflow                                     │
│  4. Triggers via workflow bindings (NOT HTTP)                           │
│  5. Aggregates results                                                   │
│  6. Reports back via callback                                            │
└────────────┬──────────────────┬──────────────────┬─────────────────────┘
             │                  │                  │
    ┌────────┴────────┐  ┌─────┴─────┐   ┌───────┴────────┐
    │ CodeExecution   │  │ TextGen   │   │ VideoRender    │
    │    Workflow     │  │ Workflow  │   │   Workflow     │
    └─────────────────┘  └───────────┘   └────────────────┘
             │
             ▼
    ┌─────────────────┐
    │ sandbox-executor│
    │  (Claude Code)  │
    └─────────────────┘
```

---

## Single Entry Point: POST /execute

### Why Single Entry Point?

1. **Classification Logic:** PrimeWorkflow contains intelligent routing logic that determines the best sub-workflow based on task context
2. **Consistent Tracking:** All executions flow through one point for unified logging, metrics, and audit trails
3. **Future-Proofing:** New sub-workflows can be added without external callers needing updates
4. **Security:** Sub-workflows can be hardened against unauthorized access

### Request Schema

```typescript
interface PrimeWorkflowRequest {
  params: {
    task_id: string;           // UUID for tracking
    title: string;             // Human-readable task title
    description: string;       // Full task description/prompt
    context?: {
      repo?: string;           // Repository URL for code tasks
      branch?: string;         // Target branch
      timeline?: any;          // Timeline data for video tasks
      [key: string]: any;      // Additional context
    };
    hints?: {
      workflow?: WorkflowType; // Explicit workflow selection
      provider?: string;       // Preferred LLM provider (claude, gemini, etc.)
    };
    timeout_ms?: number;       // Max execution time (default: 600000)
    callback_url?: string;     // URL for async result delivery
  };
}

type WorkflowType =
  | 'code-execution'
  | 'text-generation'
  | 'video-render'
  | 'research'
  | 'planning';
```

### Example Request

```json
{
  "params": {
    "task_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "[implement] Add user authentication",
    "description": "Implement JWT-based authentication for the API. Add login/logout endpoints and middleware for protected routes.",
    "context": {
      "repo": "https://github.com/example/my-api",
      "branch": "main"
    },
    "hints": {
      "workflow": "code-execution",
      "provider": "claude"
    },
    "timeout_ms": 600000,
    "callback_url": "https://nexus.example.com/api/workflow/callback"
  }
}
```

---

## Routing Logic

PrimeWorkflow determines which sub-workflow to use based on the following priority:

### 1. Explicit Hints (Highest Priority)

If `hints.workflow` is specified, use that workflow directly:

```typescript
if (params.hints?.workflow) {
  return routeToWorkflow(params.hints.workflow);
}
```

### 2. Context-Based Routing

Check for context clues that indicate workflow type:

| Context Field | Workflow |
|--------------|----------|
| `context.repo` present | `code-execution` |
| `context.timeline` present | `video-render` |
| `context.search_terms` present | `research` |

### 3. Title Tag Parsing

Parse tags in the title to determine intent:

| Tag Pattern | Workflow |
|-------------|----------|
| `[implement]`, `[fix]`, `[refactor]` | `code-execution` |
| `[research]`, `[investigate]` | `research` |
| `[plan]`, `[design]` | `planning` |
| `[write]`, `[draft]` | `text-generation` |
| `[render]`, `[video]` | `video-render` |

### 4. Description Analysis

If no explicit hints or tags, analyze the description:

- Code-related keywords (function, class, API, bug, error) → `code-execution`
- Research keywords (find, search, compare, analyze) → `research`
- Content keywords (write, draft, create content) → `text-generation`

### 5. Default Fallback

If no routing signals found, default to `text-generation`.

---

## Sub-Workflow Endpoints (Internal Only)

These endpoints exist but return **403 Forbidden** for external callers:

| Endpoint | Internal Use |
|----------|-------------|
| `POST /workflows/code-execution` | Triggered by PrimeWorkflow via binding |
| `POST /workflows/text-generation` | Triggered by PrimeWorkflow via binding |
| `POST /workflows/video-render` | Triggered by PrimeWorkflow via binding |
| `POST /workflows/research` | Triggered by PrimeWorkflow via binding |

### Why 403 for Direct Access?

```typescript
// In de-workflows routing
app.post('/workflows/:workflow', async (c) => {
  // Check if request is from internal workflow binding
  const isInternalCall = c.req.header('X-Workflow-Internal') === 'true';

  if (!isInternalCall) {
    return c.json({
      error: 'Direct workflow access forbidden. Use POST /execute instead.',
      hint: 'PrimeWorkflow handles routing automatically.'
    }, 403);
  }

  // Process internal request...
});
```

---

## Integration from Nexus

### Correct Pattern

```typescript
// In Nexus: Use /execute endpoint
async function executeTask(task: Task, env: Env): Promise<void> {
  const response = await fetch(`${env.DE_WORKFLOWS_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      params: {
        task_id: task.id,
        title: task.title,
        description: task.description,
        context: {
          repo: task.repo_url,
          branch: task.branch || 'main'
        },
        hints: {
          workflow: task.workflow_type,
          provider: task.preferred_provider
        },
        timeout_ms: 600000,
        callback_url: `${env.NEXUS_URL}/api/workflow/callback`
      }
    })
  });

  // Handle response...
}
```

### Incorrect Pattern (DO NOT USE)

```typescript
// WRONG: Bypasses PrimeWorkflow classification
const response = await fetch(`${env.DE_WORKFLOWS_URL}/workflows/code-execution`, {
  // This will return 403 Forbidden
});
```

---

## Callback Mechanism

When a workflow completes, it reports back to the caller:

### Callback Request

```typescript
interface WorkflowCallback {
  task_id: string;
  workflow: WorkflowType;
  status: 'completed' | 'failed' | 'timeout';
  result?: {
    output: string;
    artifacts?: string[];
    metrics?: {
      duration_ms: number;
      tokens_used?: number;
      provider?: string;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```

### Callback Endpoint (Nexus)

```typescript
// POST /api/workflow/callback
app.post('/api/workflow/callback', async (c) => {
  const callback: WorkflowCallback = await c.req.json();

  // Update task status
  await updateTask(callback.task_id, {
    status: callback.status === 'completed' ? 'completed' : 'failed',
    result: callback.result,
    error: callback.error,
    completed_at: callback.timestamp
  });

  // Trigger next task if applicable
  if (callback.status === 'completed') {
    await dispatchNextReadyTask();
  }

  return c.json({ received: true });
});
```

---

## Configuration

### Nexus wrangler.toml

```toml
[vars]
DE_WORKFLOWS_URL = "https://de-workflows.solamp.workers.dev"
SANDBOX_EXECUTOR_URL = "https://sandbox-executor.solamp.workers.dev"
```

### DE Workflows wrangler.toml

```toml
[[workflows]]
name = "prime-workflow"
binding = "PRIME_WORKFLOW"
class_name = "PrimeWorkflow"

[[workflows]]
name = "code-execution-workflow"
binding = "CODE_EXECUTION_WORKFLOW"
class_name = "CodeExecutionWorkflow"

[[workflows]]
name = "text-gen-workflow"
binding = "TEXT_GEN_WORKFLOW"
class_name = "TextGenWorkflow"
```

---

## Migration Guide

If you have code that directly calls sub-workflow endpoints, migrate as follows:

### Before (Incorrect)

```typescript
// Direct call to sub-workflow
await fetch(`${DE_URL}/workflows/code-execution`, {
  method: 'POST',
  body: JSON.stringify({
    id: taskId,
    params: { prompt, repo_url }
  })
});
```

### After (Correct)

```typescript
// Use single entry point
await fetch(`${DE_URL}/execute`, {
  method: 'POST',
  body: JSON.stringify({
    params: {
      task_id: taskId,
      title: taskTitle,
      description: prompt,
      context: { repo: repo_url },
      hints: { workflow: 'code-execution' }
    }
  })
});
```

---

## Troubleshooting

### 403 Forbidden on /workflows/* endpoints

**Cause:** Direct access to sub-workflow endpoints is blocked.
**Solution:** Use `POST /execute` instead.

### Task Not Routed Correctly

**Cause:** Missing or ambiguous routing signals.
**Solution:** Add explicit `hints.workflow` or use title tags like `[implement]`.

### Callback Not Received

**Cause:** Invalid callback URL or network issues.
**Solution:** Verify `callback_url` is accessible and returns 200.

---

## Related Documents

- [Ecosystem Architecture Reference](./ecosystem-architecture-reference.md) - Overall architecture philosophy
- [Scale & Orchestration Guide](./scale-orchestration-guide.md) - Multi-agent coordination
- [Cloudflare Workers Guide](./Cloudflare-Workers-Guide.md) - Worker patterns

---

## Changelog

### v1.0.0 (2025-12-29)
- Initial documentation of single entry point pattern
- Documented routing bypass fix from Dec 28, 2025
- Added PrimeWorkflow request schema
- Added routing logic documentation
- Added migration guide for existing code

---

*This document should be updated whenever DE Workflows routing logic changes.*
