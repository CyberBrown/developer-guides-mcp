import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

type Bindings = {
  DB: D1Database;
  GUIDES_BUCKET: R2Bucket;
  VECTORIZE: Vectorize;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for MCP clients
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString()
  });
});

// MCP Tool: Search developer guides
app.post('/tools/search_developer_guides', async (c) => {
  try {
    const { query, category, framework, tags, limit = 5 } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }

    // Use FTS5 for full-text search
    let sql = `
      SELECT
        g.id,
        g.title,
        g.category,
        g.subcategory,
        g.type,
        g.status,
        g.version,
        g.last_updated,
        g.tags,
        g.related_guides,
        g.markdown_url,
        snippet(guides_fts, 2, '<mark>', '</mark>', '...', 64) as snippet
      FROM guides_fts
      JOIN guides g ON guides_fts.guide_id = g.id
      WHERE guides_fts MATCH ?
    `;

    const params: any[] = [query];

    // Add filters
    if (category) {
      sql += ` AND g.category LIKE ?`;
      params.push(`%${category}%`);
    }

    if (tags && Array.isArray(tags)) {
      const tagConditions = tags.map(() => `g.tags LIKE ?`).join(' OR ');
      sql += ` AND (${tagConditions})`;
      tags.forEach(tag => params.push(`%${tag}%`));
    }

    sql += ` ORDER BY rank LIMIT ?`;
    params.push(limit);

    const results = await c.env.DB.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      query,
      count: results.results?.length || 0,
      guides: results.results?.map((row: any) => ({
        ...row,
        tags: JSON.parse(row.tags || '[]'),
        related_guides: row.related_guides ? JSON.parse(row.related_guides) : []
      }))
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// MCP Tool: Get guide by ID
app.post('/tools/get_guide', async (c) => {
  try {
    const { guideId, sectionId } = await c.req.json();

    if (!guideId) {
      return c.json({ error: 'guideId parameter is required' }, 400);
    }

    // Get guide metadata
    const guide = await c.env.DB.prepare(`
      SELECT * FROM guides WHERE id = ?
    `).bind(guideId).first();

    if (!guide) {
      return c.json({ error: 'Guide not found' }, 404);
    }

    // Get sections
    let sectionsQuery = `
      SELECT * FROM sections WHERE guide_id = ?
    `;
    const sectionParams: any[] = [guideId];

    if (sectionId) {
      sectionsQuery += ` AND id = ?`;
      sectionParams.push(sectionId);
    }

    sectionsQuery += ` ORDER BY start_line ASC`;

    const sections = await c.env.DB.prepare(sectionsQuery)
      .bind(...sectionParams)
      .all();

    // Get markdown from R2
    const markdownKey = (guide as any).markdown_url;
    const markdownObject = await c.env.GUIDES_BUCKET.get(markdownKey);
    const markdown = markdownObject ? await markdownObject.text() : null;

    return c.json({
      success: true,
      guide: {
        ...(guide as any),
        tags: JSON.parse((guide as any).tags || '[]'),
        related_guides: (guide as any).related_guides ? JSON.parse((guide as any).related_guides) : []
      },
      sections: sections.results,
      markdown: sectionId ? null : markdown
    });
  } catch (error: any) {
    console.error('Get guide error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// MCP Tool: List all guides
app.post('/tools/list_guides', async (c) => {
  try {
    const { category, status } = await c.req.json();

    let sql = `SELECT * FROM guides WHERE 1=1`;
    const params: any[] = [];

    if (category) {
      sql += ` AND category LIKE ?`;
      params.push(`%${category}%`);
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY category, title`;

    const results = await c.env.DB.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      count: results.results?.length || 0,
      guides: results.results?.map((row: any) => ({
        ...row,
        tags: JSON.parse(row.tags || '[]'),
        related_guides: row.related_guides ? JSON.parse(row.related_guides) : []
      }))
    });
  } catch (error: any) {
    console.error('List guides error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// MCP Tool: Get related guides
app.post('/tools/get_related_guides', async (c) => {
  try {
    const { guideId } = await c.req.json();

    if (!guideId) {
      return c.json({ error: 'guideId parameter is required' }, 400);
    }

    const guide = await c.env.DB.prepare(`
      SELECT related_guides FROM guides WHERE id = ?
    `).bind(guideId).first();

    if (!guide) {
      return c.json({ error: 'Guide not found' }, 404);
    }

    const relatedIds = (guide as any).related_guides
      ? JSON.parse((guide as any).related_guides)
      : [];

    if (relatedIds.length === 0) {
      return c.json({
        success: true,
        count: 0,
        guides: []
      });
    }

    const placeholders = relatedIds.map(() => '?').join(',');
    const sql = `
      SELECT * FROM guides
      WHERE id IN (${placeholders})
    `;

    const results = await c.env.DB.prepare(sql).bind(...relatedIds).all();

    return c.json({
      success: true,
      count: results.results?.length || 0,
      guides: results.results?.map((row: any) => ({
        ...row,
        tags: JSON.parse(row.tags || '[]'),
        related_guides: row.related_guides ? JSON.parse(row.related_guides) : []
      }))
    });
  } catch (error: any) {
    console.error('Get related guides error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// MCP Tool: Propose guide change
app.post('/tools/propose_guide_change', async (c) => {
  try {
    const {
      guideId,
      section,
      currentText,
      proposedText,
      rationale,
      proposedBy = 'claude-code-cli'
    } = await c.req.json();

    if (!guideId || !section || !currentText || !proposedText || !rationale) {
      return c.json({
        error: 'Missing required fields: guideId, section, currentText, proposedText, rationale'
      }, 400);
    }

    // Verify guide exists
    const guide = await c.env.DB.prepare(`
      SELECT id FROM guides WHERE id = ?
    `).bind(guideId).first();

    if (!guide) {
      return c.json({ error: 'Guide not found' }, 404);
    }

    // Create proposal
    const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await c.env.DB.prepare(`
      INSERT INTO change_proposals (
        id, guide_id, section, current_text, proposed_text,
        rationale, proposed_by, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(
      proposalId,
      guideId,
      section,
      currentText,
      proposedText,
      rationale,
      proposedBy,
      new Date().toISOString()
    ).run();

    return c.json({
      success: true,
      proposalId,
      message: 'Change proposal created successfully'
    });
  } catch (error: any) {
    console.error('Propose change error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// MCP Tool: Get guide statistics
app.post('/tools/get_guide_stats', async (c) => {
  try {
    const stats = await c.env.DB.batch([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM guides'),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM sections'),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM change_proposals'),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM change_proposals WHERE status = "pending"'),
      c.env.DB.prepare('SELECT category, COUNT(*) as count FROM guides GROUP BY category')
    ]);

    return c.json({
      success: true,
      stats: {
        total_guides: stats[0].results[0],
        total_sections: stats[1].results[0],
        total_proposals: stats[2].results[0],
        pending_proposals: stats[3].results[0],
        guides_by_category: stats[4].results
      }
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// MCP Tool Discovery - List available tools
app.get('/tools', (c) => {
  return c.json({
    tools: [
      {
        name: 'search_developer_guides',
        description: 'Search developer guidelines by keyword, category, framework, or tag using full-text search',
        parameters: {
          query: { type: 'string', required: true, description: 'Search query' },
          category: { type: 'string', required: false, description: 'Filter by category' },
          framework: { type: 'string', required: false, description: 'Filter by framework (qwik, react, cloudflare-workers)' },
          tags: { type: 'array', required: false, description: 'Filter by tags' },
          limit: { type: 'number', required: false, default: 5, description: 'Maximum results to return' }
        }
      },
      {
        name: 'get_guide',
        description: 'Retrieve complete guide or specific section by ID',
        parameters: {
          guideId: { type: 'string', required: true, description: 'Guide identifier' },
          sectionId: { type: 'string', required: false, description: 'Optional section identifier' }
        }
      },
      {
        name: 'list_guides',
        description: 'List all available guides with optional filters',
        parameters: {
          category: { type: 'string', required: false, description: 'Filter by category' },
          status: { type: 'string', required: false, description: 'Filter by status (finalized, draft, review)' }
        }
      },
      {
        name: 'get_related_guides',
        description: 'Find guides related to a specific guide',
        parameters: {
          guideId: { type: 'string', required: true, description: 'Guide identifier' }
        }
      },
      {
        name: 'propose_guide_change',
        description: 'Propose a change to a guide section for review',
        parameters: {
          guideId: { type: 'string', required: true, description: 'Guide identifier' },
          section: { type: 'string', required: true, description: 'Section name or identifier' },
          currentText: { type: 'string', required: true, description: 'Current text to be changed' },
          proposedText: { type: 'string', required: true, description: 'Proposed replacement text' },
          rationale: { type: 'string', required: true, description: 'Explanation for the change' },
          proposedBy: { type: 'string', required: false, default: 'claude-code-cli', description: 'Who is proposing the change' }
        }
      },
      {
        name: 'get_guide_stats',
        description: 'Get statistics about the developer guides system',
        parameters: {}
      }
    ]
  });
});

// Factory function to create MCP server with bindings
function createMcpServerWithBindings(env: Bindings) {
  const server = new McpServer(
    {
      name: 'developer-guides-mcp',
      version: '1.0.0',
    },
    { capabilities: { logging: {} } }
  );

  // Register tool: search_developer_guides
  server.tool(
    'search_developer_guides',
    'Search developer guidelines by keyword, category, framework, or tag using full-text search',
    {
      query: z.string().describe('Search query'),
      category: z.string().optional().describe('Filter by category'),
      framework: z.string().optional().describe('Filter by framework (qwik, react, cloudflare-workers)'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
      limit: z.number().optional().default(5).describe('Maximum results to return')
    },
    async ({ query, category, framework, tags, limit }): Promise<CallToolResult> => {
      try {
        let sql = `
          SELECT
            g.id,
            g.title,
            g.category,
            g.subcategory,
            g.type,
            g.status,
            g.version,
            g.last_updated,
            g.tags,
            g.related_guides,
            g.markdown_url,
            snippet(guides_fts, 2, '<mark>', '</mark>', '...', 64) as snippet
          FROM guides_fts
          JOIN guides g ON guides_fts.guide_id = g.id
          WHERE guides_fts MATCH ?
        `;

        const params: any[] = [query];

        if (category) {
          sql += ` AND g.category LIKE ?`;
          params.push(`%${category}%`);
        }

        if (tags && Array.isArray(tags)) {
          const tagConditions = tags.map(() => `g.tags LIKE ?`).join(' OR ');
          sql += ` AND (${tagConditions})`;
          tags.forEach(tag => params.push(`%${tag}%`));
        }

        sql += ` ORDER BY rank LIMIT ?`;
        params.push(limit);

        const results = await env.DB.prepare(sql).bind(...params).all();

        const guides = results.results?.map((row: any) => ({
          ...row,
          tags: JSON.parse(row.tags || '[]'),
          related_guides: row.related_guides ? JSON.parse(row.related_guides) : []
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                query,
                count: guides?.length || 0,
                guides
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // Register tool: get_guide
  server.tool(
    'get_guide',
    'Retrieve complete guide or specific section by ID',
    {
      guideId: z.string().describe('Guide identifier'),
      sectionId: z.string().optional().describe('Optional section identifier')
    },
    async ({ guideId, sectionId }): Promise<CallToolResult> => {
      try {
        const guide = await env.DB.prepare(`
          SELECT * FROM guides WHERE id = ?
        `).bind(guideId).first();

        if (!guide) {
          return {
            content: [{ type: 'text', text: 'Guide not found' }],
            isError: true
          };
        }

        let sectionsQuery = `
          SELECT * FROM sections WHERE guide_id = ?
        `;
        const sectionParams: any[] = [guideId];

        if (sectionId) {
          sectionsQuery += ` AND id = ?`;
          sectionParams.push(sectionId);
        }

        sectionsQuery += ` ORDER BY start_line ASC`;

        const sections = await env.DB.prepare(sectionsQuery)
          .bind(...sectionParams)
          .all();

        const markdownKey = (guide as any).markdown_url;
        const markdownObject = await env.GUIDES_BUCKET.get(markdownKey);
        const markdown = markdownObject ? await markdownObject.text() : null;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                guide: {
                  ...(guide as any),
                  tags: JSON.parse((guide as any).tags || '[]'),
                  related_guides: (guide as any).related_guides ? JSON.parse((guide as any).related_guides) : []
                },
                sections: sections.results,
                markdown: sectionId ? null : markdown
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Register tool: list_guides
  server.tool(
    'list_guides',
    'List all available guides with optional filters',
    {
      category: z.string().optional().describe('Filter by category'),
      status: z.string().optional().describe('Filter by status (finalized, draft, review)')
    },
    async ({ category, status }): Promise<CallToolResult> => {
      try {
        let sql = `SELECT * FROM guides WHERE 1=1`;
        const params: any[] = [];

        if (category) {
          sql += ` AND category LIKE ?`;
          params.push(`%${category}%`);
        }

        if (status) {
          sql += ` AND status = ?`;
          params.push(status);
        }

        sql += ` ORDER BY category, title`;

        const results = await env.DB.prepare(sql).bind(...params).all();

        const guides = results.results?.map((row: any) => ({
          ...row,
          tags: JSON.parse(row.tags || '[]'),
          related_guides: row.related_guides ? JSON.parse(row.related_guides) : []
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: guides?.length || 0,
                guides
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Register tool: get_related_guides
  server.tool(
    'get_related_guides',
    'Find guides related to a specific guide',
    {
      guideId: z.string().describe('Guide identifier')
    },
    async ({ guideId }): Promise<CallToolResult> => {
      try {
        const guide = await env.DB.prepare(`
          SELECT related_guides FROM guides WHERE id = ?
        `).bind(guideId).first();

        if (!guide) {
          return {
            content: [{ type: 'text', text: 'Guide not found' }],
            isError: true
          };
        }

        const relatedIds = (guide as any).related_guides
          ? JSON.parse((guide as any).related_guides)
          : [];

        if (relatedIds.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  count: 0,
                  guides: []
                }, null, 2)
              }
            ]
          };
        }

        const placeholders = relatedIds.map(() => '?').join(',');
        const sql = `
          SELECT * FROM guides
          WHERE id IN (${placeholders})
        `;

        const results = await env.DB.prepare(sql).bind(...relatedIds).all();

        const guides = results.results?.map((row: any) => ({
          ...row,
          tags: JSON.parse(row.tags || '[]'),
          related_guides: row.related_guides ? JSON.parse(row.related_guides) : []
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: guides?.length || 0,
                guides
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Register tool: propose_guide_change
  server.tool(
    'propose_guide_change',
    'Propose a change to a guide section for review',
    {
      guideId: z.string().describe('Guide identifier'),
      section: z.string().describe('Section name or identifier'),
      currentText: z.string().describe('Current text to be changed'),
      proposedText: z.string().describe('Proposed replacement text'),
      rationale: z.string().describe('Explanation for the change'),
      proposedBy: z.string().optional().default('claude-code-cli').describe('Who is proposing the change')
    },
    async ({ guideId, section, currentText, proposedText, rationale, proposedBy }): Promise<CallToolResult> => {
      try {
        const guide = await env.DB.prepare(`
          SELECT id FROM guides WHERE id = ?
        `).bind(guideId).first();

        if (!guide) {
          return {
            content: [{ type: 'text', text: 'Guide not found' }],
            isError: true
          };
        }

        const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        await env.DB.prepare(`
          INSERT INTO change_proposals (
            id, guide_id, section, current_text, proposed_text,
            rationale, proposed_by, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `).bind(
          proposalId,
          guideId,
          section,
          currentText,
          proposedText,
          rationale,
          proposedBy,
          new Date().toISOString()
        ).run();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                proposalId,
                message: 'Change proposal created successfully'
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // Register tool: get_guide_stats
  server.tool(
    'get_guide_stats',
    'Get statistics about the developer guides system',
    {},
    async (): Promise<CallToolResult> => {
      try {
        const stats = await env.DB.batch([
          env.DB.prepare('SELECT COUNT(*) as count FROM guides'),
          env.DB.prepare('SELECT COUNT(*) as count FROM sections'),
          env.DB.prepare('SELECT COUNT(*) as count FROM change_proposals'),
          env.DB.prepare('SELECT COUNT(*) as count FROM change_proposals WHERE status = "pending"'),
          env.DB.prepare('SELECT category, COUNT(*) as count FROM guides GROUP BY category')
        ]);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                stats: {
                  total_guides: stats[0].results[0],
                  total_sections: stats[1].results[0],
                  total_proposals: stats[2].results[0],
                  pending_proposals: stats[3].results[0],
                  guides_by_category: stats[4].results
                }
              }, null, 2)
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  return server;
}

// MCP Endpoint - Using Cloudflare Agents SDK
app.all('/mcp', async (c) => {
  const server = createMcpServerWithBindings(c.env);
  const handler = createMcpHandler(server);
  return handler(c.req.raw, c.env, c.executionCtx);
});

// Default route
app.get('/', (c) => {
  return c.json({
    name: 'Developer Guides MCP Server',
    version: '1.0.0',
    description: 'MCP server for querying and managing developer guidelines',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      tools: '/tools',
      search: '/tools/search_developer_guides',
      get_guide: '/tools/get_guide',
      list_guides: '/tools/list_guides',
      related_guides: '/tools/get_related_guides',
      propose_change: '/tools/propose_guide_change',
      stats: '/tools/get_guide_stats'
    }
  });
});

export default app;
