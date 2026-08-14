import { generateText } from 'ai';
import type { Lesson } from './lesson-schema';
import { lessonSchema } from './lesson-schema';
import { normalizeLessonCandidate, salvageLessonCandidate } from './lesson-salvage';
import { getRoutedModels } from './model-router';
import type { ProviderKeys } from './provider-keys';

import { tutorSystemPrompt, buildLessonPrompt, looseModelVisualAddendum, type LessonContext } from './tutor-prompt';

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
  const salvaged = salvageLessonCandidate(candidate);
  if (!salvaged) throw direct.error;
  console.warn(`[lesson] salvaged generation: repaired [${salvaged.repaired.join(', ') || 'none'}], dropped [${salvaged.dropped.join(', ') || 'none'}], kept ${salvaged.lesson.blocks.length} blocks`);
  return salvaged.lesson;
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
        system: routed.provider === 'anthropic' ? system : system + looseModelVisualAddendum,
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
