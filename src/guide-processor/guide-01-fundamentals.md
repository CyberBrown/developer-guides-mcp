---
id: fundamentals-guide
title: Fundamentals Guide - Code Organization, Naming, Documentation, Error Handling & Types
category: fundamentals
type: guide
status: finalized
version: 2.0.0
last_updated: 2025-11-01
languages: [typescript, javascript, python, go]
tags: [fundamentals, code-organization, naming, documentation, error-handling, types, best-practices]
related_guides: [03-frontend, 04-cloudflare-workers, 07-security]
---

# Fundamentals Guide

## Overview

This guide covers the foundational principles that apply to all development work: code organization, naming conventions, documentation standards, error handling patterns, and type systems. These principles are language-agnostic where possible, with specific guidance for TypeScript, Python, and Go.

---

# 01-001: CODE ORGANIZATION & FILE STRUCTURE

## Core Principles

1. **Predictable Structure** - Developers should find files intuitively
2. **Separation of Concerns** - Related code together, unrelated code apart
3. **Scalability** - Structure should grow with the project
4. **Discoverability** - Clear naming and organization
5. **Modularity** - Easy to extract and reuse

---

## Project Structure Patterns

### Frontend Projects (Qwik/React)

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base UI primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── card.tsx
│   ├── features/        # Feature-specific components
│   │   ├── auth/
│   │   │   ├── login-form.tsx
│   │   │   └── signup-form.tsx
│   │   └── dashboard/
│   │       ├── stats-card.tsx
│   │       └── activity-feed.tsx
│   └── layouts/         # Layout components
│       ├── main-layout.tsx
│       └── auth-layout.tsx
├── routes/              # File-based routing (Qwik)
│   ├── index.tsx
│   ├── about/
│   │   └── index.tsx
│   └── dashboard/
│       ├── index.tsx
│       └── [id]/
│           └── index.tsx
├── lib/                 # Shared utilities
│   ├── utils.ts         # Generic utilities
│   ├── constants.ts     # App constants
│   └── config.ts        # Configuration
├── services/            # Business logic / API clients
│   ├── user-service.ts
│   ├── auth-service.ts
│   └── api-client.ts
├── hooks/               # Custom hooks (React)
│   ├── use-auth.ts
│   └── use-local-storage.ts
├── types/               # TypeScript type definitions
│   ├── user.ts
│   ├── api.ts
│   └── common.ts
├── styles/              # Global styles
│   └── global.css
└── tests/               # Test files
    ├── unit/
    ├── integration/
    └── e2e/
```

### Backend Projects (Cloudflare Workers)

```
src/
├── handlers/            # Request handlers
│   ├── users.ts
│   ├── posts.ts
│   └── auth.ts
├── middleware/          # Middleware functions
│   ├── auth.ts
│   ├── logging.ts
│   └── error-handler.ts
├── services/            # Business logic
│   ├── user-service.ts
│   ├── email-service.ts
│   └── payment-service.ts
├── repositories/        # Data access layer
│   ├── user-repository.ts
│   └── post-repository.ts
├── lib/                 # Shared utilities
│   ├── logger.ts
│   ├── validator.ts
│   └── crypto.ts
├── types/               # Type definitions
│   ├── env.d.ts
│   ├── user.ts
│   └── api.ts
├── schemas/             # Validation schemas (Zod)
│   ├── user-schema.ts
│   └── post-schema.ts
├── db/                  # Database related
│   ├── migrations/
│   └── schema.sql
└── tests/
    ├── unit/
    └── integration/
```

### Monorepo Structure

```
packages/
├── web/                 # Frontend application
│   ├── src/
│   └── package.json
├── api/                 # Backend API
│   ├── src/
│   └── package.json
├── shared/              # Shared code
│   ├── types/
│   ├── utils/
│   └── package.json
└── docs/                # Documentation
    └── guides/
