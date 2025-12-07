-- Migration: 003_insert_new_guides.sql
-- Purpose: Insert scale-orchestration and ecosystem-architecture guides
-- Date: 2025-12-04

-- Insert scale-orchestration-guide
INSERT INTO guides (id, title, category, subcategory, type, status, version, last_updated, tags, related_guides, markdown_url)
VALUES (
  'scale-orchestration-guide',
  'Scale & Multi-Agent Orchestration Guide',
  'architecture',
  NULL,
  'guide',
  'draft',
  '1.0.0',
  '2025-12-04',
  '["scale", "multi-agent", "orchestration", "parallel-development", "claude-code"]',
  '["02-architecture", "04-cloudflare-workers", "06-ai-ml"]',
  'guides/scale-orchestration-guide.md'
)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  category = excluded.category,
  type = excluded.type,
  status = excluded.status,
  version = excluded.version,
  last_updated = excluded.last_updated,
  tags = excluded.tags,
  related_guides = excluded.related_guides,
  markdown_url = excluded.markdown_url;

-- Insert ecosystem-architecture-reference
INSERT INTO guides (id, title, category, subcategory, type, status, version, last_updated, tags, related_guides, markdown_url)
VALUES (
  'ecosystem-architecture-reference',
  'Ecosystem Architecture Reference - Development Philosophy & Patterns',
  'architecture',
  NULL,
  'reference',
  'finalized',
  '1.0.0',
  '2025-12-04',
  '["architecture", "DE", "distributed-electrons", "mnemo", "nexus", "philosophy", "patterns", "service-registry"]',
  '["02-architecture", "scale-orchestration-guide", "04-cloudflare-workers"]',
  'guides/ecosystem-architecture-reference.md'
)
ON CONFLICT(id) DO UPDATE SET
  title = excluded.title,
  category = excluded.category,
  type = excluded.type,
  status = excluded.status,
  version = excluded.version,
  last_updated = excluded.last_updated,
  tags = excluded.tags,
  related_guides = excluded.related_guides,
  markdown_url = excluded.markdown_url;

-- Insert FTS entries for full-text search
DELETE FROM guides_fts WHERE guide_id = 'scale-orchestration-guide';
INSERT INTO guides_fts (guide_id, title, content, tags)
VALUES (
  'scale-orchestration-guide',
  'Scale & Multi-Agent Orchestration Guide',
  'Scale multi-agent orchestration parallel development 4x4x4 model team leaders coders resource acquisition loop delegation mindset handoff protocol phase-based execution task decomposition communication protocol coordination strategies git-based tracking anti-patterns success metrics velocity indicators scale indicators',
  '["scale", "multi-agent", "orchestration", "parallel-development", "claude-code"]'
);

DELETE FROM guides_fts WHERE guide_id = 'ecosystem-architecture-reference';
INSERT INTO guides_fts (guide_id, title, content, tags)
VALUES (
  'ecosystem-architecture-reference',
  'Ecosystem Architecture Reference - Development Philosophy & Patterns',
  'Ecosystem architecture distributed electrons DE backend processes Mnemo working memory Nexus long-term memory strategic planning service registry MCP server management claude-mcp-config rate limiting philosophy branching strategy documentation requirements Three Pillars worker extraction pattern instance model preemptive context loading',
  '["architecture", "DE", "distributed-electrons", "mnemo", "nexus", "philosophy", "patterns", "service-registry"]'
);
