import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const runtime = 'nodejs';

// Must mirror the POST route's cache location (serverless → OS temp dir).
const CACHE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'classroompanel-board-images')
  : path.join(process.cwd(), '.cache', 'board-images');
const KEY_PATTERN = /^[a-f0-9]{24,64}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!KEY_PATTERN.test(key)) {
    return Response.json({ error: 'bad-key' }, { status: 400 });
  }

  try {
    const bytes = await readFile(path.join(CACHE_DIR, `${key}.png`));
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'image/png',
        // Content is keyed by a hash of its prompt, so it never changes.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    // Cache evicted (or another machine) — client re-POSTs to regenerate.
    return Response.json({ error: 'not-found' }, { status: 404 });
  }
}
