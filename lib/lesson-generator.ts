import { generateText } from 'ai';
import type { Lesson } from './lesson-schema';
import { lessonSchema, lessonBlockSchema, boardMarkSchema, physicsVectorSchema } from './lesson-schema';
import { getRoutedModels } from './model-router';
import type { ProviderKeys } from './provider-keys';

import { tutorSystemPrompt, buildLessonPrompt, type LessonContext } from './tutor-prompt';

const system = `${tutorSystemPrompt}

Output format for THIS request: return only one raw JSON object matching the documented shape.
Do not wrap it in Markdown. Use safe plain text.`;

const schemaGuide = `JSON shape:
{
  "id": "short-kebab-id",
  "title": "lesson title",
  "subject": "subject",
  "objective": "one sentence",
  "tutorMessage": "1-2 friendly spoken sentences",
  "blocks": [
    { "id": "intro", "type": "explanation", "eyebrow": "optional", "title": "short", "body": "concise" },
    { "id": "graph", "type": "graph", "title": "short", "subtitle": "optional", "expression": "y = x²", "highlight": "tangent|area|point|slope|curve", "focusX": 1, "domainMin": -5, "domainMax": 5 },
    { "id": "sketch", "type": "sketch", "title": "short", "caption": "optional", "layout": "flow|cycle|compare|map|timeline|system", "marks": [
      { "id": "m1", "kind": "node|arrow|label|formula|highlight", "text": "short", "detail": "optional", "x": 10, "y": 20, "w": 20, "h": 12, "toX": 40, "toY": 20, "tone": "chalk|gold|green|blue" }
    ] },
    { "id": "sim", "type": "simulation", "title": "short", "frames": [
      { "label": "Step 1", "caption": "what changes", "marks": [
        { "id": "m1", "kind": "node", "text": "short", "x": 20, "y": 30, "w": 20, "h": 10 }
      ] }
    ] },
    { "id": "free-body", "type": "freeBody", "title": "free-body diagram title", "objectLabel": "cart", "surface": "floor", "motion": "accelerating right", "equation": "Fnet = ma", "forces": [
      { "id": "push", "label": "Push", "direction": "left|right|up|down|up-left|up-right|down-left|down-right", "magnitude": "12 N", "tone": "chalk|gold|green|blue" }
    ] },
    { "id": "equation", "type": "equation", "title": "solve it", "givens": ["m = 4 kg"], "steps": [
      { "left": "Fnet", "right": "m × a", "note": "Newton's second law" }
    ], "result": "a = 3 m/s²" },
    { "id": "image", "type": "image", "title": "short", "prompt": "one clear visual described in 1-3 sentences, no text in the image", "alt": "describe the picture for a student who cannot see it", "style": "photo|illustration|diagram|cutaway|map", "caption": "ties the picture to the idea", "lookFor": ["1 to 4 short phrases"] },
    { "id": "steps", "type": "steps", "title": "short", "steps": ["2 to 8 short steps"] },
    { "id": "quiz", "type": "quiz", "question": "question", "choices": ["A", "B"], "answerIndex": 0, "explanation": "why" }
  ]
}
Use 4 to 8 blocks total. Include at least one visual block: sketch, simulation, freeBody, equation, or graph. Coordinates must be numbers from 0 to 100.`;

export function parseLessonJson(text: string): Lesson {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return a JSON object.');
  }

  const candidate = normalizeLessonCandidate(JSON.parse(withoutFence.slice(start, end + 1)));
  const direct = lessonSchema.safeParse(candidate);
  if (direct.success) return direct.data;
  return salvageLesson(candidate, direct.error);
}