```

---

## File Naming Conventions

### General Rules

- **kebab-case** for files: `user-service.ts`, `api-client.ts`
- **PascalCase** for components: `UserProfile.tsx`, `LoginForm.tsx`
- **camelCase** for utilities: `formatDate.ts`, `validateEmail.ts`
- Test files: `user-service.test.ts`, `UserProfile.test.tsx`

### Examples

```
✅ Good
src/components/UserProfile.tsx
src/services/user-service.ts
src/lib/format-date.ts
src/types/user.ts

❌ Bad
src/components/userProfile.tsx      # Wrong case
src/services/UserService.ts         # Wrong case
src/lib/FormatDate.ts               # Wrong case
src/types/User.ts                   # Types should be lowercase
```

---

## Module Organization

### Single Responsibility

```typescript
// ❌ Bad - Too many responsibilities
// user-everything.ts
export function getUser() { }
export function createUser() { }
export function hashPassword() { }
export function sendEmail() { }
export function validateUser() { }

// ✅ Good - Separated by responsibility
// user-service.ts
export function getUser() { }
export function createUser() { }

// crypto.ts
export function hashPassword() { }

// email-service.ts
export function sendEmail() { }

// validators.ts
export function validateUser() { }
```

### Barrel Exports

```typescript
// components/index.ts - Barrel file
export { Button } from './button';
export { Input } from './input';
export { Card } from './card';

// Usage
import { Button, Input, Card } from '@/components';
```

---

# 01-002: NAMING CONVENTIONS

## Core Principles

1. **Clarity over Brevity** - `getUserById` over `getUsr`
2. **Consistency** - Same patterns throughout codebase
3. **Descriptive** - Names should explain purpose
4. **Pronounceable** - Easy to discuss in conversation
5. **Searchable** - Easy to find with text search

---

## Variables

### Boolean Variables

```typescript
// ✅ Good - Use is/has/can/should prefixes
const isActive = true;
const hasPermission = false;
const canEdit = true;
const shouldValidate = false;

// ❌ Bad
const active = true;        // Not obviously boolean
const permission = false;   // Ambiguous
```

### Collections

```typescript
// ✅ Good - Plural names for arrays/collections
const users = [];
const posts = [];
const comments = [];

// ❌ Bad - Singular names confusing
const user = [];    // Looks like single item
const post = [];
```

### Constants

```typescript
// ✅ Good - SCREAMING_SNAKE_CASE for true constants
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_TIMEOUT_MS = 5000;

// ✅ Good - camelCase for config objects
const apiConfig = {
  baseUrl: 'https://api.example.com',
  timeout: 5000
};
```

---

## Functions

### Naming Patterns

```typescript
// ✅ Good - Verb-based names
function getUser() { }          // Retrieve data
function createUser() { }       // Create new entity
function updateUser() { }       // Modify existing
function deleteUser() { }       // Remove entity
function validateEmail() { }    // Check validity
function calculateTotal() { }   // Compute value
function formatDate() { }       // Transform data
function handleClick() { }      // Event handler
function fetchUsers() { }       // Async operation

// ❌ Bad - Noun-based names
function user() { }            // What does this do?
function email() { }           // Unclear
```

### Async Function Naming

```typescript
// ✅ Good - Clear async operation
async function fetchUser(id: string) { }
async function loadData() { }
async function saveChanges() { }

// Also acceptable
async function getUser(id: string) { }  // get* can be sync or async
```

---

## Classes and Components

### PascalCase for Classes

```typescript
// ✅ Good
class UserService { }
class PaymentProcessor { }
class DataValidator { }

// ❌ Bad
class userService { }
class payment_processor { }
```

### Component Naming

```typescript
// ✅ Good - Descriptive, PascalCase
export const UserProfile = component$(() => { });
export const LoginForm = component$(() => { });
export const DashboardHeader = component$(() => { });

