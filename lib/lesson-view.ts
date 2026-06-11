// Coerces a streaming (partial) lesson into a safely renderable view: drops
// half-formed blocks, fills defaults, clamps coordinates. The board renders the
// view while the model is still writing, so each block pops in as it completes.

import type { Lesson, LessonBlock, PartialLesson } from './lesson-schema';

export type LessonView = {
  id: string;
  title: string;
  subject: string;
  objective: string;
  tutorMessage?: string;
  blocks: LessonBlock[];
};

type AnyRecord = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const MARK_KINDS = new Set(['node', 'arrow', 'label', 'formula', 'highlight']);
const TONES = new Set(['chalk', 'gold', 'green', 'blue']);
const DIRECTIONS = new Set(['left', 'right', 'up', 'down', 'up-left', 'up-right', 'down-left', 'down-right']);
const HIGHLIGHTS = new Set(['tangent', 'area', 'point', 'slope', 'curve']);
const LAYOUTS = new Set(['flow', 'cycle', 'compare', 'map', 'timeline', 'system']);
const IMAGE_STYLES = new Set(['photo', 'illustration', 'diagram', 'cutaway', 'map']);

function coerceMark(raw: unknown, index: number): AnyRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const mark = raw as AnyRecord;
  const text = str(mark.text);
  const x = num(mark.x);
  const y = num(mark.y);
  const kind = typeof mark.kind === 'string' && MARK_KINDS.has(mark.kind) ? mark.kind : 'node';
  if (!text || x === null || y === null) return null;
  const out: AnyRecord = {
    id: str(mark.id) ?? `mark-${index}`,
    kind,
    text,
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
  };
  if (str(mark.detail)) out.detail = mark.detail;
  const w = num(mark.w); if (w !== null) out.w = clamp(w, 6, 60);
  const h = num(mark.h); if (h !== null) out.h = clamp(h, 5, 30);
  const toX = num(mark.toX); if (toX !== null) out.toX = clamp(toX, 0, 100);
  const toY = num(mark.toY); if (toY !== null) out.toY = clamp(toY, 0, 100);
  if (typeof mark.tone === 'string' && TONES.has(mark.tone)) out.tone = mark.tone;
  return out;
}

