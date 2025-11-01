/**
 * Developer Guide MCP Server
 * 
 * Provides tools for searching and accessing developer guidelines
 * Uses hybrid search: D1 metadata + Vectorize semantic search + R2 storage
 */

import { Hono } from 'hono';

// ============================================================================
// Types
// ============================================================================

interface Env {
  DB: D1Database;
  GUIDES_BUCKET: R2Bucket;
  VECTORIZE: VectorizeIndex;
}

interface SearchQuery {
  query: string;
  category?: string;
  framework?: string;
  language?: string;
  tags?: string[];
  limit?: number;
}

interface SearchResult {
  guideId: string;
  sectionId: string;
  title: string;
  excerpt: string;
  relevanceScore: number;
  metadata: {
    category: string;
    framework?: string;
    language?: string;
    tags: string[];
  };
  url: string;
}

interface Guide {
  id: string;
  title: string;
  category: string;
  sections: GuideSection[];
  relatedGuides: string[];
  markdown: string;
}

interface GuideSection {
  id: string;
  title: string;
  content: string;
  codeExamples: CodeExample[];
}

interface CodeExample {
  language: string;
  code: string;
  caption?: string;
}

// ============================================================================
// Search Service
// ============================================================================

class GuideSearchService {
  constructor(
    private db: D1Database,
    private vectorize: VectorizeIndex,
    private r2: R2Bucket
  ) {}
  
  /**
   * Hybrid search combining keyword and semantic search
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const limit = query.limit || 5;
    
    // 1. Keyword search in D1 (fast, exact matches)
    const keywordResults = await this.keywordSearch(query, limit);
    
    // 2. Semantic search in Vectorize (understanding, related concepts)
    const semanticResults = await this.semanticSearch(query, limit);
    
    // 3. Merge and rank results
    const mergedResults = this.mergeResults(keywordResults, semanticResults, limit);
    
    return mergedResults;
  }
  
  /**
   * Keyword search using D1 full-text search
   */
  private async keywordSearch(
    query: SearchQuery,
    limit: number
  ): Promise<SearchResult[]> {
    let sql = `
      SELECT 
        g.id as guide_id,
        g.title,
        g.category,
        g.tags,
        s.id as section_id,
        s.title as section_title,
        snippet(guides_fts, 2, '<mark>', '</mark>', '...', 32) as excerpt,
        rank as relevance_score
      FROM guides_fts
      JOIN guides g ON guides_fts.guide_id = g.id
      JOIN sections s ON s.guide_id = g.id
      WHERE guides_fts MATCH ?
    `;
    
    const params: any[] = [query.query];
    
    // Add filters
    if (query.category) {
      sql += ` AND g.category LIKE ?`;
      params.push(`%${query.category}%`);
    }
    
    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags.map(() => `g.tags LIKE ?`).join(' OR ');
      sql += ` AND (${tagConditions})`;
      params.push(...query.tags.map(tag => `%${tag}%`));
    }
    
    sql += ` ORDER BY rank LIMIT ?`;
    params.push(limit);
    
    const results = await this.db.prepare(sql).bind(...params).all();
    
