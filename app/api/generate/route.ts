import { NextResponse } from 'next/server';
import { generateLesson } from '@/lib/lesson-generator';
import { keysFromRequest } from '@/lib/provider-keys';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const topic = typeof body.topic === 'string' ? body.topic : '';
  const result = await generateLesson(topic, {}, keysFromRequest(request));
  if (result.mode === 'ai') return NextResponse.json(result);
  return NextResponse.json(
    { error: result.mode === 'unconfigured' ? 'no-models' : 'generation-failed', note: result.note },
    { status: result.mode === 'unconfigured' ? 503 : 502 },
  );
}
