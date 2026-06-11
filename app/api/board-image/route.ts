import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  generateBoardImage,
  imageCacheKey,
  ImageGenerationUnavailableError,
  BOARD_IMAGE_STYLES,
} from '@/lib/board-image';

export const runtime = 'nodejs';
export const maxDuration = 120;

const CACHE_DIR = path.join(process.cwd(), '.cache', 'board-images');
const MAX_PROMPT_CHARS = 800;

// One generation per cache key at a time — a board rendered twice during
// streaming should not pay for (or race) two identical generations.
const inFlight = new Map<string, Promise<{ url: string; model?: string; cached: boolean }>>();

async function isCached(key: string): Promise<boolean> {
  try {
    const info = await stat(path.join(CACHE_DIR, `${key}.png`));
    return info.size > 0;
  } catch {
    return false;
  }
}

async function resolveImage(prompt: string, style: string | undefined, key: string) {
  if (await isCached(key)) {
    return { url: `/api/board-image/${key}`, cached: true };
  }
  const generated = await generateBoardImage(prompt, style);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, `${key}.png`), generated.bytes);
  return { url: `/api/board-image/${key}`, model: generated.model, cached: false };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_CHARS) : '';
  const style = typeof body.style === 'string' && (BOARD_IMAGE_STYLES as string[]).includes(body.style)
    ? body.style
    : undefined;

  if (prompt.length < 12) {
    return Response.json({ error: 'missing-prompt' }, { status: 400 });
  }

  const key = imageCacheKey(prompt, style);

  try {
    let pending = inFlight.get(key);
    if (!pending) {
      pending = resolveImage(prompt, style, key).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    const result = await pending;
    return Response.json(result);
  } catch (error) {
    if (error instanceof ImageGenerationUnavailableError) {
      return Response.json({ error: 'no-image-models' }, { status: 503 });
    }
    console.error('Board image request failed', error);
    return Response.json({ error: 'generation-failed' }, { status: 502 });
  }
}