// ❌ Bad
export const Profile = component$(() => { });  // Too generic
export const Form = component$(() => { });     // Too generic
```

---

## Types and Interfaces

```typescript
// ✅ Good - Descriptive names
interface User {
  id: string;
  email: string;
  name: string;
}

type UserId = string;
type UserRole = 'admin' | 'user' | 'guest';

interface UserCreateInput {
  email: string;
  password: string;
  name: string;
}

interface UserUpdateInput {
  email?: string;
  name?: string;
}

// ❌ Bad - Generic or unclear
interface IUser { }        // Hungarian notation unnecessary
interface UserInterface { }  // Redundant suffix
type T { }                 // Not descriptive
```

---

# 01-003: DOCUMENTATION STANDARDS

## Core Principles

1. **Self-Documenting Code** - Code should be readable without comments
2. **Comment Why, Not What** - Explain reasoning, not mechanics
3. **Keep Updated** - Outdated docs worse than no docs
4. **Use Tools** - JSDoc, TSDoc for API documentation
5. **README Everything** - Every module should have README

---

## Code Comments

### When to Comment

```typescript
// ✅ Good - Explain complex logic or non-obvious decisions
// We use a WeakMap here to prevent memory leaks from circular references
// when components are unmounted. See: https://github.com/issue/123
const componentCache = new WeakMap();

// Using binary search because the list is sorted and can be large (10k+ items)
// Linear search would be O(n), this is O(log n)
function findUser(sortedUsers: User[], id: string) {
  // binary search implementation
}

// ❌ Bad - Stating the obvious
// Increment counter by 1
counter++;

// Loop through users
for (const user of users) {
  // ...
}
```

### TODO Comments

```typescript
// ✅ Good - Actionable TODOs with context
// TODO(john): Implement caching layer before launch (JIRA-123)
// TODO: Replace with proper i18n solution once library is integrated
// FIXME: Race condition when multiple requests happen simultaneously

// ❌ Bad - Vague TODOs
// TODO: fix this
// TODO: make better
```

---

## Function Documentation

### TypeScript/JavaScript (TSDoc)

```typescript
/**
 * Fetches a user by their unique identifier.
 * 
 * @param userId - The unique identifier of the user
 * @param options - Optional fetch configuration
 * @param options.includeDeleted - Whether to include soft-deleted users
 * @returns The user object if found
 * @throws {NotFoundError} When user doesn't exist
 * @throws {DatabaseError} When database query fails
 * 
 * @example
 * ```ts
 * const user = await getUser('user_123', { includeDeleted: false });
 * console.log(user.email);
 * ```
 */
async function getUser(
  userId: string,
  options?: { includeDeleted?: boolean }
): Promise<User> {
  // Implementation
}
```

### Python (Docstrings)

```python
def calculate_total(items: list[Item], tax_rate: float = 0.08) -> float:
    """Calculate the total cost including tax.
    
    Args:
        items: List of items to calculate total for
        tax_rate: Tax rate as decimal (default 0.08 for 8%)
        
    Returns:
        Total cost including tax, rounded to 2 decimals
        
    Raises:
        ValueError: If tax_rate is negative or items is empty
        
    Example:
        >>> items = [Item(price=10.0), Item(price=20.0)]
        >>> calculate_total(items, 0.08)
        32.40
    """
    if not items:
        raise ValueError("Items list cannot be empty")
    if tax_rate < 0:
        raise ValueError("Tax rate cannot be negative")
        
    subtotal = sum(item.price for item in items)
    return round(subtotal * (1 + tax_rate), 2)
```

---

## README Standards

### Project README Template

```markdown
# Project Name

Brief description of what this project does.

## Prerequisites

- Node.js 20+
- Cloudflare account (for Workers deployment)
- PostgreSQL 14+ (if using database)

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL=...
API_KEY=...
```

## Development

```bash
npm run dev
```

## Testing

```bash
npm test
npm run test:e2e
```

## Deployment

```bash
npm run deploy
```

## Project Structure

- `/src` - Source code
- `/tests` - Test files
- `/docs` - Documentation

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
```

