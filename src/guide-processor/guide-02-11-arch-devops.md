---
id: architecture-devops-guide
title: Architecture Patterns & DevOps Guide
category: [architecture, devops]
type: guide
status: finalized
version: 2.0.0
last_updated: 2025-11-01
platforms: [cloudflare-workers, cloudflare-pages]
tags: [architecture, design-patterns, api-design, state-management, ci-cd, deployment, environment-config, infrastructure]
related_guides: [03-frontend, 04-cloudflare-workers, 05-database, 09-testing]
---

# Architecture Patterns & DevOps Guide

## Overview

This consolidated guide covers application architecture patterns, API design principles, state management, and DevOps practices including CI/CD, deployment, and infrastructure management.

---

# PART 1: ARCHITECTURE PATTERNS

# 02-001: APPLICATION ARCHITECTURE

## Core Principles

1. **Separation of Concerns** - Each layer has single responsibility
2. **Loose Coupling** - Components interact through interfaces
3. **High Cohesion** - Related functionality grouped together
4. **Scalability** - Design for growth
5. **Maintainability** - Easy to understand and modify

---

## Layered Architecture

```
┌─────────────────────────────────┐
│     Presentation Layer          │  (UI Components, Routes)
├─────────────────────────────────┤
│     Application Layer           │  (Use Cases, Orchestration)
├─────────────────────────────────┤
│     Domain Layer                │  (Business Logic, Entities)
├─────────────────────────────────┤
│     Infrastructure Layer        │  (Database, External APIs)
└─────────────────────────────────┘
```

### Implementation Example

```typescript
// Domain Layer - User entity
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
}

// Infrastructure Layer - Repository
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, 'id'>): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}

class D1UserRepository implements UserRepository {
  constructor(private db: D1Database) {}
  
  async findById(id: string): Promise<User | null> {
    const result = await this.db.prepare(
      'SELECT id, email, name, role FROM users WHERE id = ?'
    ).bind(id).first();
    
    return result as User | null;
  }
  
  async create(user: Omit<User, 'id'>): Promise<User> {
    const id = crypto.randomUUID();
    await this.db.prepare(
      'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)'
    ).bind(id, user.email, user.name, user.role).run();
    
    return { id, ...user };
  }
  
  // ... other methods
}

// Application Layer - Use case
class CreateUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService
  ) {}
  
  async execute(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<User> {
    // Validate input
    if (!this.isValidEmail(input.email)) {
      throw new ValidationError('Invalid email');
    }
    
    // Check if user exists
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('User already exists');
    }
    
    // Hash password
    const passwordHash = await hashPassword(input.password);
    
    // Create user
    const user = await this.userRepository.create({
      email: input.email,
      name: input.name,
      role: 'user'
    });
    
    // Send welcome email (don't block on this)
    this.emailService.sendWelcome(user.email).catch(console.error);
    
    return user;
  }
  
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

// Presentation Layer - API handler
app.post('/api/users', async (c) => {
  const body = await c.req.json();
  
  const createUser = new CreateUserUseCase(
    new D1UserRepository(c.env.DB),
    new EmailService(c.env)
  );
  
  try {
    const user = await createUser.execute(body);
    return c.json(user, 201);
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.json({ error: error.message }, 400);
    }
    if (error instanceof ConflictError) {
      return c.json({ error: error.message }, 409);
    }
    throw error;
  }
});
```

---

## Microservices vs Monolith

### When to Use Monolith (Start Here)

```typescript
// Single Worker handles everything
// src/index.ts
import { Hono } from 'hono';
import { userRoutes } from './routes/users';
import { postRoutes } from './routes/posts';
import { authRoutes } from './routes/auth';

const app = new Hono<{ Bindings: Env }>();

app.route('/api/users', userRoutes);
app.route('/api/posts', postRoutes);
app.route('/api/auth', authRoutes);

export default app;
```

**Advantages:**
- ✅ Simple deployment
- ✅ Easier debugging
- ✅ No network overhead
- ✅ Shared code/types

