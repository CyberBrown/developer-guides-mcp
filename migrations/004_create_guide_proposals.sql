-- Migration: Create guide_proposals table for new guide submissions
-- This allows AI agents to propose entirely new guides (not just changes to existing ones)

CREATE TABLE IF NOT EXISTS guide_proposals (
  id TEXT PRIMARY KEY,

  -- Guide metadata (mirrors guides table structure)
  guide_id TEXT NOT NULL,           -- Proposed ID for the new guide
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  type TEXT NOT NULL,               -- guide, reference, planning
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, review, finalized (proposed status)
  version TEXT NOT NULL DEFAULT '1.0.0',
  tags TEXT NOT NULL,               -- JSON array
  related_guides TEXT,              -- JSON array

  -- Full markdown content
  markdown_content TEXT NOT NULL,

  -- Proposal metadata
  rationale TEXT NOT NULL,          -- Why this guide should be added
  proposed_by TEXT NOT NULL,
  proposal_status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, deferred

  -- Review fields
  reviewed_by TEXT,
  review_notes TEXT,
  created_at DATETIME NOT NULL,
  reviewed_at DATETIME
);

-- Index for listing pending proposals
CREATE INDEX IF NOT EXISTS idx_guide_proposals_status ON guide_proposals(proposal_status);
CREATE INDEX IF NOT EXISTS idx_guide_proposals_created ON guide_proposals(created_at DESC);
