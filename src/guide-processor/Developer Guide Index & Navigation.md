---
id: dev-guide-index
title: Developer Guide Index & Navigation
category: meta
type: index
status: finalized
version: 2.2.0
last_updated: 2025-12-29
tags: [index, navigation, overview, getting-started, ecosystem, DE, multi-agent]
---

# Developer Guide Index & Navigation

**Version:** 2.0.0  
**Last Updated:** November 1, 2025  
**Purpose:** Central navigation hub for all development guidelines, standards, and best practices

---

## Quick Start

New to these guides? Start here:
1. Read [Core Development Principles](#01-fundamentals)
2. Review [Architecture Patterns](#02-architecture) for your project type
3. Check framework-specific guides ([Frontend](#03-frontend), [Backend](#04-backend))
4. Implement [Security](#07-security) and [Observability](#08-observability) standards
5. Review [Testing](#09-testing) requirements

---

## How to Use These Guides

### For AI Coding Agents
- Each guide includes language/framework-specific sections
- Search using tags and categories
- Follow cross-references for related topics
- Check version numbers for currency

### For Humans
- Use Quick Navigation below to find relevant guides
- Each guide follows consistent structure
- Examples provided in multiple languages
- Anti-patterns clearly marked

### Document Status Legend
- ✅ **Finalized** - Production-ready, fully reviewed
- 🔄 **In Review** - Pending approval, use with caution
- 📝 **Draft** - Work in progress, not for production use
- ⚠️ **Needs Update** - Outdated, scheduled for revision

---

## Quick Navigation

### By Development Phase

#### Planning & Design
- [02-001-Application-Architecture-Patterns](#02-001)
- [02-002-API-Design-Principles](#02-002)
- [02-003-Database-Schema-Design](#02-003)
- [02-004-State-Management-Strategy](#02-004)

#### Implementation
- [01-001-Code-Organization](#01-001)
- [01-002-Naming-Conventions](#01-002)
- [03-Frontend-Development](#03-frontend)
- [04-Backend-Development](#04-backend)
- [06-AI-ML-Integration](#06-ai)

#### Testing
- [09-001-Testing-Strategy](#09-001)
- [09-002-Unit-Testing-Principles](#09-002)
- [09-003-E2E-Testing-Checklist](#09-003)

#### Deployment
- [11-001-CI-CD-Standards](#11-001)
- [11-002-Environment-Configuration](#11-002)
- [11-003-Cloudflare-Workers-Deployment](#11-003)

#### Operations & Monitoring
- [08-001-Structured-Logging](#08-001)
- [08-002-Request-Tracing](#08-002)
- [08-003-Performance-Monitoring](#08-003)
- [10-Performance-Optimization](#10-performance)

---

## By Technology Stack

### Frontend Frameworks
- **Qwik** → [03-001-Qwik-Development](#03-001)
- **React** → [03-002-React-Development](#03-002)
- **Vue** → [03-003-Vue-Development](#03-003)
- **Angular** → [03-004-Angular-Development](#03-004)

### Backend/Runtime
- **Cloudflare Workers** → [04-001-Cloudflare-Workers](#04-001)
- **Node.js** → [04-002-Nodejs-Backend](#04-002)
- **Python** → [04-003-Python-Backend](#04-003)
- **Go** → [04-004-Go-Backend](#04-004)

### Languages
- **TypeScript/JavaScript** → Multiple guides
- **Python** → [04-003-Python-Backend](#04-003)
- **Go** → [04-004-Go-Backend](#04-004)
- **SQL** → [05-Database](#05-database)

### Infrastructure
- **Cloudflare Platform** → [04-001-Cloudflare-Workers](#04-001), [11-003-Cloudflare-Deployment](#11-003)
- **Docker** → [11-004-Containerization](#11-004)
- **Databases** → [05-Database](#05-database)

---

## 🏗️ Ecosystem Architecture (NEW)

The Three Pillars of our development ecosystem:

```
┌─────────────────────────────────────────────┐
│         DISTRIBUTED ELECTRONS (DE)          │
│     Backend Processes • Worker Swarm        │
│     "Build it once, use it everywhere"      │
└─────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────┐
│                  MNEMO                       │
│         Working Memory + Tactics             │
│     Real-time context, conversation flow    │
└─────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────┐
│                  NEXUS                       │
│         Long-term Memory + Strategy          │
│     Historical knowledge, decision patterns  │
└─────────────────────────────────────────────┘
```

### Key Architecture Guides

| Guide ID | Title | Focus | Status |
|----------|-------|-------|--------|
| DE-Workflows-Architecture | [DE Workflows Architecture](./DE-Workflows-Architecture.md) | Single entry point, PrimeWorkflow routing | ✅ |
| ecosystem-architecture | [Ecosystem Architecture Reference](./ecosystem-architecture-reference.md) | DE, Mnemo, Nexus philosophy | ✅ |
| scale-orchestration | [Scale & Multi-Agent Orchestration](./scale-orchestration-guide.md) | 4x4x4 model, parallel dev | 📝 |

### Essential Concepts

**Distributed Electrons (DE):** All backend services route through DE. Never build isolated API calls—use the worker swarm.

**The Fundamental Rule:** Custom frontends + Distributed backend. Apps are interfaces; compute happens in the swarm.

**Service Registry:** Query available services via MCP:
```
mcp__developer-guides__get_available_services
```

**Multi-Agent Development:** Scale using the 4x4x4 model (4 clusters, 4 leaders, 4 coders each).

### Quick Links
- [Check available DE services](#service-registry) → `get_available_services`
- [Multi-agent orchestration patterns](#scale-orchestration)
- [MCP server management](#mcp-setup) → claude-mcp-config

---

## By Category

### 📁 01-Fundamentals
Core programming principles that apply across all projects

| Guide ID | Title | Languages | Status |
|----------|-------|-----------|--------|
| 01-001 | Code Organization & File Structure | All | ✅ |
| 01-002 | Naming Conventions | All | ✅ |
| 01-003 | Documentation Standards | All | ✅ |
| 01-004 | Error Handling Patterns | All | ✅ |
| 01-005 | Type System Guide | TS, Python, Go | ✅ |

### 📁 02-Architecture
System design and architectural patterns

| Guide ID | Title | Scope | Status |
|----------|-------|-------|--------|
| 02-001 | Application Architecture Patterns | All | ✅ |
| 02-002 | API Design Principles | REST, GraphQL | ✅ |
| 02-003 | Database Schema Design | SQL, NoSQL | ✅ |
| 02-004 | State Management Strategy | Frontend | ✅ |
| 02-005 | Caching Strategies | All | ✅ |

### 📁 03-Frontend
Frontend development across frameworks

| Guide ID | Title | Frameworks | Status |
|----------|-------|------------|--------|
| 03-001 | Qwik Development Guide | Qwik | ✅ |
| 03-002 | React Development Guide | React | ✅ |
| 03-003 | Component Performance Optimization | All | ✅ |
| 03-004 | Build & Bundle Optimization | All | ✅ |

### 📁 04-Backend
Backend development and server-side logic

| Guide ID | Title | Runtime | Status |
|----------|-------|---------|--------|
| 04-001 | Cloudflare Workers Development | CF Workers | ✅ |
| 04-002 | API Endpoint Design | All | ✅ |
| 04-003 | Background Job Processing | All | ✅ |
| 04-004 | WebSocket & Real-time Communication | All | ✅ |

### 📁 05-Database
Database design, optimization, and management

| Guide ID | Title | Database Types | Status |
|----------|-------|----------------|--------|
| 05-001 | Schema Design & Migrations | SQL | ✅ |
| 05-002 | Query Optimization | All | ✅ |
| 05-003 | Data Validation & Integrity | All | ✅ |
| 05-004 | Health Verification | All | ✅ |
| 05-005 | Data Retention & Deletion | All | ✅ |

### 📁 06-AI-ML
AI/ML integration and LLM usage

| Guide ID | Title | Scope | Status |
|----------|-------|-------|--------|
| 06-001 | AI Model Configuration Policy | All LLMs | ✅ |
| 06-002 | Defensive AI Guardrails | All LLMs | ✅ |
| 06-003 | Structured Output Patterns | All LLMs | ✅ |
| 06-004 | Prompt Engineering Templates | All LLMs | ✅ |

### 📁 07-Security
Security standards and practices

| Guide ID | Title | Scope | Status |
|----------|-------|-------|--------|
| 07-001 | Input Validation & Sanitization | All | ✅ |
| 07-002 | Authentication & Authorization | All | ✅ |
| 07-003 | Secret Management | All | ✅ |
| 07-004 | Security Headers & CORS | Web | ✅ |

### 📁 08-Observability
Logging, monitoring, and diagnostics

| Guide ID | Title | Scope | Status |
|----------|-------|-------|--------|
| 08-001 | Structured Logging Standards | All | ✅ |
| 08-002 | Request Tracing & Correlation | Distributed | ✅ |
| 08-003 | Critical Path Monitoring | All | ✅ |
| 08-004 | Connection Diagnostics | Real-time | ✅ |

### 📁 09-Testing
Testing strategies and standards

| Guide ID | Title | Type | Status |
|----------|-------|------|--------|
| 09-001 | Testing Strategy Overview | All | ✅ |
| 09-002 | Unit Testing Principles | All | ✅ |
| 09-003 | E2E Testing Checklist | All | ✅ |
| 09-004 | Test Data Management | All | ✅ |

### 📁 10-Performance
Performance optimization techniques

| Guide ID | Title | Layer | Status |
|----------|-------|-------|--------|
| 10-001 | Frontend Performance | Frontend | ✅ |
| 10-002 | Backend Performance | Backend | ✅ |
| 10-003 | Database Performance | Database | ✅ |
| 10-004 | Cloudflare Workers Performance | CF Workers | ✅ |

### 📁 11-DevOps
Deployment and operations

| Guide ID | Title | Platform | Status |
|----------|-------|----------|--------|
| 11-001 | CI/CD Standards | All | ✅ |
| 11-002 | Environment Configuration | All | ✅ |
| 11-003 | Cloudflare Platform Deployment | Cloudflare | ✅ |
| 11-004 | Containerization Best Practices | Docker | ✅ |

---

## Search by Tag

### Common Tags
- `qwik` - Qwik framework specific
- `cloudflare-workers` - Cloudflare Workers specific
- `react` - React framework specific
- `typescript` - TypeScript language
- `python` - Python language
- `security` - Security-related
- `performance` - Performance optimization
- `ai-ml` - AI/ML integration
- `testing` - Testing practices
- `logging` - Logging and observability
- `database` - Database related
- `api` - API design and implementation

---

## Contribution Guidelines

### Proposing Changes
1. Identify the guide that needs updating
2. Create a detailed change proposal including:
   - Current text (exact quote)
   - Proposed new text
   - Rationale for change
   - Impact assessment
3. Submit for review via Linear ticket
4. Changes require approval before going live

### Creating New Guides
1. Check this index to avoid duplication
2. Use the standard guide template
3. Include examples in multiple languages/frameworks
4. Add appropriate metadata and tags
5. Submit as draft for review

### Version Control
- **Major version** (X.0.0) - Significant restructuring or policy changes
- **Minor version** (1.X.0) - New sections or substantial additions
- **Patch version** (1.0.X) - Corrections, clarifications, examples

---

## Glossary of Common Terms

**Agent** - An autonomous AI system that can make decisions and take actions

**Artifact** - A piece of generated code, document, or resource

**Bundle** - Combined and optimized code files for deployment

**Context Window** - The amount of information an AI model can process at once

**Edge** - Computing resources located close to end users (e.g., Cloudflare Workers)

**Guardrail** - Safety mechanism to prevent unwanted AI behavior

**Hydration** - Process of making server-rendered HTML interactive on the client

**MCP** - Model Context Protocol, a standard for AI tool integration

**Observable** - System property that can be monitored and measured

**Resumability** - Qwik's ability to continue execution without re-running initialization

**Signal** - Reactive state primitive in Qwik

**Tracing** - Following a request's path through distributed systems

**Worker** - Serverless function running on Cloudflare's edge network

---

## Document Relationships

### Core Dependencies
Start with these foundational guides before diving into specific areas:
1. **01-001 Code Organization** - Required for all development
2. **01-005 Type System** - Required for typed languages
3. **07-001 Input Validation** - Required for all user-facing code
4. **08-001 Structured Logging** - Required for all production code

### Common Paths

#### Building a Qwik + Cloudflare Workers App
1. [02-001 Application Architecture](#02-001)
2. [03-001 Qwik Development](#03-001)
3. [04-001 Cloudflare Workers](#04-001)
4. [08-001 Structured Logging](#08-001)
5. [09-003 E2E Testing](#09-003)
6. [11-003 Cloudflare Deployment](#11-003)

#### Integrating AI/LLM Features
1. [06-001 AI Model Configuration](#06-001)
2. [06-002 Defensive AI Guardrails](#06-002)
3. [06-003 Structured Output Patterns](#06-003)
4. [07-001 Input Validation](#07-001)

#### Implementing Observability
1. [08-001 Structured Logging](#08-001)
2. [08-002 Request Tracing](#08-002)
3. [08-003 Critical Path Monitoring](#08-003)

---

## Getting Help

### Understanding a Guideline
- Check the "Core Principles" section for the big picture
- Review examples in your language/framework
- Look at anti-patterns to understand what to avoid
- Follow cross-references to related guides

### When Guidelines Conflict
1. Security always takes precedence
2. Refer to the Core Principles Hierarchy:
   - Security > Correctness > Performance > Developer Experience
3. Document the conflict and propose clarification

### Requesting Clarification
Create a Linear ticket with:
- Guide ID and version
- Specific section requiring clarification
- Your interpretation and questions
- Impact on current work

---

## Changelog

### v2.2.0 (2025-12-29)
- Added DE Workflows Architecture guide documenting single entry point pattern
- Documents PrimeWorkflow routing logic and request schema
- Addresses routing bypass fix from Dec 28, 2025

### v2.1.0 (2025-12-04)
- Added Ecosystem Architecture section (Three Pillars: DE, Mnemo, Nexus)
- Added Scale & Multi-Agent Orchestration Guide
- Added Ecosystem Architecture Reference
- Added Service Registry integration via MCP
- Updated tags for ecosystem discovery

### v2.0.0 (2025-11-01)
- Complete restructuring and reorganization
- Added Qwik framework coverage
- Added Cloudflare Workers platform coverage
- Consolidated related guides
- Standardized all document formats
- Added comprehensive cross-referencing
- Created search and navigation aids

### v1.0.0 (2025-11-01)
- Initial collection of guides
- React and TypeScript focus
- AI/ML integration guidelines
- Logging and observability standards

---

**Next Steps:** Browse the guides relevant to your current work, or start with the fundamentals if you're new to the codebase.