**Use When:**
- Starting new project
- Small to medium team
- Unclear domain boundaries
- Performance not critical

### When to Split into Microservices

```typescript
// Separate Workers for different domains

// auth-worker (handles authentication)
// src/auth/index.ts
const authApp = new Hono();
authApp.post('/login', handleLogin);
authApp.post('/register', handleRegister);
export default authApp;

// api-worker (handles business logic)
// src/api/index.ts
const apiApp = new Hono();
apiApp.use('*', authMiddleware); // Calls auth-worker
apiApp.route('/users', userRoutes);
apiApp.route('/posts', postRoutes);
export default apiApp;

// worker-gateway (routes requests)
// src/gateway/index.ts
const gateway = new Hono();
gateway.route('/auth/*', () => fetch('https://auth.example.com'));
gateway.route('/api/*', () => fetch('https://api.example.com'));
export default gateway;
```

**Advantages:**
- ✅ Independent scaling
- ✅ Technology flexibility
- ✅ Team autonomy
- ✅ Fault isolation

**Use When:**
- Clear domain boundaries
- Different scaling needs
- Multiple teams
- Need independent deployment

---

# 02-002: API DESIGN PRINCIPLES

## RESTful API Design

### Resource Naming

```
✅ Good - Plural nouns
GET    /api/users           # List users
GET    /api/users/{id}      # Get user
POST   /api/users           # Create user
PUT    /api/users/{id}      # Update user (full)
PATCH  /api/users/{id}      # Update user (partial)
DELETE /api/users/{id}      # Delete user

GET    /api/users/{id}/posts          # User's posts
POST   /api/users/{id}/posts          # Create post for user
DELETE /api/users/{id}/posts/{postId} # Delete user's post

❌ Bad - Verbs or inconsistent naming
GET /api/getUsers
POST /api/createUser
GET /api/user/{id}
```

### HTTP Methods

```typescript
app.get('/api/users', async (c) => {
  // List/search - Idempotent, cacheable
  const users = await db.prepare('SELECT * FROM users').all();
  return c.json(users.results);
});

app.get('/api/users/:id', async (c) => {
  // Retrieve single - Idempotent, cacheable
  const user = await db.prepare('SELECT * FROM users WHERE id = ?')
    .bind(c.req.param('id')).first();
  
  if (!user) return c.json({ error: 'Not found' }, 404);
  return c.json(user);
});

app.post('/api/users', async (c) => {
  // Create - Not idempotent, not cacheable
  const body = await c.req.json();
  const result = await db.prepare(
    'INSERT INTO users (email, name) VALUES (?, ?)'
  ).bind(body.email, body.name).run();
  
  return c.json({ id: result.meta.last_row_id }, 201);
});

app.put('/api/users/:id', async (c) => {
  // Full update - Idempotent
  const body = await c.req.json();
  await db.prepare(
    'UPDATE users SET email = ?, name = ? WHERE id = ?'
  ).bind(body.email, body.name, c.req.param('id')).run();
  
  return c.json({ success: true });
});

app.patch('/api/users/:id', async (c) => {
  // Partial update - Idempotent
  const body = await c.req.json();
  const updates = Object.keys(body).map(k => `${k} = ?`).join(', ');
  
  await db.prepare(
    `UPDATE users SET ${updates} WHERE id = ?`
  ).bind(...Object.values(body), c.req.param('id')).run();
  
  return c.json({ success: true });
});

app.delete('/api/users/:id', async (c) => {
  // Delete - Idempotent
  await db.prepare('DELETE FROM users WHERE id = ?')
    .bind(c.req.param('id')).run();
  
  return c.json({ success: true }, 204);
});
```

---

## Response Format

### Success Response

