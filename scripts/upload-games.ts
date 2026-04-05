// scripts/upload-games.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BUCKET = 'game-bundles';
const VERSION = 'v1';
const DIST_DIR = resolve(import.meta.dirname, '..', 'dist-games');

async function main() {
  const files = readdirSync(DIST_DIR).filter(f => f.endsWith('.mjs'));
  if (files.length === 0) {
    console.error('No .mjs files found in dist-games/. Run pnpm build:games first.');
    process.exit(1);
  }

  console.log(`Uploading ${files.length} game bundles to ${BUCKET}/${VERSION}/...\n`);

  for (const file of files) {
    const filePath = resolve(DIST_DIR, file);
    const fileBuffer = readFileSync(filePath);
    const remotePath = `${VERSION}/${file}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(remotePath, fileBuffer, {
        contentType: 'application/javascript',
        upsert: true,
      });

    if (error) {
      console.error(`  ✗ ${file}: ${error.message}`);
    } else {
      const size = (fileBuffer.byteLength / 1024).toFixed(1);
      console.log(`  ✓ ${file} (${size} KB)`);
    }
  }

  console.log('\nDone.');
}

main();
