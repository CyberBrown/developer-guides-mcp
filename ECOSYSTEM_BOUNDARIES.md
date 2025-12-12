# Ecosystem Boundaries

This document defines the clear boundaries between the four pillars of the AI infrastructure ecosystem.

---

## The Four Pillars

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER                                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BRIDGE (Interface)                               │
│         Voice, Text, Graphics, Video - All User-Facing                  │
│         PC, Phone, Web, System Tray                                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          NEXUS (Brain)                                   │
│     Tier 1 Processing | Active Memory Manager | Orchestration           │
│     Entity Detection | Session Awareness | Long-term Memory             │
└─────────────────┬───────────────────────────────────┬───────────────────┘
                  │                                   │
                  ▼                                   ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│         MNEMO (Working Memory)   │   │      DE (Arms & Legs)           │
│   Context Cache Only             │   │   Tier 2+ Execution             │
│   No Decision-Making             │   │   LLM Routing, Media Services   │
│   Does What Nexus Tells It       │   │   Standalone Product            │
└─────────────────────────────────┘   └─────────────────────────────────┘
```

---

## 1. Distributed Electrons (DE) — "Arms & Legs"

**Repos:**
- `https://github.com/CyberBrown/distributed-electrons`
- `https://github.com/Logos-Flux/distributed-electrons`

**Domain:** `https://distributedelectrons.com`

**Branding:** DE is a **standalone product** that can live under:
- **Logos Flux** (logosflux.io) - l33t hacker/open source persona
- **Voltage Labs** (voltagelabs.net) - polished business professional persona

### DE Is Responsible For

| Responsibility | Description |
|----------------|-------------|
| Tier 2+ Processing | LLM-powered analysis requiring heavy compute |
| Provider Routing | Send requests to correct LLM (Claude, GPT, Gemini, etc.) |
| Rate Limiting | Manage per-provider quotas via Durable Objects |
| Worker Execution | Text, image, audio, video generation |
| Prompt Library | Manage optimized prompts (future) |
| Service Registry | Track available workers via D1 |
| Media Services | Image gen, audio gen, video rendering, stock media |

### DE Is NOT Responsible For

| Anti-Pattern | Why It's Wrong |
|--------------|----------------|
| Orchestration | That's Nexus's job |
| Context caching | That's Mnemo's job |
| Session tracking | That's Nexus's job |
| User interface | That's Bridge's job |
| Deciding what to generate | DE executes requests, doesn't originate them |

### DE Request Flow

```
App/Nexus → DE Worker → Provider API → Response → App/Nexus
```

DE receives requests and figures out HOW to fulfill them. It doesn't decide WHAT should be done.

---

## 2. Nexus — "The Brain"

**Repo:** `https://github.com/CyberBrown/nexus`

### Nexus Is Responsible For

| Responsibility | Description |
|----------------|-------------|
| **Tier 1 Processing** | Fast/cheap edge AI classification |
| **Active Memory Manager** | Entity detection, session awareness, proactive loading |
| **Long-term Memory** | Persistent storage and retrieval |
| **Orchestration** | Coordinates Mnemo and DE |
| **Input Classification** | Triage and routing decisions |
| **Escalation Decisions** | When to use Tier 2 (DE) vs Tier 1 (local) |
| **Task/Project Management** | Inbox, tasks, projects, ideas, people, commitments |

### Active Memory Manager (AMM)

The AMM is a core Nexus responsibility:

| AMM Feature | Description |
|-------------|-------------|
| Entity Detection | Recognize entities in conversation ("Istanbul" → Turkey context) |
| Session Awareness | Track current project, topic, working context |
| Proactive Loading | Trigger Mnemo loads before user asks |
| Memory Tiers | Manage HOT/WARM/COLD priority |
| Trigger Patterns | Watch for signals (file paths, errors, client names) |

### Nexus Is NOT Responsible For

| Anti-Pattern | Why It's Wrong |
|--------------|----------------|
| Voice/UI | That's Bridge's job |
| Context caching mechanics | That's Mnemo's job - Nexus tells Mnemo WHAT, not HOW |
| LLM execution | That's DE's job - Nexus routes to DE for Tier 2 |
| Media generation | That's DE's job |

### Nexus Request Flow

```
Bridge → Nexus → [Tier 1 local OR Tier 2 via DE] → Response
                      ↓
                   Mnemo (loads what Nexus tells it to)
```

---

## 3. Mnemo — "Working Memory"

**Repo:** `https://github.com/Logos-Flux/mnemo`
**Deployed:** `https://mnemo.solamp.workers.dev/mcp`

### Mnemo Is Responsible For

| Responsibility | Description |
|----------------|-------------|
| Context Caching | Efficiently cache content via Gemini |
| Query Interface | Answer questions about cached content |
| Token Tracking | Monitor usage and costs |
| TTL Management | Handle cache expiry and refresh |
| Source Adapters | Load repos, URLs, PDFs, etc. |

