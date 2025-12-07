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

// Helper: Sanitize FTS5 query to handle special characters
function sanitizeFtsQuery(query: string): string {
  // FTS5 treats - as NOT operator, so we need to quote terms with hyphens
  // Also handle other special characters: AND, OR, NOT, (, ), *, "
  // Split into words and quote each term that contains special chars
  return query
    .split(/\s+/)
    .map(term => {
      // If term contains special FTS5 characters, wrap in quotes
      if (/[-*()"]/.test(term) || /^(AND|OR|NOT)$/i.test(term)) {
        return `"${term.replace(/"/g, '""')}"`;
      }
      return term;
    })
    .join(' ');
}

// MCP Tool: Search developer guides
app.post('/tools/search_developer_guides', async (c) => {
  try {
    const { query, category, framework, tags, limit = 5 } = await c.req.json();

    if (!query) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }

    // Sanitize query for FTS5
    const sanitizedQuery = sanitizeFtsQuery(query);

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

    const params: any[] = [sanitizedQuery];

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

// HTTP Endpoint: Get available services
app.post('/tools/get_available_services', async (c) => {
  try {
    const { category, status, search, include_capabilities } = await c.req.json();

    let sql = `
      SELECT s.*,
             GROUP_CONCAT(DISTINCT sp.provider_name) as providers
      FROM services s
      LEFT JOIN service_providers sp ON s.id = sp.service_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category) {
      sql += ` AND s.category = ?`;
      params.push(category);
    }

    if (status) {
      sql += ` AND s.status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (s.name LIKE ? OR s.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` GROUP BY s.id ORDER BY s.category, s.name`;

    const servicesResult = await c.env.DB.prepare(sql).bind(...params).all();
    const services = servicesResult.results || [];

    if (include_capabilities && services.length > 0) {
      for (const service of services as any[]) {
        const caps = await c.env.DB.prepare(
          `SELECT capability, description, input_schema, output_schema FROM service_capabilities WHERE service_id = ?`
        ).bind(service.id).all();
        service.capabilities = caps.results || [];

        const deps = await c.env.DB.prepare(
          `SELECT depends_on_service_id, dependency_type FROM service_dependencies WHERE service_id = ?`
        ).bind(service.id).all();
        service.dependencies = deps.results || [];
      }
    }

    return c.json({
      success: true,
      count: services.length,
      services: services.map((s: any) => ({
        ...s,
        providers: s.providers ? s.providers.split(',') : []
      }))
    });
  } catch (error: any) {
    console.error('Get services error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Webhook: Sync service registry from DE deployments
app.post('/api/sync-registry', async (c) => {
  try {
    // Verify auth token (set REGISTRY_SYNC_TOKEN as a secret)
    const authHeader = c.req.header('Authorization');
    const expectedToken = (c.env as any).REGISTRY_SYNC_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { source, commit, services } = body;

    let servicesAdded = 0;
    let servicesUpdated = 0;

    // If services manifest is provided, sync them
    if (services && Array.isArray(services)) {
      for (const service of services) {
        // Check if service exists
        const existing = await c.env.DB.prepare(
          'SELECT id FROM services WHERE id = ?'
        ).bind(service.id).first();

        if (existing) {
          // Update existing service
          await c.env.DB.prepare(`
            UPDATE services SET
              name = ?, description = ?, category = ?, status = ?,
              de_worker_name = ?, updated_at = datetime('now')
            WHERE id = ?
          `).bind(
            service.name,
            service.description || null,
            service.category,
            service.status || 'active',
            service.worker || null,
            service.id
          ).run();
          servicesUpdated++;
        } else {
          // Insert new service
          await c.env.DB.prepare(`
            INSERT INTO services (id, name, description, category, status, de_worker_name)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            service.id,
            service.name,
            service.description || null,
            service.category,
            service.status || 'active',
            service.worker || null
          ).run();
          servicesAdded++;
        }

        // Sync capabilities if provided
        if (service.capabilities && Array.isArray(service.capabilities)) {
          // Clear existing capabilities
          await c.env.DB.prepare(
            'DELETE FROM service_capabilities WHERE service_id = ?'
          ).bind(service.id).run();

          // Insert new capabilities
          for (const cap of service.capabilities) {
            const capName = typeof cap === 'string' ? cap : cap.capability;
            const capDesc = typeof cap === 'string' ? null : cap.description;
            await c.env.DB.prepare(`
              INSERT INTO service_capabilities (service_id, capability, description)
              VALUES (?, ?, ?)
            `).bind(service.id, capName, capDesc).run();
          }
        }

        // Sync providers if provided
        if (service.providers && Array.isArray(service.providers)) {
          await c.env.DB.prepare(
            'DELETE FROM service_providers WHERE service_id = ?'
          ).bind(service.id).run();

          for (const provider of service.providers) {
            await c.env.DB.prepare(`
              INSERT INTO service_providers (service_id, provider_name, requires_api_key)
              VALUES (?, ?, 1)
            `).bind(service.id, provider).run();
          }
        }
      }
    }

    // Log the sync
    await c.env.DB.prepare(`
      INSERT INTO registry_sync_log (source, commit_sha, synced_at, services_added, services_updated)
      VALUES (?, ?, datetime('now'), ?, ?)
    `).bind(
      source || 'api',
      commit || null,
      servicesAdded,
      servicesUpdated
    ).run();

    return c.json({
      success: true,
      synced_at: new Date().toISOString(),
      services_added: servicesAdded,
      services_updated: servicesUpdated
    });
  } catch (error: any) {
    console.error('Registry sync error:', error);
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
      },
      {
        name: 'initialize_claude_md',
        description: 'Get the CLAUDE.md setup template and version info. Call this first when starting a new session.',
        parameters: {
          currentVersion: { type: 'string', required: false, description: 'The version from your current CLAUDE.md (e.g., "1.1.0")' }
        }
      },
      {
        name: 'get_available_services',
        description: 'Query the DE service registry to discover available backend services',
        parameters: {
          category: { type: 'string', required: false, enum: ['llm', 'storage', 'voice', 'image', 'utility', 'auth', 'memory'], description: 'Filter by category' },
          status: { type: 'string', required: false, enum: ['active', 'beta', 'deprecated', 'planned'], description: 'Filter by status' },
          search: { type: 'string', required: false, description: 'Search term' },
          include_capabilities: { type: 'boolean', required: false, default: false, description: 'Include detailed capabilities' }
        }
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
        // Sanitize query for FTS5 (handle hyphens, special chars)
        const sanitizedQuery = sanitizeFtsQuery(query);

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

        const params: any[] = [sanitizedQuery];

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

  // Register tool: initialize_claude_md
  server.tool(
    'initialize_claude_md',
    'Get the CLAUDE.md setup template and version info. Call this first when starting a new session to ensure CLAUDE.md is configured correctly.',
    {
      currentVersion: z.string().optional().describe('The version string from your current CLAUDE.md (if any), e.g., "1.1.0"')
    },
    async ({ currentVersion }): Promise<CallToolResult> => {
      const LATEST_VERSION = '1.1.0';

      const template = `<!-- Developer Guides MCP Setup v${LATEST_VERSION} - Check for updates: docs/CLAUDE-MD-SETUP.md -->
## Developer Guidelines (MCP Server)

### Required: Check Before Implementing

ALWAYS search the developer guides before:
- Writing new functions or modules
- Implementing error handling
- Adding validation logic
- Creating API endpoints
- Writing database queries
- Adding authentication or security features

This is not optional - established patterns must be followed for consistency and security.

### Quick Reference

| Task | Search Query |
|------|-------------|
| Input validation | \`query="zod validation"\` |
| Error handling | \`query="error classes"\` |
| API security | \`query="authentication middleware"\` |
| Database queries | \`query="parameterized queries"\` |
| Testing patterns | \`query="unit test"\` |
| Logging/monitoring | \`query="observability"\` |

### How to Access

Search by topic:
\`\`\`
mcp__developer-guides__search_developer_guides query="validation"
\`\`\`

Get specific guide:
\`\`\`
mcp__developer-guides__get_guide guideId="guide-07-security"
mcp__developer-guides__get_guide guideId="guide-01-fundamentals"
\`\`\`

List all available guides:
\`\`\`
mcp__developer-guides__list_guides
\`\`\`

### Available Guides

| Guide | Use For |
|-------|---------|
| \`guide-01-fundamentals\` | Code organization, naming, error handling, types |
| \`guide-02-11-arch-devops\` | Architecture patterns, CI/CD, deployment |
| \`guide-05-10-db-perf\` | Database schemas, queries, performance |
| \`guide-07-security\` | Validation, auth, secrets, CORS, rate limiting |
| \`guide-09-testing\` | Unit, integration, E2E testing patterns |
| \`Cloudflare-Workers-Guide\` | Cloudflare Workers patterns, bindings, KV, D1 |
| \`Frontend-Development-Guide\` | Frontend patterns, components, state management |
| \`AI and Observability-Guide\` | AI integration, logging, monitoring, tracing |

### Key Patterns to Follow
- Use Zod schemas for all input validation
- Use custom error classes (\`AppError\`, \`ValidationError\`, \`NotFoundError\`)
- Never concatenate SQL queries - use parameterized queries
- Store secrets in environment variables, never in code

### Improving the Guides

If you find gaps, outdated patterns, or better approaches while working:
\`\`\`
mcp__developer-guides__propose_guide_change guideId="guide-07-security" section="Authentication" currentText="..." proposedText="..." rationale="Found a better pattern for..."
\`\`\`
Proposals help keep the guides current and comprehensive.`;

      const isUpToDate = currentVersion === LATEST_VERSION;
      const needsUpdate = currentVersion && currentVersion !== LATEST_VERSION;
      const needsCreation = !currentVersion;

      let action: string;
      if (isUpToDate) {
        action = 'none';
      } else if (needsUpdate) {
        action = 'update';
      } else {
        action = 'create';
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              latestVersion: LATEST_VERSION,
              currentVersion: currentVersion || null,
              action,
              instructions: action === 'none'
                ? 'CLAUDE.md is up to date. No action needed.'
                : action === 'update'
                ? `CLAUDE.md is outdated (${currentVersion} -> ${LATEST_VERSION}). Replace the "Developer Guidelines (MCP Server)" section with the template below.`
                : 'CLAUDE.md does not have the Developer Guidelines section. Add the template below to your project\'s CLAUDE.md file.',
              template: action === 'none' ? null : template
            }, null, 2)
          }
        ]
      };
    }
  );

  // Register tool: get_available_services
  server.tool(
    'get_available_services',
    'Query the service registry to discover what DE (Distributed Electrons) services are available. Use this to understand what backend capabilities exist before building new features.',
    {
      category: z.enum(['llm', 'storage', 'voice', 'image', 'utility', 'auth', 'memory']).optional().describe('Filter by service category'),
      status: z.enum(['active', 'beta', 'deprecated', 'planned']).optional().describe('Filter by service status'),
      search: z.string().optional().describe('Search term to match against name/description'),
      include_capabilities: z.boolean().optional().default(false).describe('Include detailed capabilities for each service')
    },
    async ({ category, status, search, include_capabilities }): Promise<CallToolResult> => {
      try {
        let sql = `
          SELECT s.*,
                 GROUP_CONCAT(DISTINCT sp.provider_name) as providers
          FROM services s
          LEFT JOIN service_providers sp ON s.id = sp.service_id
          WHERE 1=1
        `;
        const params: any[] = [];

        if (category) {
          sql += ` AND s.category = ?`;
          params.push(category);
        }

        if (status) {
          sql += ` AND s.status = ?`;
          params.push(status);
        }

        if (search) {
          sql += ` AND (s.name LIKE ? OR s.description LIKE ?)`;
          params.push(`%${search}%`, `%${search}%`);
        }

        sql += ` GROUP BY s.id ORDER BY s.category, s.name`;

        const servicesResult = await env.DB.prepare(sql).bind(...params).all();
        const services = servicesResult.results || [];

        // Optionally fetch capabilities
        if (include_capabilities && services.length > 0) {
          for (const service of services as any[]) {
            const caps = await env.DB.prepare(
              `SELECT capability, description, input_schema, output_schema FROM service_capabilities WHERE service_id = ?`
            ).bind(service.id).all();
            service.capabilities = caps.results || [];
          }
        }

        // Also fetch dependencies if capabilities are requested
        if (include_capabilities && services.length > 0) {
          for (const service of services as any[]) {
            const deps = await env.DB.prepare(
              `SELECT depends_on_service_id, dependency_type FROM service_dependencies WHERE service_id = ?`
            ).bind(service.id).all();
            service.dependencies = deps.results || [];
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: services.length,
                services: services.map((s: any) => ({
                  ...s,
                  providers: s.providers ? s.providers.split(',') : []
                }))
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
    version: '1.1.0',
    description: 'MCP server for querying developer guidelines and DE service registry',
    endpoints: {
      mcp: '/mcp',
      health: '/health',
      tools: '/tools',
      search: '/tools/search_developer_guides',
      get_guide: '/tools/get_guide',
      list_guides: '/tools/list_guides',
      related_guides: '/tools/get_related_guides',
      propose_change: '/tools/propose_guide_change',
      stats: '/tools/get_guide_stats',
      initialize: '/tools/initialize_claude_md',
      services: '/tools/get_available_services',
      sync_registry: '/api/sync-registry'
    }
  });
});

export default app;
