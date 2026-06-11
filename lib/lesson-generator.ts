import { generateText } from 'ai';
import type { Lesson } from './lesson-schema';
import { lessonSchema } from './lesson-schema';
import { findSampleLesson } from './sample-lessons';
import { getRoutedModels } from './model-router';

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

function parseLessonJson(text: string): Lesson {
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

  return lessonSchema.parse(normalizeLessonCandidate(JSON.parse(withoutFence.slice(start, end + 1))));
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

export async function generateLesson(topic: string, context: LessonContext = {}): Promise<{ lesson: Lesson; mode: 'ai' | 'demo'; note?: string; model?: string }> {
  const trimmed = topic.trim().slice(0, 2000);
  if (!trimmed) return { lesson: findSampleLesson('derivative'), mode: 'demo', note: 'No topic supplied, showing the default demo lesson.' };

  const models = [
    ...getRoutedModels('blackboard'),
    ...getRoutedModels('tutor'),
  ].filter((model, index, list) => (
    list.findIndex((item) => item.provider === model.provider && item.modelId === model.modelId) === index
  ));

  if (models.length === 0) {
    return {
      lesson: findSampleLesson(trimmed),
      mode: 'demo',
      note: 'Demo mode: add ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY to generate new lessons on the fly.',
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
      return { lesson: parseLessonJson(result.text), mode: 'ai', model: `${routed.provider}:${routed.modelId}` };
    } catch (error) {
      failures.push(`${routed.provider}:${routed.modelId}`);
      console.warn(`Lesson generation failed with ${routed.provider}:${routed.modelId}`, error);
    }
  }

  return {
    lesson: findSampleLesson(trimmed),
    mode: 'demo',
    note: `AI generation failed for ${failures.join(', ')}, so ClassroomPanel fell back to a built-in lesson.`,
  };
}
