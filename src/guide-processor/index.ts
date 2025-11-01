import { marked } from 'marked';
import YAML from 'yaml';

interface GuideFile {
  name: string;
  content: string;
}

interface Bindings {
  r2: R2Bucket;
  db: D1Database;
  vectorize: Vectorize;
}

interface GuideMetadata {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  type: string;
  status: string;
  version: string;
  last_updated: string;
  tags: string[];
  related_guides?: string[];
}

/**
 * Process and upload developer guide markdown files to R2, D1, and Vectorize
 */
export async function processAndUploadGuides(files: GuideFile[], bindings: Bindings) {
  const { r2, db, vectorize } = bindings;

  for (const file of files) {
    try {
      console.log(`Processing guide: ${file.name}`);

      // Extract frontmatter and content
      const { metadata, markdown } = extractFrontmatter(file.content);

      // Generate guide ID from filename
      const guideId = file.name.replace(/\.md$/, '').toLowerCase().replace(/\s+/g, '-');

      // Upload raw markdown to R2
      const markdownUrl = await uploadToR2(r2, guideId, file.content);

      // Parse markdown into sections
      const sections = await parseMarkdown(markdown);

      // Store in D1 database
      await storeInD1(db, {
        id: guideId,
        title: metadata.title || file.name,
        category: Array.isArray(metadata.category) ? metadata.category.join(', ') : (metadata.category || 'uncategorized'),
        subcategory: metadata.subcategory || null,
        type: metadata.type || 'guide',
        status: metadata.status || 'draft',
        version: metadata.version || '1.0',
        last_updated: metadata.last_updated || new Date().toISOString(),
        tags: JSON.stringify(metadata.tags || []),
        related_guides: metadata.related_guides ? JSON.stringify(metadata.related_guides) : null,
        markdown_url: markdownUrl
      }, sections);

      // Create vector embeddings for search (if vectorize is available)
      if (vectorize) {
        await createVectorEmbeddings(vectorize, guideId, metadata.title || file.name, markdown);
      }

      console.log(`Successfully processed: ${file.name}`);
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      throw error;
    }
  }
}

/**
 * Extract YAML frontmatter from markdown
 */
function extractFrontmatter(content: string): { metadata: Partial<GuideMetadata>; markdown: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const metadata = YAML.parse(match[1]) as Partial<GuideMetadata>;
    const markdown = match[2];
    return { metadata, markdown };
  }

  return { metadata: {}, markdown: content };
}

/**
 * Upload markdown file to R2 storage
 */
async function uploadToR2(r2: R2Bucket, guideId: string, content: string): Promise<string> {
  const key = `guides/${guideId}.md`;

  await r2.put(key, content, {
    httpMetadata: {
      contentType: 'text/markdown',
    },
  });

  return key;
}

/**
 * Parse markdown into structured sections
 */
async function parseMarkdown(markdown: string) {
  const sections: Array<{
    id: string;
    level: number;
    title: string;
    content: string;
    start_line: number;
    end_line: number;
  }> = [];

  const lines = markdown.split('\n');
  let currentSection: any = null;
  let lineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    lineNum++;

    // Check for headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      // Save previous section if exists
      if (currentSection) {
        currentSection.end_line = lineNum - 1;
        sections.push(currentSection);
      }

      // Start new section
      const level = headerMatch[1].length;
      const title = headerMatch[2];
      currentSection = {
        id: `section-${sections.length + 1}`,
        level,
        title,
        content: '',
        start_line: lineNum,
        end_line: lineNum
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.end_line = lineNum;
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Store guide and sections in D1 database
 */
async function storeInD1(
  db: D1Database,
  guide: {
    id: string;
    title: string;
    category: string;
    subcategory?: string;
    type: string;
    status: string;
    version: string;
    last_updated: string;
    tags: string;
    related_guides?: string;
    markdown_url: string;
  },
  sections: any[]
) {
  // Insert guide
  await db.prepare(`
    INSERT INTO guides (id, title, category, subcategory, type, status, version, last_updated, tags, related_guides, markdown_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      subcategory = excluded.subcategory,
      type = excluded.type,
      status = excluded.status,
      version = excluded.version,
      last_updated = excluded.last_updated,
      tags = excluded.tags,
      related_guides = excluded.related_guides,
      markdown_url = excluded.markdown_url
  `).bind(
    guide.id,
    guide.title,
    guide.category,
    guide.subcategory,
    guide.type,
    guide.status,
    guide.version,
    guide.last_updated,
    guide.tags,
    guide.related_guides,
    guide.markdown_url
  ).run();

  // Insert sections
  for (const section of sections) {
    await db.prepare(`
      INSERT INTO sections (id, guide_id, level, title, content, start_line, end_line)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        guide_id = excluded.guide_id,
        level = excluded.level,
        title = excluded.title,
        content = excluded.content,
        start_line = excluded.start_line,
        end_line = excluded.end_line
    `).bind(
      section.id,
      guide.id,
      section.level,
      section.title,
      section.content,
      section.start_line,
      section.end_line
    ).run();
  }

  // Insert into FTS table for full-text search
  // FTS5 doesn't support UPSERT, so delete and re-insert
  await db.prepare(`
    DELETE FROM guides_fts WHERE guide_id = ?
  `).bind(guide.id).run();

  await db.prepare(`
    INSERT INTO guides_fts (guide_id, title, content, tags)
    VALUES (?, ?, ?, ?)
  `).bind(
    guide.id,
    guide.title,
    sections.map(s => s.content).join('\n'),
    guide.tags
  ).run();
}

/**
 * Create vector embeddings for semantic search
 */
async function createVectorEmbeddings(vectorize: Vectorize, guideId: string, title: string, content: string) {
  // This is a placeholder - actual implementation depends on your embedding model
  // Typically you'd chunk the content and create embeddings for each chunk
  console.log(`Creating vector embeddings for ${guideId}...`);
  // TODO: Implement actual vectorization logic
}