function coerceBlock(raw: unknown, index: number): LessonBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const block = raw as AnyRecord;
  const id = str(block.id) ?? `block-${index}`;

  switch (block.type) {
    case 'explanation': {
      const title = str(block.title);
      const body = str(block.body);
      if (!title || !body) return null;
      const out: AnyRecord = { id, type: 'explanation', title, body };
      if (str(block.eyebrow)) out.eyebrow = block.eyebrow;
      return out as LessonBlock;
    }
    case 'graph': {
      const expression = str(block.expression);
      if (!expression) return null;
      const out: AnyRecord = {
        id,
        type: 'graph',
        title: str(block.title) ?? 'On the graph',
        expression,
        highlight: typeof block.highlight === 'string' && HIGHLIGHTS.has(block.highlight) ? block.highlight : 'curve',
      };
      if (str(block.subtitle)) out.subtitle = block.subtitle;
      const focusX = num(block.focusX); if (focusX !== null) out.focusX = focusX;
      const domainMin = num(block.domainMin); if (domainMin !== null) out.domainMin = domainMin;
      const domainMax = num(block.domainMax); if (domainMax !== null) out.domainMax = domainMax;
      return out as LessonBlock;
    }
    case 'diagram': {
      if (!Array.isArray(block.nodes)) return null;
      const nodes = block.nodes
        .map((node) => {
          if (!node || typeof node !== 'object') return null;
          const label = str((node as AnyRecord).label);
          if (!label) return null;
          const detail = str((node as AnyRecord).detail);
          return detail ? { label, detail } : { label };
        })
        .filter((node): node is { label: string; detail?: string } => node !== null)
        .slice(0, 8);
      if (nodes.length < 2) return null;
      return { id, type: 'diagram', title: str(block.title) ?? 'Concept map', nodes } as LessonBlock;
    }
    case 'sketch': {
      if (!Array.isArray(block.marks)) return null;
      const marks = block.marks.map(coerceMark).filter(Boolean).slice(0, 12);
      if (marks.length < 1) return null;
      const out: AnyRecord = {
        id,
        type: 'sketch',
        title: str(block.title) ?? 'On the board',
        layout: typeof block.layout === 'string' && LAYOUTS.has(block.layout) ? block.layout : 'flow',
        marks,
      };
      if (str(block.caption)) out.caption = block.caption;
      return out as LessonBlock;
    }
    case 'simulation': {
      if (!Array.isArray(block.frames)) return null;
      const frames = block.frames
        .map((frame) => {
          if (!frame || typeof frame !== 'object') return null;
          const f = frame as AnyRecord;
          const label = str(f.label);
          if (!label || !Array.isArray(f.marks)) return null;
          const marks = f.marks.map(coerceMark).filter(Boolean).slice(0, 8);
          if (marks.length < 1) return null;
          return { label, caption: str(f.caption) ?? '', marks };
        })
        .filter(Boolean)
        .slice(0, 5);
      if (frames.length < 1) return null;
      return { id, type: 'simulation', title: str(block.title) ?? 'Watch it change', frames } as LessonBlock;
    }
    case 'freeBody': {
      const objectLabel = str(block.objectLabel);
      if (!objectLabel || !Array.isArray(block.forces)) return null;
      const forces = block.forces
        .map((force, forceIndex) => {
          if (!force || typeof force !== 'object') return null;
          const f = force as AnyRecord;
          const label = str(f.label);
          const direction = typeof f.direction === 'string' && DIRECTIONS.has(f.direction) ? f.direction : null;
          if (!label || !direction) return null;
          const out: AnyRecord = { id: str(f.id) ?? `force-${forceIndex}`, label, direction };
          if (str(f.magnitude)) out.magnitude = f.magnitude;
          if (typeof f.tone === 'string' && TONES.has(f.tone)) out.tone = f.tone;
          return out;
        })
        .filter(Boolean)
        .slice(0, 6);
      if (forces.length < 1) return null;
      const out: AnyRecord = { id, type: 'freeBody', title: str(block.title) ?? 'Forces at work', objectLabel, forces };
      if (str(block.surface)) out.surface = block.surface;
      if (str(block.motion)) out.motion = block.motion;
      if (str(block.equation)) out.equation = block.equation;
      return out as LessonBlock;
    }
    case 'equation': {
      if (!Array.isArray(block.givens) || !Array.isArray(block.steps)) return null;
      const givens = block.givens.filter((given): given is string => typeof given === 'string' && given.trim().length > 0).slice(0, 6);
      const steps = block.steps
        .map((step) => {
          if (!step || typeof step !== 'object') return null;
          const s = step as AnyRecord;
          const left = str(s.left);
          const right = str(s.right);
          if (!left || !right) return null;
          const note = str(s.note);
          return note ? { left, right, note } : { left, right };
        })
        .filter(Boolean)
        .slice(0, 6);
      if (givens.length < 1 || steps.length < 1) return null;
      return {
        id,
        type: 'equation',
        title: str(block.title) ?? 'Work it out',
        givens,
        steps,
        result: str(block.result) ?? '…',
      } as LessonBlock;
    }
    case 'steps': {
      if (!Array.isArray(block.steps)) return null;
      const steps = block.steps.filter((step): step is string => typeof step === 'string' && step.trim().length > 0).slice(0, 8);
      if (steps.length < 2) return null;
      return { id, type: 'steps', title: str(block.title) ?? 'How to think it through', steps } as LessonBlock;
    }
    case 'image': {
      // Caption streams in after prompt and alt, so a captioned block means the
      // prompt is complete — only then is it safe to kick off image generation.
      const prompt = str(block.prompt);
      const alt = str(block.alt);
      const caption = str(block.caption);
      if (!prompt || prompt.length < 12 || !alt || !caption) return null;
      const out: AnyRecord = {
        id,
        type: 'image',
        title: str(block.title) ?? 'A picture for this idea',
        prompt,
        alt,
        caption,
      };
      if (typeof block.style === 'string' && IMAGE_STYLES.has(block.style)) out.style = block.style;
      if (Array.isArray(block.lookFor)) {
        const lookFor = block.lookFor.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 4);
        if (lookFor.length > 0) out.lookFor = lookFor;
      }
      return out as LessonBlock;
    }
    case 'quiz': {
      // Quizzes only appear once fully formed, so kids never interact with a half-written check.
      const question = str(block.question);
      const explanation = str(block.explanation);
      if (!question || !explanation || !Array.isArray(block.choices)) return null;
      const choices = block.choices.filter((choice): choice is string => typeof choice === 'string' && choice.trim().length > 0).slice(0, 5);
      const answerIndex = num(block.answerIndex);
      if (choices.length < 2 || answerIndex === null || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= choices.length) return null;
      return { id, type: 'quiz', question, choices, answerIndex, explanation } as LessonBlock;
    }
    default:
      return null;
  }
}

export function toLessonView(partial: PartialLesson | Lesson | null | undefined): LessonView | null {
  if (!partial || typeof partial !== 'object') return null;
  const blocks = Array.isArray(partial.blocks)
    ? partial.blocks.map((block, index) => coerceBlock(block, index)).filter((block): block is LessonBlock => block !== null)
    : [];

  const title = str(partial.title);
  if (!title && blocks.length === 0) return null;

  return {
    id: str(partial.id) ?? 'board',
    title: title ?? '…',
    subject: str(partial.subject) ?? 'ClassroomPanel',
    objective: str(partial.objective) ?? '',
    tutorMessage: str(partial.tutorMessage) ?? undefined,
    blocks,
  };
}