### Mnemo Is NOT Responsible For

| Anti-Pattern | Why It's Wrong |
|--------------|----------------|
| Deciding what to load | That's Nexus's job (via AMM) |
| Entity detection | That's Nexus's job |
| Session tracking | That's Nexus's job |
| Relevance scoring | That's Nexus's job |
| User interface | That's Bridge's job |
| LLM execution | That's DE's job |

**Key Insight:** Mnemo is a "smart cache" - it's excellent at HOW to cache and query, but doesn't decide WHAT to cache.

### Mnemo Request Flow

```
Nexus decides to load → Calls Mnemo context_load → Mnemo caches
Nexus needs answer    → Calls Mnemo context_query → Mnemo responds
```

---

## 4. Bridge — "The Interface" (Future)

**Status:** Not yet implemented. Lives in separate Bridge project.

### Bridge Is Responsible For

| Responsibility | Description |
|----------------|-------------|
| Voice UI | Voice input/output |
| Text UI | Chat interfaces |
| Graphics | Charts, displays, visualizations |
| Video | Video playback/recording |
| Multi-Platform | PC, phone, web, system tray |
| User Preferences | Theme, notifications, accessibility |

### Bridge Is NOT Responsible For

| Anti-Pattern | Why It's Wrong |
|--------------|----------------|
| AI processing | That's Nexus (Tier 1) or DE (Tier 2) |
| Context caching | That's Mnemo's job |
| Memory management | That's Nexus's job |
| LLM execution | That's DE's job |

### Bridge Request Flow

```
User → Bridge → Nexus → (processing) → Nexus → Bridge → User
```

Bridge is purely an interface layer. It presents information and captures input, but doesn't process AI requests itself.

---

## Anti-Patterns to Avoid

### Don't Put Orchestration in DE

```
# WRONG
DE decides: "This looks like a code question, I'll use Claude"

# RIGHT
Nexus decides: "This is Tier 2, route to DE text-gen with Claude"
DE executes: Uses Claude as instructed
```

### Don't Put Decision-Making in Mnemo

```
# WRONG
Mnemo detects: "User mentioned Istanbul, I'll load Turkey context"

# RIGHT
Nexus detects: "User mentioned Istanbul"
Nexus calls: Mnemo.context_load(turkey_context)
Mnemo caches: Turkey context (as instructed)
```

### Don't Put Voice UI in Nexus

```
# WRONG
Nexus handles: Voice input → transcription → processing → voice output

# RIGHT
Bridge handles: Voice input → transcription
Bridge sends: Text to Nexus
Nexus processes: Returns response
Bridge handles: Text-to-speech output
```

### Don't Put AI Processing in Bridge

```
# WRONG
Bridge uses: Claude API to process user request

# RIGHT
Bridge sends: User request to Nexus
Nexus processes: Via Tier 1 or routes to DE for Tier 2
Nexus returns: Response to Bridge
Bridge displays: Response to user
```

---

## Integration Patterns

### Nexus → Mnemo (Context Loading)

```typescript
// Nexus Active Memory Manager detects entity
const entity = detectEntity(conversation, "Istanbul");

// Nexus tells Mnemo to load relevant context
await mnemo.context_load({
  source: turkeyProjectFolder,
  alias: "turkey-context"
});

// Later, Nexus queries Mnemo
const answer = await mnemo.context_query({
  alias: "turkey-context",
  question: "What's the warehouse solar capacity?"
});
```

### Nexus → DE (Tier 2 Processing)

```typescript
// Nexus classifies request as Tier 2
const tier = classifyRequest(userRequest); // Returns "tier2"

// Nexus routes to DE for heavy processing
const response = await de.textGen({
  prompt: userRequest,
  model_id: "claude-sonnet",
  options: { max_tokens: 4000 }
});

// Nexus returns result
return response;
```

### Bridge → Nexus (User Request)

```typescript
// Bridge captures user input (text or voice)
const userInput = await captureInput();

// Bridge sends to Nexus
const response = await nexus.process({
  input: userInput,
  session_id: currentSession
});

// Bridge displays response
displayResponse(response);
```

---

## Branding Notes

### Logos Flux (logosflux.io)
- **Persona:** L33t hacker, open source enthusiast
- **Tone:** Technical, cutting-edge, community-driven
- **Use For:** Open source releases, developer tools, technical blog posts

### Voltage Labs (voltagelabs.net)
- **Persona:** Polished business professional
- **Tone:** Enterprise-ready, reliable, professional
- **Use For:** Client-facing products, enterprise sales, business partnerships

### DE Branding
DE can live under either brand or both:
- **Open Source:** Logos Flux
- **Enterprise/SaaS:** Voltage Labs

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-12 | Initial ecosystem boundary documentation |

---

*Document maintained in developer-guides-mcp repo*
