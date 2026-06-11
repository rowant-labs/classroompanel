import { streamObject } from 'ai';
import { lessonStreamSchema } from '@/lib/lesson-schema';
import { getRoutedModels } from '@/lib/model-router';
import { tutorSystemPrompt, buildLessonPrompt, type LessonContext } from '@/lib/tutor-prompt';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const studentRequest = typeof body.request === 'string' ? body.request.trim().slice(0, 2000) : '';
  const context: LessonContext = body.context && typeof body.context === 'object' ? body.context : {};

  if (!studentRequest) {
    return Response.json({ error: 'missing-request' }, { status: 400 });
  }

  const models = [
    ...getRoutedModels('blackboard'),
    ...getRoutedModels('tutor'),
  ].filter((model, index, list) => (
    list.findIndex((item) => item.provider === model.provider && item.modelId === model.modelId) === index
  ));

  if (models.length === 0) {
    // No provider keys configured — the client falls back to /api/generate (demo lessons).
    return Response.json({ error: 'no-models' }, { status: 503 });
  }

  const routed = models[0];
  const result = streamObject({
    model: routed.model,
    schema: lessonStreamSchema,
    system: tutorSystemPrompt,
    prompt: buildLessonPrompt(studentRequest, context),
    // The lesson schema's block union is too complex for Anthropic's strict
    // output grammar; tool-based JSON generation handles it fine.
    providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
    onError: (error) => {
      console.error(`Lesson stream failed on ${routed.provider}:${routed.modelId}`, error);
    },
  });

  const response = result.toTextStreamResponse();
  response.headers.set('x-classroompanel-model', `${routed.provider}:${routed.modelId}`);
  return response;
}
