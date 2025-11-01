---
id: security-guide
title: Security Guide - Validation, Authentication, Secrets & Headers
category: security
type: guide
status: finalized
version: 2.0.0
last_updated: 2025-11-01
languages: [typescript, javascript, python]
platforms: [cloudflare-workers, nodejs]
tags: [security, validation, authentication, authorization, secrets, cors, headers, xss, csrf, sql-injection]
related_guides: [01-fundamentals, 04-cloudflare-workers, 06-ai-ml, 08-observability]
---

# Security Guide

## Overview

This comprehensive security guide covers input validation, authentication, authorization, secret management, and security headers. Security is not optional - these practices must be implemented in every project.

**Core Philosophy:** Security by design, defense in depth, fail securely.

---

# 07-001: INPUT VALIDATION & SANITIZATION

## Core Principles

1. **Never Trust User Input** - All input is potentially malicious
2. **Validate Early** - Check input at system boundaries
3. **Whitelist Over Blacklist** - Define what's allowed, not what's forbidden
4. **Type Safety** - Use schema validation libraries
5. **Sanitize Output** - Prevent injection attacks

---

## Schema Validation (Zod)

### Basic Validation

```typescript
import { z } from 'zod';

// Define schema
const UserCreateSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long'),
  age: z.number()
    .int('Age must be integer')
    .min(18, 'Must be 18 or older')
    .max(120, 'Invalid age')
    .optional()
});

// Validate
function validateUserCreate(data: unknown) {
  try {
    return UserCreateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid input', error.errors);
    }
    throw error;
  }
}

// Usage in API
app.post('/api/users', async (c) => {
  const body = await c.req.json();
  
  try {
    const validData = validateUserCreate(body);
    const user = await createUser(validData);
    return c.json(user, 201);
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.json({ error: error.message, details: error.details }, 400);
    }
    throw error;
  }
});
```

### Advanced Validation Patterns

```typescript
// Nested objects
const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/)
});

const UserWithAddressSchema = z.object({
  name: z.string(),
  address: AddressSchema
});

// Arrays
const TagsSchema = z.array(z.string())
  .min(1, 'At least one tag required')
  .max(10, 'Maximum 10 tags');

// Enums
const UserRoleSchema = z.enum(['admin', 'user', 'guest']);

// Conditional validation
const ConditionalSchema = z.object({
  type: z.enum(['email', 'sms']),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\d{10}$/).optional()
}).refine(data => {
  if (data.type === 'email') return !!data.email;
  if (data.type === 'sms') return !!data.phone;
  return false;
}, {
  message: 'Must provide email for email type or phone for sms type'
});

// Transform and validate
const DateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform(str => new Date(str))
  .refine(date => !isNaN(date.getTime()), {
    message: 'Invalid date'
  });
```

---

## SQL Injection Prevention

### ❌ NEVER DO THIS

```typescript
// DANGEROUS - SQL Injection vulnerability
const userId = request.query.id;
const query = `SELECT * FROM users WHERE id = '${userId}'`;
const user = await db.execute(query);

// Attacker can send: ' OR '1'='1
// Resulting query: SELECT * FROM users WHERE id = '' OR '1'='1'
// Returns all users!
```

### ✅ ALWAYS DO THIS

```typescript
// SAFE - Using parameterized queries (D1)
const userId = request.query.id;
const user = await env.DB.prepare(
  'SELECT * FROM users WHERE id = ?'
).bind(userId).first();

// SAFE - Using prepared statements (PostgreSQL with Prisma)
const user = await prisma.user.findUnique({
  where: { id: userId }
});
```

---

## XSS (Cross-Site Scripting) Prevention

### Output Encoding

```typescript
// ❌ DANGEROUS - Direct HTML insertion
function renderUserName(name: string) {
  return `<div>${name}</div>`;  // If name is "<script>alert('xss')</script>"
}

// ✅ SAFE - Framework handles escaping (Qwik/React)
export const UserName = component$<{ name: string }>(({ name }) => {
  return <div>{name}</div>;  // Automatically escaped
});

// ✅ SAFE - Manual escaping if needed
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, char => map[char]);
}
```

### Content Security Policy (CSP)

```typescript
// Cloudflare Workers - Set CSP headers
app.use('*', async (c, next) => {
  await next();
  
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.example.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
});
```

---

## Path Traversal Prevention

```typescript
import { join, normalize } from 'path';

// ❌ DANGEROUS - Path traversal vulnerability
app.get('/files/:filename', async (c) => {
  const filename = c.req.param('filename');
  const filePath = `./uploads/${filename}`;  // ../../../etc/passwd
  return c.file(filePath);
});

// ✅ SAFE - Validate and sanitize file paths
app.get('/files/:filename', async (c) => {
  const filename = c.req.param('filename');
  
  // Reject suspicious patterns
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return c.json({ error: 'Invalid filename' }, 400);
  }
  
  // Whitelist allowed characters
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename)) {
    return c.json({ error: 'Invalid filename format' }, 400);
  }
  
  const filePath = join('./uploads', filename);
  
  // Verify resolved path is within allowed directory
  if (!filePath.startsWith('./uploads/')) {
    return c.json({ error: 'Access denied' }, 403);
  }
  
  return c.file(filePath);
});
```