```typescript
interface SuccessResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

// Single item
{
  "data": {
    "id": "123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "meta": {
    "timestamp": "2025-11-01T12:00:00Z",
    "requestId": "req_abc123"
  }
}

// List with pagination
{
  "data": [
    { "id": "1", "name": "User 1" },
    { "id": "2", "name": "User 2" }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

// Validation error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "password", "message": "Password too short" }
    ]
  },
  "meta": {
    "timestamp": "2025-11-01T12:00:00Z",
    "requestId": "req_abc123"
  }
}
```

---

# 02-004: STATE MANAGEMENT STRATEGY

## Qwik State Management

### Component State (useSignal)

```typescript
import { component$, useSignal } from '@builder.io/qwik';

export const Counter = component$(() => {
  // Simple local state
  const count = useSignal(0);
  
  return (
    <div>
      <p>Count: {count.value}</p>
      <button onClick$={() => count.value++}>+</button>
    </div>
  );
});
```

### Shared State (Context)

```typescript
// context/user-context.tsx
import { createContextId, useContextProvider, useContext } from '@builder.io/qwik';

interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const UserContext = createContextId<UserState>('user-context');

export const UserProvider = component$(() => {
  const user = useSignal<User | null>(null);
  
  const state: UserState = {
    get user() { return user.value; },
    setUser: (u) => { user.value = u; }
  };
  
  useContextProvider(UserContext, state);
  
  return <Slot />;
});

// Usage in child component
export const UserDisplay = component$(() => {
  const userState = useContext(UserContext);
  
  return <div>{userState.user?.name}</div>;
});
```

### Complex State (useStore)

```typescript
import { component$, useStore } from '@builder.io/qwik';

interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  notifications: Notification[];
  isLoading: boolean;
}

export const App = component$(() => {
  const state = useStore<AppState>({
    user: null,
    theme: 'light',
    notifications: [],
    isLoading: false
  });
  
  // Direct mutation triggers reactivity
  const addNotification = $((message: string) => {
    state.notifications.push({
      id: crypto.randomUUID(),
      message,
      timestamp: new Date()
    });
  });
  
  const toggleTheme = $(() => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
  });
  
  return <div>...</div>;
});
```

---

# 02-005: CACHING STRATEGIES

## Cache Layers

```
┌──────────────────┐
│  Browser Cache   │ (Static assets, images)
├──────────────────┤
│   CDN Cache      │ (Edge locations)
├──────────────────┤
│  Worker Cache    │ (Cache API, KV)
├──────────────────┤
│  Database        │ (Persistent storage)
└──────────────────┘
```

### Cache-Control Headers

```typescript
// Static assets - cache forever
app.get('/static/*', async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw);
  return new Response(response.body, {
    headers: {
      ...response.headers,
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
});

// API responses - short cache
app.get('/api/users', async (c) => {
  const users = await getUsers(c.env);
  return c.json(users, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
    }
  });
});

// Private data - no cache
app.get('/api/profile', async (c) => {
  const profile = await getProfile(c);
  return c.json(profile, {
    headers: {
      'Cache-Control': 'private, no-cache, no-store, must-revalidate'
    }
  });
});
```

---

# PART 2: DEVOPS & DEPLOYMENT

# 11-001: CI/CD STANDARDS

## GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type check
        run: npm run type-check
      
      - name: Run tests
        run: npm test
      
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to Cloudflare Workers (Staging)
        run: npx wrangler deploy --env staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Run smoke tests
        run: npm run test:smoke
        env:
          API_URL: https://staging-api.example.com

  deploy-production:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy to Cloudflare Workers (Production)
        run: npx wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Run smoke tests
        run: npm run test:smoke
        env:
          API_URL: https://api.example.com
