/**
 * Guide Processor
 * 
 * Processes markdown guides for MCP server:
 * 1. Parse markdown with frontmatter
 * 2. Extract sections and code examples
 * 3. Create chunks for vectorization
 * 4. Generate metadata for D1 index
 * 5. Upload to R2 and Vectorize
 */

import { parse } from 'yaml';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';

// ============================================================================
// Types
// ============================================================================

interface GuideMetadata {
  id: string;
  title: string;
  category: string | string[];
  subcategory?: string;
  type: string;
  status: string;
  version: string;
  last_updated: string;
  languages?: string[];
  frameworks?: string[];
  platforms?: string[];
  tags: string[];
  related_guides?: string[];
}

interface Section {
  id: string;
  level: number;
  title: string;
  content: string;
  codeBlocks: CodeBlock[];
  startLine: number;
  endLine: number;
}

interface CodeBlock {
  language: string;
  code: string;
  caption?: string;
}

interface Chunk {
  id: string;
  guideId: string;
  sectionId: string;
  text: string;
  tokens: number;
  metadata: {
    category: string;
    subcategory?: string;
    framework?: string;
    language?: string;
    tags: string[];
  };
}

interface ProcessedGuide {
  metadata: GuideMetadata;
  sections: Section[];
  chunks: Chunk[];
  codeExamples: CodeBlock[];
  markdown: string;
}

// ============================================================================
// Markdown Parser
// ============================================================================

class GuideParser {
  private marked: Marked;
  
  constructor() {
    this.marked = new Marked(
      markedHighlight({
        highlight: (code, lang) => code
      })
    );
  }
  
  /**
   * Parse markdown file with frontmatter
   */
  parse(markdown: string): ProcessedGuide {
    const { frontmatter, content } = this.extractFrontmatter(markdown);
    const metadata = this.parseMetadata(frontmatter);
    const sections = this.extractSections(content);
    const codeExamples = this.extractCodeExamples(sections);
    const chunks = this.createChunks(metadata, sections);
    
    return {
      metadata,
      sections,
      chunks,
      codeExamples,
      markdown
    };
  }
  
  /**
   * Extract YAML frontmatter
   */
  private extractFrontmatter(markdown: string): {
    frontmatter: string;
    content: string;
  } {
    const match = markdown.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);
    
    if (!match) {
      throw new Error('No frontmatter found in markdown');
    }
    