---

# 01-004: ERROR HANDLING PATTERNS

## Core Principles

1. **Fail Fast** - Detect errors early
2. **Fail Safe** - Degrade gracefully when possible
3. **Informative** - Error messages should help debugging
4. **Logged** - All errors should be logged with context
5. **Typed** - Use custom error types for different scenarios

---

## Custom Error Classes

```typescript
// Base application error
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500, false);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      `External service ${service} failed`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      false
    );
  }
}
```

---

## Error Handling Patterns

### Try-Catch with Specific Error Types

```typescript
async function getUser(id: string): Promise<User> {
  try {
    const user = await db.user.findUnique({ where: { id } });
    
    if (!user) {
      throw new NotFoundError('User', id);
    }
    
    return user;
    
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error; // Re-throw known errors
    }
    
    // Wrap unknown errors
    throw new DatabaseError('Failed to fetch user', error as Error);
  }
}
```

### Error Handler Middleware (Cloudflare Workers)

```typescript
import { Hono } from 'hono';

const app = new Hono();

// Error handling middleware
app.onError((err, c) => {
  console.error(JSON.stringify({
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString()
  }));
  
  if (err instanceof AppError) {
    return c.json({
      error: {
        code: err.code,
        message: err.message,
        details: err instanceof ValidationError ? err.details : undefined
      }
    }, err.statusCode);
  }
  
  // Unknown error - don't leak details
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }, 500);
});
```

### Validation with Error Aggregation

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1)
});

function validateUser(data: unknown): User {
  try {
    return UserSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      throw new ValidationError('Invalid user data', details);
    }
    throw error;
  }
}
```

---

## Async Error Handling

### Promise Error Handling

```typescript
// ✅ Good - Always handle promise rejections
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logger.error('Failed to fetch data', error);
    throw new ExternalServiceError('API');
  }
}

// ❌ Bad - Unhandled promise rejection
async function fetchData() {
  const response = await fetch('/api/data');  // Can throw!
  return await response.json();
}
```

### Parallel Operations with Error Handling

```typescript
// ✅ Good - Handle errors from parallel operations
async function fetchUserData(userId: string) {
  const results = await Promise.allSettled([
    fetchUser(userId),
    fetchUserPosts(userId),
    fetchUserComments(userId)
  ]);
  
  const [userResult, postsResult, commentsResult] = results;
  
  if (userResult.status === 'rejected') {
    throw new Error('Failed to fetch user');
  }
  
  return {
    user: userResult.value,
    posts: postsResult.status === 'fulfilled' ? postsResult.value : [],
    comments: commentsResult.status === 'fulfilled' ? commentsResult.value : []
  };
}
```

---

# 01-005: TYPE SYSTEM GUIDE

## Core Principles

1. **Type Safety** - Catch errors at compile time
2. **Explicit Over Implicit** - Be clear about types
3. **DRY Types** - Reuse type definitions
4. **Strict Mode** - Always use strict type checking
5. **No `any`** - Use `unknown` or proper types

---

## TypeScript Best Practices

### Basic Types

```typescript
// ✅ Good - Explicit types
const userId: string = 'user_123';
const count: number = 42;
const isActive: boolean = true;
const tags: string[] = ['typescript', 'guide'];
const user: User | null = null;

// ✅ Good - Type inference when obvious
const name = 'John';  // Inferred as string
const age = 30;       // Inferred as number

// ❌ Bad - Unnecessary any
const data: any = fetchData();  // Loses type safety
```

### Interface vs Type

```typescript
// ✅ Use interface for object shapes
interface User {
  id: string;
  email: string;
  name: string;
}

// ✅ Use type for unions, intersections, primitives
type UserId = string;
type UserRole = 'admin' | 'user' | 'guest';
type UserWithRole = User & { role: UserRole };