    return results.results.map((row: any) => ({
      guideId: row.guide_id,
      sectionId: row.section_id,
      title: `${row.title} - ${row.section_title}`,
      excerpt: row.excerpt,
      relevanceScore: Math.abs(row.relevance_score), // FTS5 rank is negative
      metadata: {
        category: row.category,
        tags: row.tags.split(',')
      },
      url: `https://claude.ai/guide/${row.guide_id}#${row.section_id}`
    }));
  }
  
  /**
   * Semantic search using Vectorize
   */
  private async semanticSearch(
    query: SearchQuery,
    limit: number
  ): Promise<SearchResult[]> {
    // Build filter for Vectorize
    const filter: any = {};
    
    if (query.category) {
      filter.category = query.category;
    }
    
    if (query.framework) {
      filter.framework = query.framework;
    }
    
    if (query.language) {
      filter.language = query.language;
    }
    
    // Query Vectorize
    const results = await this.vectorize.query(query.query, {
      topK: limit,
      namespace: 'guides',
      filter,
      returnMetadata: 'all'
    });
    
    return results.matches.map(match => ({
      guideId: match.metadata.guideId as string,
      sectionId: match.metadata.sectionId as string,
      title: match.id,
      excerpt: (match.metadata.text as string)?.substring(0, 200) || '',
      relevanceScore: match.score,
      metadata: {
        category: match.metadata.category as string,
        framework: match.metadata.framework as string | undefined,
        language: match.metadata.language as string | undefined,
        tags: (match.metadata.tags as string)?.split(',') || []
      },
      url: `https://claude.ai/guide/${match.metadata.guideId}#${match.metadata.sectionId}`
    }));
  }
  
  /**
   * Merge and deduplicate results from different search methods
   */
  private mergeResults(
    keywordResults: SearchResult[],
    semanticResults: SearchResult[],
    limit: number
  ): SearchResult[] {
    const seen = new Set<string>();
    const merged: SearchResult[] = [];
    
    // Interleave results, preferring keyword matches slightly
    const allResults = [
      ...keywordResults.map(r => ({ ...r, source: 'keyword' as const })),
      ...semanticResults.map(r => ({ ...r, source: 'semantic' as const }))
    ].sort((a, b) => {
      // Keyword matches get slight boost
      const aScore = a.relevanceScore * (a.source === 'keyword' ? 1.1 : 1.0);
      const bScore = b.relevanceScore * (b.source === 'keyword' ? 1.1 : 1.0);
      return bScore - aScore;
    });
    
    for (const result of allResults) {
      const key = `${result.guideId}-${result.sectionId}`;
      
      if (!seen.has(key) && merged.length < limit) {
        seen.add(key);
        merged.push(result);
      }
    }
    
    return merged;
  }
  
  /**
   * Get complete guide by ID
   */
  async getGuide(guideId: string, sectionId?: string): Promise<Guide | null> {
    // Get metadata from D1
    const metadata = await this.db.prepare(
      'SELECT * FROM guides WHERE id = ?'
    ).bind(guideId).first();
    
    if (!metadata) return null;
    
    // Get sections
    let sectionsQuery = 'SELECT * FROM sections WHERE guide_id = ?';
    const params = [guideId];
    
    if (sectionId) {
      sectionsQuery += ' AND id = ?';
      params.push(sectionId);
    }
    
    const sections = await this.db.prepare(sectionsQuery)
      .bind(...params)
      .all();
    
    // Get markdown from R2
    const markdownKey = metadata.markdown_url as string;
    const markdownObj = await this.r2.get(markdownKey);
    const markdown = markdownObj ? await markdownObj.text() : '';
    
    return {
      id: metadata.id as string,
      title: metadata.title as string,
      category: metadata.category as string,
      sections: sections.results.map((s: any) => ({
        id: s.id,
        title: s.title,
        content: s.content,
        codeExamples: [] // Would need to join with code_examples
      })),
      relatedGuides: (metadata.related_guides as string)?.split(',') || [],
      markdown
    };
  }
  
  /**
   * List all guides with optional filtering
   */
  async listGuides(filters?: {
    category?: string;
    status?: string;
  }): Promise<Array<{
    id: string;
    title: string;
    category: string;
    status: string;
  }>> {
    let sql = 'SELECT id, title, category, status FROM guides WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.category) {
      sql += ' AND category LIKE ?';
      params.push(`%${filters.category}%`);
    }
    
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    
    sql += ' ORDER BY category, title';
    
    const results = await this.db.prepare(sql).bind(...params).all();
    
    return results.results.map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      status: row.status
    }));
  }
}

// ============================================================================
// MCP Server Implementation
// ============================================================================

const app = new Hono<{ Bindings: Env }>();

// Initialize search service
function getSearchService(env: Env): GuideSearchService {
  return new GuideSearchService(env.DB, env.VECTORIZE, env.GUIDES_BUCKET);
}

