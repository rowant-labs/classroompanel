// Grades a say-it-back explanation with the fast model: which key points did
// the student's own words actually cover, plus one warm, specific sentence of
// tutor feedback. The grade is FEEDBACK, not a gate — like all practice, it
// never moves mastery; the quiz stays the only graded act.

import { generateObject } from 'ai';
import { z } from 'zod';
import { getRoutedModels } from '@/lib/model-router';
import { keysFromRequest } from '@/lib/provider-keys';

export const runtime = 'nodejs';
export const maxDuration = 30;

const gradeSchema = z.object({
  // Indices into the lesson's keyPoints array that the student's explanation
  // genuinely covered (in their own words counts; parroting is fine too).
  coveredKeyPointIndices: z.array(z.number().int()),
  // Did the explanation capture the core idea overall? Generous judgment —
  // a kid who got the big picture but muffed a detail still covered it.
  covered: z.boolean(),
  feedback: z.string(),
});

const system = `You are ClassroomPanel's tutor, reading a student's say-it-back: they just explained
a lesson's core idea in their own words, from memory. You are given the prompt they answered,
the key points a good answer hits, an exemplar answer, and the student's explanation.

Judge warmly and generously:
- A key point counts as covered if the student expressed the IDEA, in any words, at any level
  of polish. Kid phrasing, typos, and informal language are all fine.
- "covered" (overall) is true when the explanation captures the core idea, even if a smaller
  point is missing.
- "feedback": one or two short sentences, spoken directly to the student. Name something
  specific they genuinely got right, and if they missed something important, point at it
  concretely and kindly — never generic praise, never shame. Plain text, no markdown.
- Never use the double-quote character anywhere; use apostrophes instead.`;

function str(value: unknown, cap: number): string {
  return typeof value === 'string' ? value.slice(0, cap) : '';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const prompt = str(body.prompt, 400);
  const studentText = str(body.studentText, 600);
  const exemplar = str(body.exemplar, 600);
  const keyPoints = (Array.isArray(body.keyPoints) ? body.keyPoints : [])
    .slice(0, 4)
    .map((point: unknown) => str(point, 300))
    .filter(Boolean);

  if (!prompt || !studentText || keyPoints.length === 0) {
    return Response.json({ error: 'missing-fields' }, { status: 400 });
  }

  const keys = keysFromRequest(request);
  const models = [
    ...getRoutedModels('fast', keys),
    ...getRoutedModels('blackboard', keys),
  ].filter((model, index, list) => (
    list.findIndex((item) => item.provider === model.provider && item.modelId === model.modelId) === index
  ));

  if (models.length === 0) {
    return Response.json({ error: 'no-models' }, { status: 503 });
  }

  const gradePrompt = [
    `Prompt the student answered: ${prompt}`,
    '',
    'Key points a good answer hits:',
    ...keyPoints.map((point: string, index: number) => `${index}. ${point}`),
    '',
    `Exemplar answer: ${exemplar}`,
    '',
    `The student wrote: ${studentText}`,
    '',
    'Read their words and grade now.',
  ].join('\n');

  const failures: string[] = [];
  for (const routed of models.slice(0, 3)) {
    try {
      const result = await generateObject({
        model: routed.model,
        schema: gradeSchema,
        system,
        prompt: gradePrompt,
        providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
      });
      const coveredIndices = [...new Set(result.object.coveredKeyPointIndices)]
        .filter((index) => Number.isInteger(index) && index >= 0 && index < keyPoints.length)
        .sort((a, b) => a - b);
      return Response.json({
        grade: {
          coveredIndices,
          covered: result.object.covered,
          feedback: result.object.feedback.slice(0, 500),
        },
        model: `${routed.provider}:${routed.modelId}`,
      });
    } catch (error) {
      failures.push(`${routed.provider}:${routed.modelId}`);
      console.warn(`Say-it-back grading failed with ${routed.provider}:${routed.modelId}`, error);
    }
  }

  return Response.json({ error: `Grading failed (${failures.join(', ')}).` }, { status: 502 });
}
