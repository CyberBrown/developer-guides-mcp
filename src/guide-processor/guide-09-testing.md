---
id: testing-guide
title: Testing Guide - Strategy, Unit, Integration & E2E Testing
category: testing
type: guide
status: finalized
version: 2.0.0
last_updated: 2025-11-01
languages: [typescript, javascript]
frameworks: [qwik, react, vitest, playwright]
platforms: [cloudflare-workers]
tags: [testing, unit-testing, integration-testing, e2e-testing, tdd, test-coverage, vitest, playwright]
related_guides: [01-fundamentals, 03-frontend, 04-cloudflare-workers, 09-testing]
---

# Testing Guide

## Overview

Comprehensive testing is essential for maintaining code quality, catching bugs early, and enabling confident refactoring. This guide covers testing strategy, unit testing, integration testing, and end-to-end testing across our technology stack.

**Core Philosophy:** Write tests that provide confidence, not just coverage.

---

# 09-001: TESTING STRATEGY

## Testing Pyramid

```
        /\
       /  \  E2E Tests (Few)
      /____\
     /      \
    / Integration \ (Some)
   /____________  \
  /                \
 /   Unit Tests     \ (Many)
/__________________\
```

### Test Distribution
- **70%** Unit Tests - Fast, isolated, many
- **20%** Integration Tests - Medium speed, some dependencies
- **10%** E2E Tests - Slow, full system, critical paths only

---

## What to Test

### ✅ Always Test
- Business logic and algorithms
- Data transformations
- Validation logic
- Error handling
- Edge cases and boundary conditions
- Security-critical code
- API endpoints
- User workflows (E2E)

### ⚠️ Consider Testing
- Simple CRUD operations
- Straightforward utility functions
- Framework integrations

### ❌ Don't Test
- Third-party libraries (trust their tests)
- Framework internals
- Trivial getters/setters
- Configuration files

---

## Test Naming Convention

```typescript
// Pattern: should_ExpectedBehavior_WhenStateUnderTest

describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      // Test implementation
    });
    
    it('should throw ValidationError when email is invalid', async () => {
      // Test implementation
    });
    
    it('should hash password before storing', async () => {
      // Test implementation
    });
    
    it('should return user without password field', async () => {
      // Test implementation
    });
  });
});
```

---

## Test Structure (AAA Pattern)

```typescript
it('should calculate total with tax', () => {
  // Arrange - Set up test data and dependencies
  const items = [
    { price: 10.0 },
    { price: 20.0 }
  ];
  const taxRate = 0.08;
  
  // Act - Execute the code under test
  const total = calculateTotal(items, taxRate);
  
  // Assert - Verify the results
  expect(total).toBe(32.40);
});
```

---

# 09-002: UNIT TESTING

## Core Principles

1. **Fast** - Unit tests should run in milliseconds
2. **Isolated** - No external dependencies
3. **Repeatable** - Same result every time
4. **Self-Validating** - Pass or fail, no manual checking
5. **Timely** - Written before or alongside code

---

## Vitest Setup

### Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

---

## Testing Pure Functions

```typescript
// lib/calculate-total.ts
export function calculateTotal(
  items: { price: number }[],
  taxRate: number = 0
): number {
  if (items.length === 0) {
    throw new Error('Items cannot be empty');
  }
  
  if (taxRate < 0) {
    throw new Error('Tax rate cannot be negative');
  }
  
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  return Math.round(subtotal * (1 + taxRate) * 100) / 100;
}

// lib/calculate-total.test.ts
import { describe, it, expect } from 'vitest';
import { calculateTotal } from './calculate-total';

describe('calculateTotal', () => {
  it('should calculate total without tax', () => {
    const items = [{ price: 10 }, { price: 20 }];
    expect(calculateTotal(items)).toBe(30);
  });
  
  it('should calculate total with tax', () => {
    const items = [{ price: 10 }, { price: 20 }];
    expect(calculateTotal(items, 0.08)).toBe(32.40);
  });
  
  it('should round to 2 decimal places', () => {
    const items = [{ price: 10.005 }];
    expect(calculateTotal(items)).toBe(10.01);
  });
  
  it('should throw error for empty items', () => {
    expect(() => calculateTotal([])).toThrow('Items cannot be empty');
  });
  
  it('should throw error for negative tax rate', () => {
    const items = [{ price: 10 }];
    expect(() => calculateTotal(items, -0.1)).toThrow('Tax rate cannot be negative');
  });
});
```

