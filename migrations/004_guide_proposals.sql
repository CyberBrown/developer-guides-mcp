-- Migration: Add guide_proposals table for proposing new guides
-- This enables Claude.ai sessions to propose entirely new guides, not just changes to existing ones

CREATE TABLE IF NOT EXISTS guide_proposals (
  id TEXT PRIMARY KEY,

  -- Guide metadata (same structure as guides table)
  guide_id TEXT NOT NULL,              -- Proposed ID for the guide
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  type TEXT DEFAULT 'guide',           -- guide, reference, planning, index
  status TEXT DEFAULT 'draft',         -- proposed status: draft, review, finalized
  version TEXT DEFAULT '1.0.0',
  tags TEXT,                           -- JSON array
  related_guides TEXT,                 -- JSON array

  -- Content
  markdown_content TEXT NOT NULL,      -- Full markdown content

  -- Proposal metadata
  proposed_by TEXT DEFAULT 'claude-code-cli',
  rationale TEXT,                      -- Why this guide should be added
  proposal_status TEXT DEFAULT 'pending',  -- pending, approved, rejected

  -- Review tracking
  reviewed_by TEXT,
  review_notes TEXT,
  reviewed_at TEXT,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for listing pending proposals
CREATE INDEX IF NOT EXISTS idx_guide_proposals_status ON guide_proposals(proposal_status);
CREATE INDEX IF NOT EXISTS idx_guide_proposals_created ON guide_proposals(created_at DESC);

-- Ensure proposed guide_id is unique among pending proposals
CREATE UNIQUE INDEX IF NOT EXISTS idx_guide_proposals_pending_guide_id
  ON guide_proposals(guide_id) WHERE proposal_status = 'pending';
