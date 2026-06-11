import { generateObject, type UserContent } from 'ai';
import { courseSchema } from '@/lib/course-schema';
import { getRoutedModels } from '@/lib/model-router';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_FILE_BYTES = 24 * 1024 * 1024;
const MAX_TEXT_CHARS = 60_000;

const system = `You are ClassroomPanel's curriculum architect. You turn a curriculum document
(syllabus, textbook chapter, standards doc, lesson plan) into an interactive course a student
works through on a living blackboard, one lesson at a time.

Rules:
- Stay faithful to the document: cover its actual scope and sequence; don't invent unrelated units.
- Split into units of connected ideas; each unit has 2-6 lessons sized for one blackboard each
  (one core idea per lesson, ~5-10 minutes of learning).
- "gradeBand" is your best read of the audience (e.g. "Grades 6-8", "High school", "Intro college").
- Each lesson's "boardPrompt" is the most important field: 2-4 sentences instructing a tutor
  exactly what to teach and what to draw for that lesson, written so it works WITHOUT the document.
  Include the concrete facts, formulas, examples, or vocabulary from the source the tutor will need.
- ids are short-kebab-case, unique.
- Plain text everywhere — no markdown. Never use the double-quote character " inside text; use apostrophes instead.`;

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'expected multipart form data with a "file" field' }, { status: 400 });
  }

  const file = form.get('file');
  const pastedText = form.get('text');

  let content: UserContent;
  let needsDocumentInput = false;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: 'File too large (24MB max).' }, { status: 413 });
    }
    if (isPdf(file)) {
      needsDocumentInput = true;
      content = [
        { type: 'file', data: await file.arrayBuffer(), mediaType: 'application/pdf' },
        { type: 'text', text: 'Build the interactive course from this curriculum document.' },
      ];
    } else {
      const text = (await file.text()).slice(0, MAX_TEXT_CHARS);
      if (!text.trim()) return Response.json({ error: 'That file looks empty.' }, { status: 400 });
      content = `Build the interactive course from this curriculum document:\n\n${text}`;
    }
  } else if (typeof pastedText === 'string' && pastedText.trim()) {
    content = `Build the interactive course from this curriculum material:\n\n${pastedText.slice(0, MAX_TEXT_CHARS)}`;
  } else {
    return Response.json({ error: 'Upload a PDF, .txt, or .md file (or paste text).' }, { status: 400 });
  }

  const models = [
    ...getRoutedModels('tutor'),
    ...getRoutedModels('blackboard'),
  ].filter((model, index, list) => (
    list.findIndex((item) => item.provider === model.provider && item.modelId === model.modelId) === index
  // PDF document input is supported by Anthropic and Google models
  )).filter((model) => !needsDocumentInput || model.provider !== 'openai');

  if (models.length === 0) {
    return Response.json({ error: 'No AI provider configured for curriculum ingestion.' }, { status: 503 });
  }

  const failures: string[] = [];
  for (const routed of models) {
    try {
      const result = await generateObject({
        model: routed.model,
        schema: courseSchema,
        system,
        messages: [{ role: 'user', content }],
        providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
      });
      return Response.json({ course: result.object, model: `${routed.provider}:${routed.modelId}` });
    } catch (error) {
      failures.push(`${routed.provider}:${routed.modelId}`);
      console.error(`Curriculum ingestion failed with ${routed.provider}:${routed.modelId}`, error);
    }
  }

  return Response.json({ error: `Course generation failed (${failures.join(', ')}). Try again.` }, { status: 502 });
}