    return {
      frontmatter: match[1],
      content: match[2]
    };
  }
  
  /**
   * Parse YAML frontmatter to metadata
   */
  private parseMetadata(frontmatter: string): GuideMetadata {
    const parsed = parse(frontmatter);
    
    return {
      id: parsed.id,
      title: parsed.title,
      category: Array.isArray(parsed.category) ? parsed.category : [parsed.category],
      subcategory: parsed.subcategory,
      type: parsed.type,
      status: parsed.status,
      version: parsed.version,
      last_updated: parsed.last_updated,
      languages: parsed.languages,
      frameworks: parsed.frameworks,
      platforms: parsed.platforms,
      tags: parsed.tags || [],
      related_guides: parsed.related_guides || []
    };
  }
  
  /**
   * Extract sections from markdown content
   */
  private extractSections(content: string): Section[] {
    const lines = content.split('\n');
    const sections: Section[] = [];
    let currentSection: Partial<Section> | null = null;
    let sectionContent: string[] = [];
    let sectionCodeBlocks: CodeBlock[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for header
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          sections.push({
            ...currentSection,
            content: sectionContent.join('\n').trim(),
            codeBlocks: sectionCodeBlocks,
            endLine: i - 1
          } as Section);
        }
        
        // Start new section
        const level = headerMatch[1].length;
        const title = headerMatch[2];
        const id = this.generateSectionId(title);
        
        currentSection = {
          id,
          level,
          title,
          startLine: i
        };
        sectionContent = [];
        sectionCodeBlocks = [];
      } else {
        // Add to current section
        sectionContent.push(line);
        
        // Check for code block
        if (line.startsWith('```')) {
          const codeBlock = this.extractCodeBlock(lines, i);
          if (codeBlock) {
            sectionCodeBlocks.push(codeBlock);
          }
        }
      }
    }
    
    // Save last section
    if (currentSection) {
      sections.push({
        ...currentSection,
        content: sectionContent.join('\n').trim(),
        codeBlocks: sectionCodeBlocks,
        endLine: lines.length - 1
      } as Section);
    }
    
    return sections;
  }
  
  /**
   * Extract code block starting at given line
   */
  private extractCodeBlock(lines: string[], startIndex: number): CodeBlock | null {
    const startLine = lines[startIndex];
    const langMatch = startLine.match(/^```(\w+)/);
    
    if (!langMatch) return null;
    
    const language = langMatch[1];
    const codeLines: string[] = [];
    let i = startIndex + 1;
    
    while (i < lines.length && !lines[i].startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }
    
    return {
      language,
      code: codeLines.join('\n')
    };
  }
  
  /**
   * Extract all code examples from sections
   */
  private extractCodeExamples(sections: Section[]): CodeBlock[] {
    return sections.flatMap(section => section.codeBlocks);
  }
  
  /**
   * Create searchable chunks for vectorization
   */
  private createChunks(metadata: GuideMetadata, sections: Section[]): Chunk[] {
    const chunks: Chunk[] = [];
    
    for (const section of sections) {
      // Skip very short sections (< 100 chars)
      if (section.content.length < 100) continue;
      
      // Create chunk with context
      const chunkText = [
        `# ${metadata.title}`,
        `Category: ${Array.isArray(metadata.category) ? metadata.category.join(', ') : metadata.category}`,
        `Section: ${section.title}`,
        '',
        section.content
      ].join('\n');
      
      const tokens = this.estimateTokens(chunkText);
      
      // If section is too large, split it
      if (tokens > 1000) {
        chunks.push(...this.splitLargeSection(metadata, section));
      } else {
        chunks.push({
          id: `${metadata.id}-${section.id}`,
          guideId: metadata.id,
          sectionId: section.id,
          text: chunkText,
          tokens,
          metadata: {
            category: Array.isArray(metadata.category) ? metadata.category[0] : metadata.category,
            subcategory: metadata.subcategory,
            framework: this.detectFramework(section.content),
            language: this.detectLanguage(section.content),
            tags: metadata.tags
          }
        });
      }
    }
    
    return chunks;
  }
  
  /**
   * Split large sections into smaller chunks
   */
  private splitLargeSection(metadata: GuideMetadata, section: Section): Chunk[] {
    const chunks: Chunk[] = [];
    const paragraphs = section.content.split('\n\n');
    let currentChunk: string[] = [
      `# ${metadata.title}`,
      `Section: ${section.title}`,
      ''
    ];
    let chunkIndex = 0;
    
    for (const paragraph of paragraphs) {
      const testChunk = [...currentChunk, paragraph].join('\n\n');
      const tokens = this.estimateTokens(testChunk);
      
      if (tokens > 1000) {
        // Save current chunk
        chunks.push({
          id: `${metadata.id}-${section.id}-${chunkIndex}`,
          guideId: metadata.id,
          sectionId: section.id,
          text: currentChunk.join('\n\n'),
          tokens: this.estimateTokens(currentChunk.join('\n\n')),
          metadata: {
            category: Array.isArray(metadata.category) ? metadata.category[0] : metadata.category,
            subcategory: metadata.subcategory,
            framework: this.detectFramework(section.content),
            language: this.detectLanguage(section.content),
            tags: metadata.tags
          }
        });
        
        // Start new chunk
        currentChunk = [
          `# ${metadata.title}`,
          `Section: ${section.title} (continued)`,
          '',
          paragraph
        ];
        chunkIndex++;
      } else {
        currentChunk.push(paragraph);
      }
    }
    
    // Save last chunk
    if (currentChunk.length > 3) {
      chunks.push({
        id: `${metadata.id}-${section.id}-${chunkIndex}`,
        guideId: metadata.id,
        sectionId: section.id,
        text: currentChunk.join('\n\n'),
        tokens: this.estimateTokens(currentChunk.join('\n\n')),
        metadata: {
          category: Array.isArray(metadata.category) ? metadata.category[0] : metadata.category,
          subcategory: metadata.subcategory,
          framework: this.detectFramework(section.content),
          language: this.detectLanguage(section.content),
          tags: metadata.tags
        }
      });
    }
    
    return chunks;
  }
  
  /**
   * Generate section ID from title
   */
  private generateSectionId(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Detect framework mentioned in content
   */
  private detectFramework(content: string): string | undefined {
    const frameworks = ['qwik', 'react', 'vue', 'angular', 'svelte'];
    const lowerContent = content.toLowerCase();
    
    return frameworks.find(fw => lowerContent.includes(fw));
  }
  
  /**
   * Detect programming language in content
   */
  private detectLanguage(content: string): string | undefined {
    const languages = ['typescript', 'javascript', 'python', 'go', 'sql'];
    const lowerContent = content.toLowerCase();
    
    return languages.find(lang => lowerContent.includes(lang));
  }
}

