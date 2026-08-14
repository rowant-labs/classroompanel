import { generateObject, type UserContent } from 'ai';
import { extractText, getDocumentProxy } from 'unpdf';
import { z } from 'zod';
import { courseSchema, courseLessonSchema, type Course } from '@/lib/course-schema';
import { buildDigest, splitIntoPseudoPages } from '@/lib/curriculum-ingest';
import { getRoutedModels } from '@/lib/model-router';
import { keysFromRequest } from '@/lib/provider-keys';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TEXT_CHARS = 60_000;
// Send the raw PDF to the model only when it is genuinely small; providers
// reject large/long PDFs as direct document input, so everything else goes
// through text extraction + digest.
const MAX_DIRECT_PDF_BYTES = 15 * 1024 * 1024;
const MAX_DIRECT_PDF_PAGES = 60;

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
- Use at most 12 units total; when the document has more chapters than that, group adjacent
  related chapters into one unit rather than dropping any.
- ids are short-kebab-case, unique.
- Plain text everywhere — no markdown. Never use the double-quote character " inside text; use apostrophes instead.`;

const digestSystemAddendum = `

About this input: it is NOT the full document. It is a digest of sampled excerpts from a much
longer document. The opening pages (front matter and, if present, the table of contents) are
included nearly in full; every later page contributes only its leading text, prefixed with a
[p.N] page marker. Reconstruct the document's real structure from these samples — lean on the
table of contents when there is one — and make the course cover the WHOLE document's scope,
from its first chapter to its last. When the document has more chapters than you have units,
group adjacent related chapters into one unit rather than dropping any of them.`;

// Generation-time schema: same shape as courseSchema but without array maxima.
// In jsonTool mode maxItems is advisory, not grammar-enforced, so an
// enthusiastic model occasionally overflows a cap (observed: 9 lessons in one
// unit of a 23-chapter textbook). Failing a 3-minute generation over one extra
// lesson is far worse than trimming it, so we clamp after generation and only
// then validate strictly.
const lenientCourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string(),
  gradeBand: z.string(),
  overview: z.string(),
  units: z.array(z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    lessons: z.array(courseLessonSchema).min(1),
  })).min(1),
});

function clampToCourse(raw: z.infer<typeof lenientCourseSchema>): Course {
  return courseSchema.parse({
    ...raw,
    units: raw.units.slice(0, 12).map((unit) => ({
      ...unit,
      lessons: unit.lessons.slice(0, 8),
    })),
  });
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function digestMessage(digest: string): string {
  return `Build the interactive course from this digest of a long curriculum document:\n\n${digest}`;
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
  let usedDigest = false;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: 'File too large (100MB max).' }, { status: 413 });
    }
    if (isPdf(file)) {
      const buffer = await file.arrayBuffer();
      const extractStart = Date.now();
      try {
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const pageCount = pdf.numPages;

        if (file.size <= MAX_DIRECT_PDF_BYTES && pageCount <= MAX_DIRECT_PDF_PAGES) {
          needsDocumentInput = true;
          content = [
            { type: 'file', data: buffer, mediaType: 'application/pdf' },
            { type: 'text', text: 'Build the interactive course from this curriculum document.' },
          ];
          console.log(`[curriculum] direct PDF input: ${pageCount} pages, ${file.size} bytes`);
        } else {
          const { text: pages } = await extractText(pdf, { mergePages: false });
          const digest = buildDigest(pages);
          const extractMs = Date.now() - extractStart;
          if (!digest.trim()) {
            return Response.json({ error: 'No readable text in that PDF — it looks like a scanned/image-only document. Try a text-based PDF.' }, { status: 400 });
          }
          usedDigest = true;
          content = digestMessage(digest);
          console.log(`[curriculum] PDF extract: ${extractMs}ms, ${pageCount} pages, digest ${digest.length} chars`);
        }
      } catch (error) {
        console.error('[curriculum] PDF parsing failed', error);
        return Response.json({ error: 'Could not read that PDF — it may be corrupted or password-protected.' }, { status: 400 });
      }
    } else {
      const text = await file.text();
      if (!text.trim()) return Response.json({ error: 'That file looks empty.' }, { status: 400 });
      if (text.length > MAX_TEXT_CHARS) {
        const extractStart = Date.now();
        const pages = splitIntoPseudoPages(text);
        const digest = buildDigest(pages);
        usedDigest = true;
        content = digestMessage(digest);
        console.log(`[curriculum] text digest: ${Date.now() - extractStart}ms, ${pages.length} pseudo-pages, digest ${digest.length} chars`);
      } else {
        content = `Build the interactive course from this curriculum document:\n\n${text}`;
      }
    }
  } else if (typeof pastedText === 'string' && pastedText.trim()) {
    if (pastedText.length > MAX_TEXT_CHARS) {
      const extractStart = Date.now();
      const pages = splitIntoPseudoPages(pastedText);
      const digest = buildDigest(pages);
      usedDigest = true;
      content = digestMessage(digest);
      console.log(`[curriculum] pasted-text digest: ${Date.now() - extractStart}ms, ${pages.length} pseudo-pages, digest ${digest.length} chars`);
    } else {
      content = `Build the interactive course from this curriculum material:\n\n${pastedText}`;
    }
  } else {
    return Response.json({ error: 'Upload a PDF, .txt, or .md file (or paste text).' }, { status: 400 });
  }

  const keys = keysFromRequest(request);
  const models = [
    ...getRoutedModels('tutor', keys),
    ...getRoutedModels('blackboard', keys),
  ].filter((model, index, list) => (
    list.findIndex((item) => item.provider === model.provider && item.modelId === model.modelId) === index
  // PDF document input is supported by Anthropic and Google models
  )).filter((model) => !needsDocumentInput || model.provider !== 'openai');

  if (models.length === 0) {
    return Response.json({ error: 'No AI provider configured for curriculum ingestion.' }, { status: 503 });
  }

  const failures: string[] = [];
  for (const routed of models) {
    const generateStart = Date.now();
    try {
      const result = await generateObject({
        model: routed.model,
        schema: lenientCourseSchema,
        system: usedDigest ? system + digestSystemAddendum : system,
        messages: [{ role: 'user', content }],
        providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
      });
      const course = clampToCourse(result.object);
      console.log(`[curriculum] generated with ${routed.provider}:${routed.modelId} in ${Date.now() - generateStart}ms`);
      return Response.json({ course, model: `${routed.provider}:${routed.modelId}` });
    } catch (error) {
      failures.push(`${routed.provider}:${routed.modelId}`);
      console.error(`Curriculum ingestion failed with ${routed.provider}:${routed.modelId} after ${Date.now() - generateStart}ms`, error);
    }
  }

  return Response.json({ error: `Course generation failed (${failures.join(', ')}). Try again.` }, { status: 502 });
}