// ✅ Interface can be extended
interface AdminUser extends User {
  permissions: string[];
}

// ✅ Types can be composed
type AuthenticatedUser = User & {
  token: string;
  expiresAt: Date;
};
```

### Utility Types

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  createdAt: Date;
}

// Make all properties optional
type PartialUser = Partial<User>;

// Make all properties required
type RequiredUser = Required<Partial<User>>;

// Pick specific properties
type UserPreview = Pick<User, 'id' | 'name' | 'email'>;

// Omit specific properties
type UserWithoutPassword = Omit<User, 'password'>;

// Make readonly
type ImmutableUser = Readonly<User>;
```

### Generic Types

```typescript
// ✅ Good - Reusable generic types
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Usage
type UserResponse = ApiResponse<User>;
type UserListResponse = PaginatedResponse<User>;

// Generic functions
function first<T>(array: T[]): T | undefined {
  return array[0];
}

const firstUser = first<User>(users);  // Type-safe
```

### Discriminated Unions

```typescript
// ✅ Good - Type-safe state management
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function handleRequest(state: RequestState<User>) {
  switch (state.status) {
    case 'idle':
      return 'No request made';
    case 'loading':
      return 'Loading...';
    case 'success':
      return state.data.name;  // data is available
    case 'error':
      return state.error.message;  // error is available
  }
}
```

---

## Python Type Hints

```python
from typing import Optional, List, Dict, Union, TypedDict, Literal

# Basic type hints
def greet(name: str) -> str:
    return f"Hello, {name}"

# Optional types
def find_user(user_id: str) -> Optional[User]:
    # Returns User or None
    pass

# Collections
def get_users() -> List[User]:
    return []

def get_user_map() -> Dict[str, User]:
    return {}

# Union types
def process(data: Union[str, int, List[str]]) -> None:
    pass

# TypedDict for structured data
class UserDict(TypedDict):
    id: str
    email: str
    name: str

# Literal types
def set_mode(mode: Literal['light', 'dark']) -> None:
    pass
```

---

## Go Types

```go
// Struct types
type User struct {
    ID        string    `json:"id"`
    Email     string    `json:"email"`
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at"`
}

// Interface types
type UserRepository interface {
    GetUser(id string) (*User, error)
    CreateUser(user *User) error
    UpdateUser(user *User) error
    DeleteUser(id string) error
}

// Type aliases
type UserID string
type UserRole string

// Constants for type safety
const (
    RoleAdmin UserRole = "admin"
    RoleUser  UserRole = "user"
    RoleGuest UserRole = "guest"
)

// Generic types (Go 1.18+)
type Result[T any] struct {
    Value T
    Error error
}

func NewResult[T any](value T, err error) Result[T] {
    return Result[T]{Value: value, Error: err}
}
```

---

## Best Practices Summary

### DO ✅
- Use descriptive names that explain purpose
- Organize files by feature/responsibility
- Document complex logic and decisions
- Handle errors explicitly
- Use strict type checking
- Keep code DRY (Don't Repeat Yourself)
- Write self-documenting code
- Use consistent naming across codebase

### DON'T ❌
- Use abbreviations unless universally known
- Mix naming conventions
- Leave code undocumented when complex
- Ignore errors or use empty catch blocks
- Use `any` type in TypeScript
- Repeat type definitions
- Write obvious comments
- Use Hungarian notation

---

## Related Guides

- [03-Frontend Development](./03-frontend.md)
- [04-Cloudflare Workers](./04-cloudflare-workers.md)
- [07-Security](./07-security.md)
- [09-Testing](./09-testing.md)

---

## Changelog

### v2.0.0 (2025-11-01)
- Consolidated 5 fundamental guides into one
- Added multi-language examples
- Added comprehensive error handling
- Added type system guidance
- Added documentation standards

---

**Next:** Review [Architecture Patterns](./02-architecture.md) for system design guidance