// ============================================================================
// Database Schema (D1)
// ============================================================================

const D1_SCHEMA = `
-- Guides metadata
CREATE TABLE IF NOT EXISTS guides (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  version TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  tags TEXT NOT NULL,
  related_guides TEXT,
  markdown_url TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_guides_category ON guides(category);
CREATE INDEX idx_guides_status ON guides(status);
CREATE INDEX idx_guides_tags ON guides(tags);

-- Sections
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  guide_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE
);

CREATE INDEX idx_sections_guide_id ON sections(guide_id);
CREATE INDEX idx_sections_title ON sections(title);

-- Code examples
CREATE TABLE IF NOT EXISTS code_examples (
  id TEXT PRIMARY KEY,
  guide_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL,
  caption TEXT,
  FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE INDEX idx_code_examples_guide_id ON code_examples(guide_id);
CREATE INDEX idx_code_examples_language ON code_examples(language);

-- Search index (FTS5 for full-text search)
CREATE VIRTUAL TABLE IF NOT EXISTS guides_fts USING fts5(
  guide_id UNINDEXED,
  title,
  content,
  tags
);
`;

// ============================================================================
// Uploader
// ============================================================================

interface UploadConfig {
  r2: R2Bucket;
  db: D1Database;
  vectorize: VectorizeIndex;
}

class GuideUploader {
  constructor(private config: UploadConfig) {}
  
  async upload(guide: ProcessedGuide): Promise<void> {
    console.log(`Uploading guide: ${guide.metadata.title}`);
    
    // 1. Upload markdown to R2
    await this.uploadToR2(guide);
    
    // 2. Store metadata in D1
    await this.storeInD1(guide);
    
    // 3. Create vector embeddings
    await this.vectorize(guide);
    
    console.log(`✓ Successfully uploaded ${guide.metadata.id}`);
  }
  
  private async uploadToR2(guide: ProcessedGuide): Promise<void> {
    const key = `guides/${guide.metadata.id}.md`;
    
    await this.config.r2.put(key, guide.markdown, {
      httpMetadata: {
        contentType: 'text/markdown',
        cacheControl: 'public, max-age=3600'
      },
      customMetadata: {
        guideId: guide.metadata.id,
        version: guide.metadata.version,
        lastUpdated: guide.metadata.last_updated
      }
    });
    
    console.log(`  ✓ Uploaded to R2: ${key}`);
  }
  
