---
id: database-performance-guide
title: Database & Performance Optimization Guide
category: [database, performance]
type: guide
status: finalized
version: 2.0.0
last_updated: 2025-11-01
languages: [sql, typescript]
platforms: [d1, postgresql, cloudflare-workers]
tags: [database, d1, sql, schema, migrations, query-optimization, performance, caching, bundle-optimization]
related_guides: [04-cloudflare-workers, 07-security, 08-observability]
---

# Database & Performance Optimization Guide

## Overview

This consolidated guide covers database design, query optimization, data management, and comprehensive performance optimization across frontend, backend, and database layers.

---

# PART 1: DATABASE MANAGEMENT

# 05-001: SCHEMA DESIGN & MIGRATIONS

## Core Principles

1. **Normalize First** - Reduce redundancy
2. **Denormalize Strategically** - For performance when needed
3. **Use Constraints** - Enforce data integrity at DB level
4. **Plan for Scale** - Consider growth from day one
5. **Version Everything** - Track all schema changes

---

## Schema Design Best Practices

### Table Design

```sql
-- ✅ Good table design
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user', 'guest')),
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role) WHERE role = 'admin';

-- Trigger to update updated_at
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

### Relationships

```sql
-- One-to-Many: User has many Posts
CREATE TABLE posts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- Many-to-Many: Posts have many Tags, Tags have many Posts
CREATE TABLE tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT UNIQUE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_tags (
  post_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_post_tags_tag_id ON post_tags(tag_id);
```

---

## Migration Strategy

### Migration Files

```sql
-- migrations/0001_create_users.sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- migrations/0002_add_user_roles.sql
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
CREATE INDEX idx_users_role ON users(role);

-- migrations/0003_create_posts.sql
CREATE TABLE posts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Running Migrations

```bash
# Cloudflare D1 migrations
wrangler d1 migrations create DB create_users
wrangler d1 migrations apply DB --local
wrangler d1 migrations apply DB --remote
```

---

# 05-002: QUERY OPTIMIZATION

## Indexing Strategy

### When to Index

```sql
-- ✅ Index frequently queried columns
CREATE INDEX idx_users_email ON users(email);

-- ✅ Index foreign keys
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- ✅ Index columns in WHERE clauses
CREATE INDEX idx_posts_status ON posts(status);

-- ✅ Index columns in ORDER BY
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- ✅ Composite index for multi-column queries
CREATE INDEX idx_posts_user_status ON posts(user_id, status);

-- ❌ Don't index low-cardinality columns (unless needed)
-- CREATE INDEX idx_users_is_active ON users(is_active); -- Only 2 values

-- ✅ Partial index instead
CREATE INDEX idx_active_users ON users(id) WHERE is_active = 1;
```

### Query Performance

```typescript
// ❌ Bad - N+1 queries
async function getPostsWithAuthors() {
  const posts = await db.prepare('SELECT * FROM posts').all();
  
  for (const post of posts.results) {
    const author = await db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(post.user_id).first();
    post.author = author;
  }
  
  return posts.results;
}

// ✅ Good - Single JOIN query
async function getPostsWithAuthors() {
  return await db.prepare(`
    SELECT 
      posts.*,
      users.name as author_name,
      users.email as author_email
    FROM posts
    JOIN users ON posts.user_id = users.id
    ORDER BY posts.created_at DESC
  `).all();
}
```

---

## Query Patterns

### Pagination

```typescript
// ✅ Cursor-based pagination (better for large datasets)
async function getPosts(cursor?: string, limit: number = 20) {
  const query = cursor
    ? 'SELECT * FROM posts WHERE id < ? ORDER BY id DESC LIMIT ?'
    : 'SELECT * FROM posts ORDER BY id DESC LIMIT ?';
  
  const params = cursor ? [cursor, limit] : [limit];
  
  const result = await db.prepare(query).bind(...params).all();
  
  return {
    items: result.results,
    nextCursor: result.results[result.results.length - 1]?.id
  };
}

// ✅ Offset-based pagination (simpler, but slower for large offsets)
async function getPosts(page: number = 1, pageSize: number = 20) {
  const offset = (page - 1) * pageSize;
  
  const [items, count] = await Promise.all([
    db.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(pageSize, offset)
      .all(),
    db.prepare('SELECT COUNT(*) as total FROM posts').first()
  ]);
  
  return {
    items: items.results,
    total: count.total,
    page,
    pageSize,
    totalPages: Math.ceil(count.total / pageSize)
  };
}
```

### Bulk Operations

```typescript
// ❌ Bad - Multiple individual inserts
for (const user of users) {
  await db.prepare(
    'INSERT INTO users (email, name) VALUES (?, ?)'
  ).bind(user.email, user.name).run();
}

// ✅ Good - Batch insert
const statements = users.map(user =>
  db.prepare('INSERT INTO users (email, name) VALUES (?, ?)')
    .bind(user.email, user.name)
);

await db.batch(statements);
```

---

# 05-003: DATA VALIDATION & INTEGRITY

## Database-Level Constraints

```sql
-- NOT NULL constraints
CREATE TABLE users (
  email TEXT NOT NULL,
  name TEXT NOT NULL
);

-- UNIQUE constraints
CREATE TABLE users (
  email TEXT UNIQUE NOT NULL
);

-- CHECK constraints
CREATE TABLE users (
  role TEXT CHECK(role IN ('admin', 'user', 'guest')),
  age INTEGER CHECK(age >= 18 AND age <= 120)
);

-- DEFAULT values
CREATE TABLE users (
  role TEXT DEFAULT 'user',
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FOREIGN KEY constraints
CREATE TABLE posts (
  user_id TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

# 05-004: HEALTH VERIFICATION

## Database Health Checks

```typescript
interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  details?: {
    connectionStatus: boolean;
    queryPerformance: boolean;
    storageUsage?: number;
  };
}