// Gemini (and occasionally other providers without a strict output grammar)
// returns lessons that are MOSTLY right — one bad enum value or mistyped field
// in one block. Failing the whole lesson over that throws away a good
// generation, so we salvage: drop invalid sub-items, then invalid blocks, and
// keep the lesson if what survives is still a teachable board.
function salvageLesson(candidate: unknown, originalError: unknown): Lesson {
  if (!candidate || typeof candidate !== 'object' || !Array.isArray((candidate as Record<string, unknown>).blocks)) {
    throw originalError;
  }
  const lesson = candidate as Record<string, unknown> & { blocks: unknown[] };
  const kept: Lesson['blocks'] = [];
  const repaired: string[] = [];
  const dropped: string[] = [];

  for (const rawBlock of lesson.blocks) {
    const type = rawBlock && typeof rawBlock === 'object' ? String((rawBlock as Record<string, unknown>).type) : 'unknown';
    const direct = lessonBlockSchema.safeParse(rawBlock);
    if (direct.success) {
      kept.push(direct.data);
      continue;
    }
    const retry = lessonBlockSchema.safeParse(repairBlockItems(rawBlock));
    if (retry.success) {
      kept.push(retry.data);
      repaired.push(type);
      continue;
    }
    dropped.push(type);
  }

  const salvaged = lessonSchema.safeParse({ ...lesson, blocks: kept });
  if (!salvaged.success) throw originalError;
  console.warn(`[lesson] salvaged generation: repaired [${repaired.join(', ') || 'none'}], dropped [${dropped.join(', ') || 'none'}], kept ${kept.length} blocks`);
  return salvaged.data;
}

// Strip invalid sub-items (marks, forces, nodes, string lists) so a block with
// one bad item can still pass its own schema minimums.
function repairBlockItems(rawBlock: unknown): unknown {
  if (!rawBlock || typeof rawBlock !== 'object') return rawBlock;
  const block = { ...(rawBlock as Record<string, unknown>) };
  const validMarks = (marks: unknown) => (Array.isArray(marks) ? marks.filter((mark) => boardMarkSchema.safeParse(mark).success) : marks);

  if (block.type === 'sketch') block.marks = validMarks(block.marks);
  if (block.type === 'simulation' && Array.isArray(block.frames)) {
    block.frames = block.frames
      .map((frame) => (frame && typeof frame === 'object' ? { ...(frame as Record<string, unknown>), marks: validMarks((frame as Record<string, unknown>).marks) } : frame))
      .filter((frame) => Array.isArray((frame as Record<string, unknown>)?.marks) && ((frame as Record<string, unknown>).marks as unknown[]).length >= 2);
  }
  if (block.type === 'freeBody' && Array.isArray(block.forces)) {
    block.forces = block.forces.filter((force) => physicsVectorSchema.safeParse(force).success);
  }
  if (block.type === 'diagram' && Array.isArray(block.nodes)) {
    block.nodes = block.nodes.filter((node) => node && typeof node === 'object' && typeof (node as Record<string, unknown>).label === 'string');
  }
  if (block.type === 'steps' && Array.isArray(block.steps)) {
    block.steps = block.steps.filter((step) => typeof step === 'string' && step.trim());
  }
  if (block.type === 'equation' && Array.isArray(block.givens)) {
    block.givens = block.givens.filter((given) => typeof given === 'string' && given.trim());
  }
  if ((block.type === 'quiz' || block.type === 'predict') && Array.isArray(block.choices)) {
    block.choices = block.choices.filter((choice) => typeof choice === 'string');
  }
  return block;
}

function clamp(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return value;
  return Math.min(max, Math.max(min, value));
}

function normalizeMark(mark: unknown) {
  if (!mark || typeof mark !== 'object') return mark;
  const next = { ...(mark as Record<string, unknown>) };
  next.x = clamp(next.x, 0, 100);
  next.y = clamp(next.y, 0, 100);
  next.w = clamp(next.w, 6, 60);
  next.h = clamp(next.h, 5, 30);
  next.toX = clamp(next.toX, 0, 100);
  next.toY = clamp(next.toY, 0, 100);
  return next;
}