---

## Mocking Dependencies

```typescript
// services/user-service.ts
import { db } from './db';
import { emailService } from './email-service';

export async function createUser(email: string, name: string) {
  const user = await db.user.create({
    data: { email, name }
  });
  
  await emailService.sendWelcome(user.email);
  
  return user;
}

// services/user-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUser } from './user-service';
import { db } from './db';
import { emailService } from './email-service';

// Mock dependencies
vi.mock('./db');
vi.mock('./email-service');

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should create user and send welcome email', async () => {
    // Arrange
    const mockUser = { id: '1', email: 'test@example.com', name: 'Test' };
    vi.mocked(db.user.create).mockResolvedValue(mockUser);
    vi.mocked(emailService.sendWelcome).mockResolvedValue(undefined);
    
    // Act
    const result = await createUser('test@example.com', 'Test');
    
    // Assert
    expect(db.user.create).toHaveBeenCalledWith({
      data: { email: 'test@example.com', name: 'Test' }
    });
    expect(emailService.sendWelcome).toHaveBeenCalledWith('test@example.com');
    expect(result).toEqual(mockUser);
  });
  
  it('should not send email if user creation fails', async () => {
    // Arrange
    vi.mocked(db.user.create).mockRejectedValue(new Error('DB error'));
    
    // Act & Assert
    await expect(createUser('test@example.com', 'Test')).rejects.toThrow('DB error');
    expect(emailService.sendWelcome).not.toHaveBeenCalled();
  });
});
```

---

## Testing Qwik Components

```typescript
// components/counter.tsx
import { component$, useSignal } from '@builder.io/qwik';

export const Counter = component$(() => {
  const count = useSignal(0);
  
  return (
    <div>
      <p>Count: {count.value}</p>
      <button onClick$={() => count.value++}>Increment</button>
      <button onClick$={() => count.value--}>Decrement</button>
    </div>
  );
});

// components/counter.test.tsx
import { describe, it, expect } from 'vitest';
import { createDOM } from '@builder.io/qwik/testing';
import { Counter } from './counter';

describe('Counter', () => {
  it('should render initial count', async () => {
    const { screen, render } = await createDOM();
    await render(<Counter />);
    
    expect(screen.outerHTML).toContain('Count: 0');
  });
  
  it('should increment count when button clicked', async () => {
    const { screen, render, userEvent } = await createDOM();
    await render(<Counter />);
    
    const incrementButton = screen.querySelector('button:first-child');
    await userEvent.click(incrementButton);
    
    expect(screen.outerHTML).toContain('Count: 1');
  });
  
  it('should decrement count when button clicked', async () => {
    const { screen, render, userEvent } = await createDOM();
    await render(<Counter />);
    
    const decrementButton = screen.querySelector('button:last-child');
    await userEvent.click(decrementButton);
    
    expect(screen.outerHTML).toContain('Count: -1');
  });
});
```

---

## Testing React Components

```typescript
// components/UserProfile.tsx
import { FC } from 'react';

interface UserProfileProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  onEdit?: () => void;
}

export const UserProfile: FC<UserProfileProps> = ({ user, onEdit }) => {
  return (
    <div data-testid="user-profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <span>{user.role}</span>
      {onEdit && <button onClick={onEdit}>Edit</button>}
    </div>
  );
};

// components/UserProfile.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  const mockUser = {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin'
  };
  
  it('should render user information', () => {
    render(<UserProfile user={mockUser} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });
  
  it('should call onEdit when edit button clicked', async () => {
    const onEdit = vi.fn();
    render(<UserProfile user={mockUser} onEdit={onEdit} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editButton);
    
    expect(onEdit).toHaveBeenCalledOnce();
  });
  
  it('should not render edit button when onEdit not provided', () => {
    render(<UserProfile user={mockUser} />);
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
```

