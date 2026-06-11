import { NextResponse } from 'next/server';
import { modelStatus } from '@/lib/model-router';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(modelStatus());
}