---

## File Upload Validation

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function validateUpload(file: File): Promise<void> {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError('File too large (max 5MB)');
  }
  
  // Check MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ValidationError('Invalid file type');
  }
  
  // Verify file header (magic bytes) matches MIME type
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  if (file.type === 'image/jpeg') {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
      throw new ValidationError('File header does not match JPEG format');
    }
  } else if (file.type === 'image/png') {
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
      throw new ValidationError('File header does not match PNG format');
    }
  }
}
```

---

# 07-002: AUTHENTICATION & AUTHORIZATION

## Core Principles

1. **Authentication** - Who are you? (Identity)
2. **Authorization** - What can you do? (Permissions)
3. **Least Privilege** - Grant minimum necessary access
4. **Defense in Depth** - Multiple security layers
5. **Secure Sessions** - Proper token management

---

## JWT Authentication

### Token Generation

```typescript
import { SignJWT } from 'jose';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

async function generateToken(
  payload: TokenPayload,
  secret: string
): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setIssuer('your-app')
    .sign(new TextEncoder().encode(secret));
  
  return token;
}
```

### Token Verification

```typescript
import { jwtVerify } from 'jose';

async function verifyToken(
  token: string,
  secret: string
): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    
    return payload as TokenPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
```

### Authentication Middleware

```typescript
import { Hono } from 'hono';

const app = new Hono<{ 
  Bindings: Env; 
  Variables: { user: TokenPayload } 
}>();

// Auth middleware
const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

// Protected routes
app.get('/api/profile', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({ user });
});
```

---

## Role-Based Access Control (RBAC)

```typescript
type Permission = 
  | 'user:read'
  | 'user:write'
  | 'user:delete'
  | 'post:read'
  | 'post:write'
  | 'post:delete'
  | 'admin:access';

interface Role {
  name: string;
  permissions: Permission[];
}

const ROLES: Record<string, Role> = {
  guest: {
    name: 'guest',
    permissions: ['user:read', 'post:read']
  },
  user: {
    name: 'user',
    permissions: ['user:read', 'user:write', 'post:read', 'post:write']
  },
  admin: {
    name: 'admin',
    permissions: [
      'user:read', 'user:write', 'user:delete',
      'post:read', 'post:write', 'post:delete',
      'admin:access'
    ]
  }
};

function hasPermission(role: string, permission: Permission): boolean {
  const roleObj = ROLES[role];
  if (!roleObj) return false;
  return roleObj.permissions.includes(permission);
}

// Authorization middleware
function requirePermission(permission: Permission) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    if (!hasPermission(user.role, permission)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    await next();
  };
}

// Usage
app.delete('/api/users/:id', 
  authMiddleware,
  requirePermission('user:delete'),
  async (c) => {
    const id = c.req.param('id');
    await deleteUser(id);
    return c.json({ success: true });
  }
);
```

---

## Password Security

### Password Hashing

```typescript
// ❌ NEVER store plain text passwords
const user = {
  email: 'user@example.com',
  password: 'mypassword123'  // DANGEROUS!
};

// ✅ ALWAYS hash passwords
import bcrypt from 'bcryptjs';

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Usage
async function createUser(email: string, password: string) {
  const passwordHash = await hashPassword(password);
  
  return await db.user.create({
    data: {
      email,
      passwordHash  // Store hash, not plain password
    }
  });
}

async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  
  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }
  
  const valid = await verifyPassword(password, user.passwordHash);
  
  if (!valid) {
    throw new UnauthorizedError('Invalid credentials');
  }
  
  const token = await generateToken({
    userId: user.id,
    email: user.email,
    role: user.role
  }, env.JWT_SECRET);
  
  return { token, user };
}
```

### Password Requirements

```typescript
const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
  .refine(password => {
    // Check against common passwords
    const commonPasswords = ['password', '123456', 'qwerty'];
    return !commonPasswords.includes(password.toLowerCase());
  }, 'Password is too common');
```

---

# 07-003: SECRET MANAGEMENT

## Core Principles

1. **Never Commit Secrets** - Use environment variables
2. **Rotate Regularly** - Update secrets periodically
3. **Principle of Least Privilege** - Limit secret access
4. **Encrypt at Rest** - Store encrypted when persisted
5. **Audit Access** - Log secret usage

---

## Environment Variables (Cloudflare Workers)

### Using wrangler.toml

```toml
# wrangler.toml
name = "my-worker"