---

# 09-003: INTEGRATION TESTING

## Core Principles

1. **Test Interactions** - Verify components work together
2. **Minimal Mocking** - Use real dependencies when practical
3. **Database Tests** - Use test database or transactions
4. **API Tests** - Test actual HTTP endpoints

---

## Testing API Endpoints (Cloudflare Workers)

```typescript
// handlers/users.ts
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare(
    'SELECT id, email, name FROM users WHERE id = ?'
  ).bind(id).first();
  
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  return c.json(user);
});

app.post('/api/users', async (c) => {
  const body = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'INSERT INTO users (email, name) VALUES (?, ?)'
  ).bind(body.email, body.name).run();
  
  return c.json({ id: result.meta.last_row_id }, 201);
});

export default app;

// handlers/users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';

describe('User API', () => {
  let worker: Awaited<ReturnType<typeof unstable_dev>>;
  
  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });
  
  afterAll(async () => {
    await worker.stop();
  });
  
  it('should get user by id', async () => {
    const response = await worker.fetch('/api/users/1');
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('email');
    expect(data).toHaveProperty('name');
  });
  
  it('should return 404 for non-existent user', async () => {
    const response = await worker.fetch('/api/users/99999');
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });
  
  it('should create new user', async () => {
    const response = await worker.fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test User'
      })
    });
    
    const data = await response.json();
    
    expect(response.status).toBe(201);
    expect(data).toHaveProperty('id');
  });
});
```

---

## Testing with Miniflare

```typescript
// tests/integration/user-workflow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';

describe('User Workflow Integration', () => {
  let mf: Miniflare;
  
  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      scriptPath: './dist/index.js',
      d1Databases: ['DB'],
      kvNamespaces: ['CACHE']
    });
    
    // Setup test database
    const db = await mf.getD1Database('DB');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL
      )
    `);
  });
  
  afterAll(async () => {
    await mf.dispose();
  });
  
  it('should complete user registration workflow', async () => {
    // Create user
    let response = await mf.dispatchFetch('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'workflow@example.com',
        name: 'Workflow User'
      })
    });
    
    expect(response.status).toBe(201);
    const { id } = await response.json();
    
    // Fetch created user
    response = await mf.dispatchFetch(`http://localhost/api/users/${id}`);
    expect(response.status).toBe(200);
    
    const user = await response.json();
    expect(user.email).toBe('workflow@example.com');
    expect(user.name).toBe('Workflow User');
  });
});
```

---

# 09-004: END-TO-END TESTING

## Core Principles

1. **User Perspective** - Test as real users would
2. **Critical Paths** - Focus on most important workflows
3. **Stable Selectors** - Use data-testid, not classes
4. **Independent Tests** - Each test stands alone
5. **Cleanup** - Reset state between tests

---

## Playwright Setup

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  }
});
```

---

## E2E Test Examples