/**
 * MCP Tool: Search Developer Guides
 */
app.post('/tools/search_developer_guides', async (c) => {
  const body = await c.req.json();
  const searchService = getSearchService(c.env);
  
  const results = await searchService.search({
    query: body.query,
    category: body.category,
    framework: body.framework,
    language: body.language,
    tags: body.tags,
    limit: body.limit || 5
  });
  
  return c.json({
    results,
    total: results.length
  });
});

/**
 * MCP Tool: Get Guide
 */
app.post('/tools/get_guide', async (c) => {
  const body = await c.req.json();
  const searchService = getSearchService(c.env);
  
  const guide = await searchService.getGuide(body.guideId, body.sectionId);
  
  if (!guide) {
    return c.json({ error: 'Guide not found' }, 404);
  }
  
  return c.json(guide);
});

/**
 * MCP Tool: List Guides
 */
app.post('/tools/list_guides', async (c) => {
  const body = await c.req.json();
  const searchService = getSearchService(c.env);
  
  const guides = await searchService.listGuides({
    category: body.category,
    status: body.status
  });
  
  return c.json({
    guides,
    total: guides.length
  });
});

/**
 * MCP Tool: Get Related Guides
 */
app.post('/tools/get_related_guides', async (c) => {
  const body = await c.req.json();
  const searchService = getSearchService(c.env);
  
  const guide = await searchService.getGuide(body.guideId);
  
  if (!guide) {
    return c.json({ error: 'Guide not found' }, 404);
  }
  
  // Get related guides
  const relatedPromises = guide.relatedGuides.map(id =>
    searchService.getGuide(id)
  );
  
  const related = (await Promise.all(relatedPromises))
    .filter(g => g !== null)
    .map(g => ({
      id: g!.id,
      title: g!.title,
      category: g!.category
    }));
  
  return c.json({
    guideId: body.guideId,
    relatedGuides: related
  });
});

/**
 * MCP Tool: Propose Guide Change
 */
app.post('/tools/propose_guide_change', async (c) => {
  const body = await c.req.json();
  
  // Store change proposal in D1
  await c.env.DB.prepare(`
    INSERT INTO change_proposals (
      id, guide_id, section, current_text, proposed_text, rationale,
      proposed_by, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `).bind(
    crypto.randomUUID(),
    body.guideId,
    body.section,
    body.currentText,
    body.proposedText,
    body.rationale,
    body.proposedBy || 'anonymous'
  ).run();
  
  return c.json({
    message: 'Change proposal submitted for review',
    status: 'pending'
  });
});

/**
 * Health check
 */
app.get('/health', async (c) => {
  // Check all dependencies
  const checks = await Promise.allSettled([
    c.env.DB.prepare('SELECT 1').first(),
    c.env.GUIDES_BUCKET.head('test'),
    // Vectorize health check would go here
  ]);
  
  const [db, r2] = checks;
  
  return c.json({
    status: 'healthy',
    services: {
      database: db.status === 'fulfilled' ? 'ok' : 'error',
      storage: r2.status === 'fulfilled' ? 'ok' : 'error',
      vectorize: 'ok' // Would check actual status
    }
  });
});

export default app;

// ============================================================================
// Additional Schema for Change Proposals
// ============================================================================

export const CHANGE_PROPOSALS_SCHEMA = `
CREATE TABLE IF NOT EXISTS change_proposals (
  id TEXT PRIMARY KEY,
  guide_id TEXT NOT NULL,
  section TEXT NOT NULL,
  current_text TEXT NOT NULL,
  proposed_text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  proposed_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  review_notes TEXT,
  created_at DATETIME NOT NULL,
  reviewed_at DATETIME,
  FOREIGN KEY (guide_id) REFERENCES guides(id)
);

CREATE INDEX idx_proposals_status ON change_proposals(status);
CREATE INDEX idx_proposals_guide_id ON change_proposals(guide_id);
`;
