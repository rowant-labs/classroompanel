// Lesson normalization + salvage, shared by the server generator and the
// client. Models without a strict output grammar (Gemini, GPT) return lessons
// that are MOSTLY right — one bad enum or mistyped field in one block. Failing
// the whole lesson over that throws away a good (already paid-for, possibly
// already-drawn) generation, so we salvage: clamp out-of-range values, drop
// invalid sub-items, then invalid blocks, and keep the lesson if what survives
// is still a teachable board. No server-only imports allowed in this module.

import { lessonSchema, lessonBlockSchema, boardMarkSchema, physicsVectorSchema, type Lesson } from './lesson-schema';

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

export function normalizeLessonCandidate(candidate: unknown) {
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

  // When the board works an equation, align the quiz with its result so the
  // check verifies the worked solution instead of asking something unrelated.
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

export type SalvageResult = {
  lesson: Lesson;
  repaired: string[];
  dropped: string[];
};

// Non-throwing salvage of an already-normalized candidate. Returns null when
// too little survives to make a teachable board.
export function salvageLessonCandidate(candidate: unknown): SalvageResult | null {
  if (!candidate || typeof candidate !== 'object' || !Array.isArray((candidate as Record<string, unknown>).blocks)) {
    return null;
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
  if (!salvaged.success) return null;
  return { lesson: salvaged.data, repaired, dropped };
}

// Client-side rescue of a raw streamed partial/final object: normalize first
// (the stream skips parseLessonJson), then salvage. A board without its quiz
// is not worth committing — the do-loop is the product — so require one.
export function salvageStreamedLesson(raw: unknown): Lesson | null {
  const result = salvageLessonCandidate(normalizeLessonCandidate(raw));
  if (!result) return null;
  if (!result.lesson.blocks.some((block) => block.type === 'quiz')) return null;
  return result.lesson;
}