# Public variables (committed to git)
[vars]
ENVIRONMENT = "production"
API_VERSION = "v1"
LOG_LEVEL = "info"

# ❌ NEVER put secrets in vars section
# [vars]
# API_KEY = "sk_live_abc123"  # DANGEROUS!
```

### Using Secrets (CLI)

```bash
# Set secrets via CLI (not committed)
wrangler secret put API_KEY
# Enter secret: ****

wrangler secret put DATABASE_URL
wrangler secret put JWT_SECRET
wrangler secret put STRIPE_SECRET_KEY

# List secrets (values hidden)
wrangler secret list

# Delete secret
wrangler secret delete OLD_SECRET
```

### Accessing Secrets in Code

```typescript
interface Env {
  // Public variables
  ENVIRONMENT: string;
  API_VERSION: string;
  
  // Secrets
  API_KEY: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ✅ Use secrets from env
    const response = await fetch('https://api.example.com', {
      headers: {
        'Authorization': `Bearer ${env.API_KEY}`
      }
    });
    
    // ❌ NEVER log secrets
    console.log(env.API_KEY);  // DANGEROUS!
    
    // ❌ NEVER return secrets to client
    return new Response(JSON.stringify({
      apiKey: env.API_KEY  // DANGEROUS!
    }));
    
    return response;
  }
};
```

---

## Secret Rotation

```typescript
// Support multiple API keys during rotation
interface Env {
  API_KEY_PRIMARY: string;
  API_KEY_SECONDARY?: string;  // Old key during rotation
}

async function callAPI(env: Env, endpoint: string): Promise<Response> {
  // Try primary key first
  let response = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${env.API_KEY_PRIMARY}` }
  });
  
  // If primary fails with 401, try secondary (during rotation period)
  if (response.status === 401 && env.API_KEY_SECONDARY) {
    response = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${env.API_KEY_SECONDARY}` }
    });
  }
  
  return response;
}
```

---

# 07-004: SECURITY HEADERS & CORS

## Security Headers

```typescript
import { Hono } from 'hono';

const app = new Hono();

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  
  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  c.header('X-XSS-Protection', '1; mode=block');
  
  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');
  
  // Strict Transport Security (HTTPS only)
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Content Security Policy
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.example.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  
  // Referrer Policy
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  c.header('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()'
  ].join(', '));
});
```

---

## CORS Configuration

### Simple CORS

```typescript
import { cors } from 'hono/cors';

// Allow all origins (development only!)
app.use('*', cors());

// Production CORS configuration
app.use('*', cors({
  origin: ['https://example.com', 'https://www.example.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
  credentials: true
}));
```

### Dynamic CORS

```typescript
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  
  // Whitelist of allowed origins
  const allowedOrigins = [
    'https://example.com',
    'https://www.example.com',
    'https://app.example.com'
  ];
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.header('Access-Control-Max-Age', '86400');
    return c.text('', 204);
  }
  
  await next();
});
```

---

## Rate Limiting

```typescript
// Simple in-memory rate limiter (use KV/DO for production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    
    let record = rateLimitStore.get(ip);
    
    // Reset if window expired
    if (!record || now > record.resetAt) {
      record = {
        count: 0,
        resetAt: now + windowMs
      };
    }
    
    record.count++;
    rateLimitStore.set(ip, record);
    
    // Check limit
    if (record.count > maxRequests) {
      return c.json({
        error: 'Too many requests',
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      }, 429);
    }
    
    // Set headers
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    c.header('X-RateLimit-Reset', new Date(record.resetAt).toISOString());
    
    await next();
  };
}

// Usage
app.use('/api/*', rateLimit(100, 60000)); // 100 requests per minute
```

---

## Best Practices Summary

### DO ✅
- Validate all inputs with schemas
- Use parameterized queries
- Hash passwords with bcrypt
- Store secrets in environment variables
- Implement authentication and authorization
- Set security headers
- Configure CORS properly
- Rate limit APIs
- Log security events
- Rotate secrets regularly

### DON'T ❌
- Trust user input
- Build SQL queries with string concatenation
- Store plain text passwords
- Commit secrets to git
- Log sensitive data
- Use `eval()` or similar
- Disable security features
- Return detailed error messages to clients
- Use weak password requirements
- Ignore security updates

---

## Related Guides

- [01-Fundamentals - Error Handling](./01-fundamentals.md)
- [04-Cloudflare Workers](./04-cloudflare-workers.md)
- [06-AI/ML Integration](./06-ai-ml.md)
- [08-Observability](./08-observability.md)

---

## Changelog

### v2.0.0 (2025-11-01)
- Consolidated 4 security guides
- Added comprehensive validation examples
- Added authentication/authorization patterns
- Added secret management best practices
- Added security headers and CORS configuration

---

**Next:** Review [Testing Guide](./09-testing.md) for quality assurance practices