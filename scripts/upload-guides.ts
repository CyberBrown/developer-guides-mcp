import * as fs from 'fs';
import * as path from 'path';
import { processAndUploadGuides } from '../src/guide-processor';

async function main() {
  const guidesDir = './coding-guides';
  const files = fs.readdirSync(guidesDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      name: f,
      content: fs.readFileSync(path.join(guidesDir, f), 'utf-8')
    }));
  
  console.log(`Found ${files.length} guide files`);
  
  // This would connect to your Worker's bindings
  // For actual upload, you'd deploy a temporary Worker endpoint
  console.log('Files ready for upload:', files.map(f => f.name));
}

main().catch(console.error);