async function checkDatabaseHealth(db: D1Database): Promise<DatabaseHealth> {
  const start = Date.now();
  
  try {
    // Simple health check query
    await db.prepare('SELECT 1').first();
    const latency = Date.now() - start;
    
    // Check query performance
    const perfStart = Date.now();
    await db.prepare('SELECT COUNT(*) FROM users').first();
    const queryLatency = Date.now() - perfStart;
    
    const queryPerformanceOk = queryLatency < 100; // ms
    
    return {
      status: queryPerformanceOk ? 'healthy' : 'degraded',
      latency,
      details: {
        connectionStatus: true,
        queryPerformance: queryPerformanceOk
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      details: {
        connectionStatus: false,
        queryPerformance: false
      }
    };
  }
}
```

---

# 05-005: DATA RETENTION & DELETION

## Soft Delete Pattern

```sql
-- Add deleted_at column
ALTER TABLE users ADD COLUMN deleted_at DATETIME;

-- Index for filtering
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
```

```typescript
// Soft delete
async function softDeleteUser(userId: string) {
  return await db.prepare(
    'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(userId).run();
}

// Get active users only
async function getActiveUsers() {
  return await db.prepare(
    'SELECT * FROM users WHERE deleted_at IS NULL'
  ).all();
}

// Hard delete (permanent)
async function hardDeleteUser(userId: string) {
  return await db.prepare(
    'DELETE FROM users WHERE id = ?'
  ).bind(userId).run();
}
```

## Data Retention Policy

```typescript
// Clean up soft-deleted records older than 30 days
async function cleanupDeletedRecords() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return await db.prepare(`
    DELETE FROM users 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < ?
  `).bind(thirtyDaysAgo.toISOString()).run();
}
```

---

# PART 2: PERFORMANCE OPTIMIZATION

# 10-001: FRONTEND PERFORMANCE

## Core Principles

1. **Lazy Load Everything** - Load code only when needed
2. **Optimize Critical Path** - Prioritize above-the-fold content
3. **Minimize Bundle Size** - Keep initial load under 50KB
4. **Cache Aggressively** - Leverage browser and edge caching
5. **Measure Constantly** - Use performance monitoring

---

## Bundle Optimization

### Code Splitting (Qwik)

```typescript
// Qwik automatically code-splits by route
// routes/dashboard/index.tsx - Only loads when /dashboard is visited

// Manual lazy loading for heavy components
import { component$, useSignal } from '@builder.io/qwik';

export const Dashboard = component$(() => {
  const chartLoaded = useSignal(false);
  
  const loadChart = $(async () => {
    // Load Chart.js only when needed
    const { Chart } = await import('chart.js');
    chartLoaded.value = true;
    // Use Chart
  });
  
  return (
    <div>
      <button onClick$={loadChart}>Show Analytics</button>
      {chartLoaded.value && <div>Chart Here</div>}
    </div>
  );
});
```

### Dynamic Imports

```typescript
// ❌ Bad - Loads heavy library upfront
import * as _ from 'lodash';

// ✅ Good - Load only when needed
async function processData(data: any[]) {
  const { groupBy } = await import('lodash-es');
  return groupBy(data, 'category');
}

// ✅ Better - Use native alternatives when possible
function processData(data: any[]) {
  return data.reduce((acc, item) => {
    const key = item.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}
```

---

## Image Optimization

```typescript
// Qwik image component with optimization
export const OptimizedImage = component$<{
  src: string;
  alt: string;
  width: number;
  height: number;
}>(({ src, alt, width, height }) => {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      // Responsive images
      srcSet={`
        ${src}?w=400 400w,
        ${src}?w=800 800w,
        ${src}?w=1200 1200w
      `}
      sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
    />
  );
});
```

---

## Resource Hints

```html
<!-- Preconnect to external domains -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://api.example.com">

<!-- Preload critical resources -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/styles/critical.css" as="style">

<!-- Prefetch for next navigation -->
<link rel="prefetch" href="/dashboard">
```

---

# 10-002: BACKEND PERFORMANCE (Cloudflare Workers)

## Caching Strategies

### Cache API

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cache = caches.default;
    const cacheKey = new Request(request.url, request);
    
    // Try cache first
    let response = await cache.match(cacheKey);
    
    if (response) {
      return response;
    }
    
    // Generate response
    response = await generateResponse(request, env);
    
    // Cache if successful
    if (response.ok) {
      response = new Response(response.body, response);
      response.headers.set('Cache-Control', 'public, max-age=300');
      await cache.put(cacheKey, response.clone());
    }
    
    return response;
  }
};
```

### KV Caching

```typescript
async function getCachedData(
  key: string,
  fetchFn: () => Promise<any>,
  env: Env,
  ttl: number = 300
) {
  // Try KV cache
  const cached = await env.CACHE.get(key, 'json');
  if (cached) {
    return cached;
  }
  
  // Fetch fresh data
  const data = await fetchFn();
  
  // Store in KV
  await env.CACHE.put(key, JSON.stringify(data), {
    expirationTtl: ttl
  });
  
  return data;
}

// Usage
const users = await getCachedData(
  'users:active',
  () => db.prepare('SELECT * FROM users WHERE is_active = 1').all(),
  env,
  60 // 1 minute TTL
);
```

---

## Request Optimization

### Parallel Requests

```typescript
// ❌ Bad - Sequential requests
async function getUserData(userId: string, env: Env) {
  const user = await getUser(userId, env);
  const posts = await getUserPosts(userId, env);
  const comments = await getUserComments(userId, env);
  
  return { user, posts, comments };
}

// ✅ Good - Parallel requests
async function getUserData(userId: string, env: Env) {
  const [user, posts, comments] = await Promise.all([
    getUser(userId, env),
    getUserPosts(userId, env),
    getUserComments(userId, env)
  ]);
  
  return { user, posts, comments };
}
```

---

# 10-003: DATABASE PERFORMANCE

## Query Optimization

```typescript
// ❌ Bad - Multiple queries
async function getPostsWithStats(env: Env) {
  const posts = await env.DB.prepare('SELECT * FROM posts').all();
  
  for (const post of posts.results) {
    const commentCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM comments WHERE post_id = ?'
    ).bind(post.id).first();
    post.commentCount = commentCount.count;
  }
  
  return posts.results;
}

// ✅ Good - Single query with aggregation
async function getPostsWithStats(env: Env) {
  return await env.DB.prepare(`
    SELECT 
      posts.*,
      COUNT(comments.id) as comment_count
    FROM posts
    LEFT JOIN comments ON posts.id = comments.post_id
    GROUP BY posts.id
    ORDER BY posts.created_at DESC
  `).all();
}
```

## Connection Pooling

```typescript
// Reuse database connection across requests (Durable Objects)
export class DatabasePool {
  private db: D1Database;
  
  constructor(state: DurableObjectState, env: Env) {
    this.db = env.DB;
  }
  
  async query(sql: string, params: any[]) {
    return await this.db.prepare(sql).bind(...params).all();
  }
}
```

---

# 10-004: MONITORING & METRICS

## Performance Monitoring

```typescript
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  track(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
  }
  
  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
}

// Usage
const monitor = new PerformanceMonitor();

async function handleRequest(request: Request, env: Env) {
  const start = Date.now();
  
  const response = await processRequest(request, env);
  
  const duration = Date.now() - start;
  monitor.track('request_duration', duration);
  
  console.log(JSON.stringify({
    event: 'request_completed',
    duration,
    path: new URL(request.url).pathname,
    status: response.status
  }));
  
  return response;
}
```

---

## Performance Budgets

```typescript
// Define performance budgets
const PERFORMANCE_BUDGETS = {
  // Frontend
  initialBundleSize: 50 * 1024, // 50KB
  totalBundleSize: 200 * 1024, // 200KB
  timeToInteractive: 2000, // 2s
  firstContentfulPaint: 1000, // 1s
  
  // Backend
  apiResponseTime: 200, // 200ms
  databaseQueryTime: 50, // 50ms
  
  // Database
  queryExecutionTime: 100, // 100ms
  indexScanTime: 50 // 50ms
};

// Check against budgets
function checkPerformanceBudget(metric: string, value: number): boolean {
  const budget = PERFORMANCE_BUDGETS[metric];
  if (!budget) return true;
  
  const withinBudget = value <= budget;
  
  if (!withinBudget) {
    console.warn(`Performance budget exceeded for ${metric}: ${value} > ${budget}`);
  }
  
  return withinBudget;
}
```

---

## Best Practices Summary

### Database DO ✅
- Use indexes on frequently queried columns
- Use prepared statements (prevent SQL injection)
- Batch operations when possible
- Implement pagination
- Use transactions for related operations
- Monitor query performance
- Regular maintenance (vacuum, analyze)

### Database DON'T ❌
- Build queries with string concatenation
- Query without indexes on large tables
- Use SELECT * (specify columns)
- Perform N+1 queries
- Store large blobs in database (use R2)
- Ignore slow query logs

### Performance DO ✅
- Lazy load non-critical code
- Cache aggressively
- Optimize images
- Use CDN for static assets
- Minimize bundle size
- Monitor performance metrics
- Set performance budgets

### Performance DON'T ❌
- Load everything upfront
- Skip caching
- Serve unoptimized images
- Ignore bundle size
- Premature optimization
- Guess performance issues

---

## Related Guides

- [04-Cloudflare Workers](./04-cloudflare-workers.md)
- [07-Security](./07-security.md)
- [08-Observability](./08-observability.md)
- [09-Testing](./09-testing.md)

---

## Changelog

### v2.0.0 (2025-11-01)
- Consolidated database and performance guides
- Added schema design best practices
- Added query optimization patterns
- Added comprehensive performance optimization
- Added monitoring and metrics

---

**Complete!** All core guides now available.