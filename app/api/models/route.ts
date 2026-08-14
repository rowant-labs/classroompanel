import { NextResponse } from 'next/server';
import { modelStatus } from '@/lib/model-router';
import { keysFromRequest } from '@/lib/provider-keys';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return NextResponse.json(modelStatus(keysFromRequest(request)));
}