  private async storeInD1(guide: ProcessedGuide): Promise<void> {
    // Insert guide metadata
    await this.config.db.prepare(`
      INSERT INTO guides (
        id, title, category, subcategory, type, status, version,
        last_updated, tags, related_guides, markdown_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      guide.metadata.id,
      guide.metadata.title,
      Array.isArray(guide.metadata.category) ? guide.metadata.category.join(',') : guide.metadata.category,
      guide.metadata.subcategory || null,
      guide.metadata.type,
      guide.metadata.status,
      guide.metadata.version,
      guide.metadata.last_updated,
      guide.metadata.tags.join(','),
      guide.metadata.related_guides?.join(',') || null,
      `guides/${guide.metadata.id}.md`
    ).run();
    
    // Insert sections
    for (const section of guide.sections) {
      await this.config.db.prepare(`
        INSERT INTO sections (
          id, guide_id, level, title, content, start_line, end_line
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `${guide.metadata.id}-${section.id}`,
        guide.metadata.id,
        section.level,
        section.title,
        section.content,
        section.startLine,
        section.endLine
      ).run();
    }
    
    // Insert code examples
    for (let i = 0; i < guide.codeExamples.length; i++) {
      const example = guide.codeExamples[i];
      await this.config.db.prepare(`
        INSERT INTO code_examples (
          id, guide_id, section_id, language, code, caption
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        `${guide.metadata.id}-code-${i}`,
        guide.metadata.id,
        '', // Would need to track which section
        example.language,
        example.code,
        example.caption || null
      ).run();
    }
    
    // Insert into FTS index
    await this.config.db.prepare(`
      INSERT INTO guides_fts (guide_id, title, content, tags)
      VALUES (?, ?, ?, ?)
    `).bind(
      guide.metadata.id,
      guide.metadata.title,
      guide.sections.map(s => s.content).join('\n\n'),
      guide.metadata.tags.join(' ')
    ).run();
    
    console.log(`  ✓ Stored in D1`);
  }
  
  private async vectorize(guide: ProcessedGuide): Promise<void> {
    // Prepare vectors for Cloudflare Vectorize
    const vectors = guide.chunks.map(chunk => ({
      id: chunk.id,
      values: [], // Will be generated by Vectorize
      metadata: {
        guideId: chunk.guideId,
        sectionId: chunk.sectionId,
        category: chunk.metadata.category,
        framework: chunk.metadata.framework,
        language: chunk.metadata.language,
        tags: chunk.metadata.tags.join(',')
      }
    }));
    
    // Vectorize will generate embeddings automatically
    await this.config.vectorize.insert(
      guide.chunks.map(chunk => ({
        id: chunk.id,
        namespace: 'guides',
        values: chunk.text, // Vectorize creates embedding
        metadata: {
          text: chunk.text.substring(0, 1000), // Store preview
          ...chunk.metadata
        }
      }))
    );
    
    console.log(`  ✓ Vectorized ${guide.chunks.length} chunks`);
  }
}

// ============================================================================
// Main Processing Function
// ============================================================================

export async function processAndUploadGuides(
  markdownFiles: { name: string; content: string }[],
  config: UploadConfig
): Promise<void> {
  const parser = new GuideParser();
  const uploader = new GuideUploader(config);
  
  console.log(`Processing ${markdownFiles.length} guides...\n`);
  
  for (const file of markdownFiles) {
    try {
      console.log(`Processing: ${file.name}`);
      const guide = parser.parse(file.content);
      await uploader.upload(guide);
      console.log('');
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
    }
  }
  
  console.log('✓ All guides processed successfully!');
}

// ============================================================================
// Usage Example
// ============================================================================

/*
// In your Cloudflare Worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Load markdown files (from local or Google Drive)
    const files = [
      { name: '00-index.md', content: await loadFile('00-index.md') },
      { name: '01-fundamentals.md', content: await loadFile('01-fundamentals.md') },
      // ... rest of files
    ];
    
    // Process and upload
    await processAndUploadGuides(files, {
      r2: env.GUIDES_BUCKET,
      db: env.DB,
      vectorize: env.VECTORIZE
    });
    
    return new Response('Upload complete!');
  }
};
*/
