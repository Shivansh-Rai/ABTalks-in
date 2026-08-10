import fs from 'fs';
import path from 'path';
import { pipeline } from '@xenova/transformers';

const KB_DIR = path.join(process.cwd(), 'knowledge', 'processed');
const OUTPUT_FILE = path.join(process.cwd(), 'src', 'data', 'kb-embeddings.json');

type Chunk = {
  text: string;
  source: string;
};

type EmbeddedChunk = Chunk & {
  embedding: number[];
};

// Extremely basic markdown chunker. Splits by H2/H3/H4 headers.
function chunkMarkdown(text: string, filename: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = text.split('\n');
  
  let currentChunkText = '';
  let currentHeader = '';

  for (const line of lines) {
    if (line.match(/^#{2,4}\s/)) {
      if (currentChunkText.trim().length > 20) {
        chunks.push({
          text: (currentHeader ? `${currentHeader}\n` : '') + currentChunkText.trim(),
          source: filename,
        });
      }
      currentHeader = line.trim();
      currentChunkText = '';
    } else {
      currentChunkText += line + '\n';
    }
  }

  if (currentChunkText.trim().length > 20) {
    chunks.push({
      text: (currentHeader ? `${currentHeader}\n` : '') + currentChunkText.trim(),
      source: filename,
    });
  }

  // Further split very large chunks into paragraphs
  const maxChunkLength = 1000;
  const refinedChunks: Chunk[] = [];

  for (const c of chunks) {
    if (c.text.length > maxChunkLength) {
      const paragraphs = c.text.split('\n\n');
      let currentSubChunk = '';
      for (const p of paragraphs) {
        if ((currentSubChunk.length + p.length) > maxChunkLength && currentSubChunk.trim()) {
           refinedChunks.push({ text: currentSubChunk.trim(), source: c.source });
           currentSubChunk = '';
        }
        currentSubChunk += p + '\n\n';
      }
      if (currentSubChunk.trim()) {
         refinedChunks.push({ text: currentSubChunk.trim(), source: c.source });
      }
    } else {
      refinedChunks.push(c);
    }
  }

  return refinedChunks;
}

async function main() {
  console.log('Loading embedding model...');
  // Initialize the pipeline
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} markdown files in ${KB_DIR}`);

  const allChunks: Chunk[] = [];

  for (const file of files) {
    const filePath = path.join(KB_DIR, file);
    const text = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkMarkdown(text, file);
    allChunks.push(...chunks);
    console.log(`Processed ${file}: ${chunks.length} chunks`);
  }

  console.log(`Generating embeddings for ${allChunks.length} total chunks...`);
  const embeddedChunks: EmbeddedChunk[] = [];

  let count = 0;
  for (const chunk of allChunks) {
    count++;
    if (count % 20 === 0) {
      console.log(`Embedded ${count}/${allChunks.length} chunks...`);
    }
    
    // Generate embedding
    const output = await extractor(chunk.text, { pooling: 'mean', normalize: true });
    // output.data is a Float32Array
    const embedding = Array.from(output.data);
    
    embeddedChunks.push({
      ...chunk,
      embedding
    });
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(embeddedChunks, null, 2));
  console.log(`Successfully saved ${embeddedChunks.length} embedded chunks to ${OUTPUT_FILE}`);
}

main().catch(console.error);