function normalizeLessonCandidate(candidate: unknown) {
  if (!candidate || typeof candidate !== 'object') return candidate;
  const lesson = { ...(candidate as Record<string, unknown>) };

  if (!Array.isArray(lesson.blocks)) return lesson;

  lesson.blocks = lesson.blocks.slice(0, 8).map((block) => {
    if (!block || typeof block !== 'object') return block;
    const next = { ...(block as Record<string, unknown>) };

    if (next.type === 'diagram' && Array.isArray(next.nodes)) {
      next.nodes = next.nodes.slice(0, 8);
    }

    if (next.type === 'sketch' && Array.isArray(next.marks)) {
      next.marks = next.marks.slice(0, 12).map(normalizeMark);
    }

    if (next.type === 'simulation' && Array.isArray(next.frames)) {
      next.frames = next.frames.slice(0, 5).map((frame) => {
        if (!frame || typeof frame !== 'object') return frame;
        const nextFrame = { ...(frame as Record<string, unknown>) };
        if (Array.isArray(nextFrame.marks)) {
          nextFrame.marks = nextFrame.marks.slice(0, 8).map(normalizeMark);
        }
        return nextFrame;
      });
    }

    if (next.type === 'freeBody' && Array.isArray(next.forces)) {
      next.forces = next.forces.slice(0, 6);
    }

    if (next.type === 'equation') {
      if (Array.isArray(next.givens)) next.givens = next.givens.slice(0, 6);
      if (Array.isArray(next.steps)) next.steps = next.steps.slice(0, 6);
    }

    if (next.type === 'steps' && Array.isArray(next.steps)) {
      next.steps = next.steps.slice(0, 8);
    }

    if (next.type === 'image' && Array.isArray(next.lookFor)) {
      next.lookFor = next.lookFor.slice(0, 4);
    }

    if (next.type === 'quiz' && Array.isArray(next.choices)) {
      const choices = next.choices.slice(0, 5);
      next.choices = choices;
      next.answerIndex = clamp(next.answerIndex, 0, choices.length - 1);
    }

    return next;
  });

  const blocks = lesson.blocks as Array<Record<string, unknown>>;
  const equation = blocks.find((block) => block.type === 'equation');
  const quiz = blocks.find((block) => block.type === 'quiz');

  if (equation && quiz && typeof equation.result === 'string' && Array.isArray(quiz.choices)) {
    const resultAnswer = equation.result.replace(/^.*=\s*/, '').trim();
    const otherChoices = quiz.choices.filter((choice) => (
      typeof choice === 'string' && choice.toLowerCase().replace(/\s+/g, '') === resultAnswer.toLowerCase().replace(/\s+/g, '')
    ));

    if (resultAnswer) {
      quiz.question = 'Based on the equation board, what is the result?';
      quiz.choices = [
        resultAnswer,
        ...quiz.choices.filter((choice) => choice !== resultAnswer && !otherChoices.includes(choice)),
      ].slice(0, 5);
      quiz.answerIndex = 0;
      quiz.explanation = `The equation board solves to ${equation.result}.`;
    }
  }

  return lesson;
}

export type GenerateLessonResult =
  | { mode: 'ai'; lesson: Lesson; model: string }
  // No provider key anywhere (server env or BYOK) — the client should ask for one.
  | { mode: 'unconfigured'; note: string }
  // Keys exist but every attempt failed — an honest error, never a canned lesson.
  | { mode: 'failed'; note: string };

export async function generateLesson(topic: string, context: LessonContext = {}, keys?: ProviderKeys): Promise<GenerateLessonResult> {
  const trimmed = topic.trim().slice(0, 2000);
  if (!trimmed) return { mode: 'failed', note: 'No topic supplied.' };

  const models = [
    ...getRoutedModels('blackboard', keys),
    ...getRoutedModels('tutor', keys),
  ].filter((model, index, list) => (
    list.findIndex((item) => item.provider === model.provider && item.modelId === model.modelId) === index
  ));

  if (models.length === 0) {
    return {
      mode: 'unconfigured',
      note: 'Add your own model key in the tutor panel — or set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY on the server — to draw live lessons.',
    };
  }

  const failures: string[] = [];

  for (const routed of models) {
    try {
      const result = await generateText({
        model: routed.model,
        system,
        prompt: `${schemaGuide}

${buildLessonPrompt(trimmed, context)}`,
      });
      return { mode: 'ai', lesson: parseLessonJson(result.text), model: `${routed.provider}:${routed.modelId}` };
    } catch (error) {
      failures.push(`${routed.provider}:${routed.modelId}`);
      console.warn(`Lesson generation failed with ${routed.provider}:${routed.modelId}`, error);
    }
  }

  return {
    mode: 'failed',
    note: `Lesson generation failed (${failures.join(', ')}). Check your key and try again.`,
  };
}