### User Authentication Flow

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });
  
  test('should register new user', async ({ page }) => {
    // Navigate to signup
    await page.click('[data-testid="signup-link"]');
    await expect(page).toHaveURL('/signup');
    
    // Fill form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecureP@ss123');
    await page.fill('[data-testid="name-input"]', 'Test User');
    
    // Submit
    await page.click('[data-testid="signup-button"]');
    
    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-name"]')).toHaveText('Test User');
  });
  
  test('should login existing user', async ({ page }) => {
    // Navigate to login
    await page.click('[data-testid="login-link"]');
    
    // Fill credentials
    await page.fill('[data-testid="email-input"]', 'existing@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    
    // Submit
    await page.click('[data-testid="login-button"]');
    
    // Verify login success
    await expect(page).toHaveURL('/dashboard');
  });
  
  test('should show error for invalid credentials', async ({ page }) => {
    await page.click('[data-testid="login-link"]');
    
    await page.fill('[data-testid="email-input"]', 'wrong@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="error-message"]'))
      .toHaveText('Invalid credentials');
  });
  
  test('should logout user', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'existing@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Logout
    await page.click('[data-testid="logout-button"]');
    
    // Verify redirect to home
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="login-link"]')).toBeVisible();
  });
});
```

### CRUD Operations

```typescript
// tests/e2e/posts.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Post Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'user@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to posts
    await page.goto('/posts');
  });
  
  test('should create new post', async ({ page }) => {
    await page.click('[data-testid="create-post-button"]');
    
    await page.fill('[data-testid="title-input"]', 'Test Post');
    await page.fill('[data-testid="content-input"]', 'This is test content');
    await page.click('[data-testid="save-button"]');
    
    // Verify post appears in list
    await expect(page.locator('[data-testid="post-item"]').first())
      .toContainText('Test Post');
  });
  
  test('should edit existing post', async ({ page }) => {
    // Click edit on first post
    await page.click('[data-testid="post-item"]:first-child [data-testid="edit-button"]');
    
    // Update title
    await page.fill('[data-testid="title-input"]', 'Updated Title');
    await page.click('[data-testid="save-button"]');
    
    // Verify update
    await expect(page.locator('[data-testid="post-item"]').first())
      .toContainText('Updated Title');
  });
  
  test('should delete post', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="post-item"]').count();
    
    // Delete first post
    await page.click('[data-testid="post-item"]:first-child [data-testid="delete-button"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Verify post count decreased
    const newCount = await page.locator('[data-testid="post-item"]').count();
    expect(newCount).toBe(initialCount - 1);
  });
});
```

---

## E2E Testing Checklist

### Before Writing Tests

- [ ] Identify critical user workflows
- [ ] Add data-testid attributes to key elements
- [ ] Set up test database/environment
- [ ] Configure test user accounts
- [ ] Plan test data strategy

### Writing Tests

- [ ] Use descriptive test names
- [ ] Test happy path first
- [ ] Add error case tests
- [ ] Test edge cases
- [ ] Verify navigation flows
- [ ] Check form validation
- [ ] Test responsive behavior
- [ ] Verify accessibility

### After Writing Tests

- [ ] Tests pass consistently
- [ ] Tests are independent
- [ ] Tests clean up after themselves
- [ ] Tests run in reasonable time (<5 min suite)
- [ ] CI/CD integration configured
- [ ] Screenshot/video on failure enabled

---

## Test Coverage Goals

### Minimum Coverage Targets

- **Overall:** 80%
- **Business Logic:** 90%
- **Utilities:** 85%
- **Handlers/Controllers:** 75%
- **Components:** 70%

### Coverage Commands

```bash
# Run tests with coverage
npm run test:coverage

# View coverage report
open coverage/index.html

# Fail if below threshold
npm run test:coverage -- --coverage.lines=80
```

---

## Best Practices Summary

### DO ✅
- Write tests alongside code
- Test behavior, not implementation
- Use AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Use descriptive test names
- Test edge cases and errors
- Keep tests fast and isolated
- Use test data builders
- Clean up after tests
- Run tests in CI/CD

### DON'T ❌
- Test framework internals
- Write flaky tests
- Share state between tests
- Use sleep/timeouts (use waitFor)
- Test implementation details
- Mock everything
- Ignore test failures
- Skip writing tests
- Hard-code test data
- Test multiple things in one test

---

## Related Guides

- [01-Fundamentals](./01-fundamentals.md)
- [03-Frontend Development](./03-frontend.md)
- [04-Cloudflare Workers](./04-cloudflare-workers.md)
- [07-Security](./07-security.md)

---

## Changelog

### v2.0.0 (2025-11-01)
- Consolidated testing guides
- Added Vitest configuration
- Added Qwik and React testing examples
- Added Cloudflare Workers testing patterns
- Added Playwright E2E examples
- Added testing checklist

---

**Next:** Review [Database Guide](./05-database.md) for data management practices