```

---

# 11-002: ENVIRONMENT CONFIGURATION

## Environment Structure

```
environments/
├── .env.local          # Local development
├── .env.staging        # Staging
└── .env.production     # Production
```

### wrangler.toml Configuration

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"

# Development environment (default)
[env.development]
vars = { ENVIRONMENT = "development", LOG_LEVEL = "debug" }

[[env.development.d1_databases]]
binding = "DB"
database_name = "dev-db"
database_id = "dev-db-id"

[[env.development.kv_namespaces]]
binding = "CACHE"
id = "dev-cache-id"

# Staging environment
[env.staging]
vars = { ENVIRONMENT = "staging", LOG_LEVEL = "info" }
route = "staging-api.example.com/*"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "staging-db"
database_id = "staging-db-id"

[[env.staging.kv_namespaces]]
binding = "CACHE"
id = "staging-cache-id"

# Production environment
[env.production]
vars = { ENVIRONMENT = "production", LOG_LEVEL = "warn" }
route = "api.example.com/*"

[[env.production.d1_databases]]
binding = "DB"
database_name = "production-db"
database_id = "production-db-id"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "production-cache-id"
```

### Secrets Management

```bash
# Set secrets per environment
wrangler secret put API_KEY --env development
wrangler secret put API_KEY --env staging
wrangler secret put API_KEY --env production

# List secrets
wrangler secret list --env production

# Delete secret
wrangler secret delete OLD_SECRET --env production
```

---

# 11-003: CLOUDFLARE DEPLOYMENT

## Deployment Commands

```bash
# Deploy to development (local testing)
wrangler dev

# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production

# Tail logs
wrangler tail --env production

# View deployments
wrangler deployments list

# Rollback to previous deployment
wrangler rollback <deployment-id>
```

## Database Migrations

```bash
# Create migration
wrangler d1 migrations create DB add_users_table

# Apply migrations locally
wrangler d1 migrations apply DB --local

# Apply migrations to staging
wrangler d1 migrations apply DB --env staging

# Apply migrations to production
wrangler d1 migrations apply DB --env production

# List migrations
wrangler d1 migrations list DB
```

---

# 11-004: MONITORING & ALERTING

## Health Check Endpoint

```typescript
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

app.get('/health', async (c) => {
  const checks = await Promise.allSettled([
    checkDatabase(c.env.DB),
    checkKV(c.env.CACHE),
    checkExternalAPI()
  ]);
  
  const [db, kv, api] = checks;
  
  const allHealthy = checks.every(c => 
    c.status === 'fulfilled' && c.value.healthy
  );
  
  const status = allHealthy ? 200 : 503;
  
  return c.json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: db.status === 'fulfilled' ? db.value : { healthy: false },
      kv: kv.status === 'fulfilled' ? kv.value : { healthy: false },
      api: api.status === 'fulfilled' ? api.value : { healthy: false }
    }
  }, status);
});

async function checkDatabase(db: D1Database) {
  try {
    await db.prepare('SELECT 1').first();
    return { healthy: true, latency: 0 };
  } catch {
    return { healthy: false };
  }
}
```

---

## Best Practices Summary

### Architecture DO ✅
- Start with monolith, split when needed
- Use layered architecture
- Separate concerns clearly
- Design for scalability
- Document architecture decisions
- Use RESTful conventions
- Implement health checks

### Architecture DON'T ❌
- Over-engineer from start
- Create unnecessary abstractions
- Couple layers tightly
- Ignore performance early
- Skip documentation

### DevOps DO ✅
- Automate everything
- Use CI/CD pipelines
- Test before deployment
- Monitor production
- Have rollback plan
- Use environment variables
- Version control everything

### DevOps DON'T ❌
- Deploy untested code
- Manual deployments
- Skip staging environment
- Ignore monitoring
- Store secrets in code
- Deploy on Fridays (unless you like weekend work)

---

## Related Guides

- [03-Frontend Development](./03-frontend.md)
- [04-Cloudflare Workers](./04-cloudflare-workers.md)
- [05-Database](./05-database.md)
- [09-Testing](./09-testing.md)

---

## Changelog

### v2.0.0 (2025-11-01)
- Consolidated architecture and DevOps guides
- Added layered architecture patterns
- Added microservices vs monolith guidance
- Added API design principles
- Added CI/CD workflows
- Added deployment strategies

---

**Complete!** All guides now available for MCP server implementation.