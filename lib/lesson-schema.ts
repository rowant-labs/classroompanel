import { z } from 'zod';

export const explanationBlockSchema = z.object({
  id: z.string(),
  type: z.literal('explanation'),
  eyebrow: z.string().optional(),
  title: z.string(),
  body: z.string(),
});

export const graphBlockSchema = z.object({
  id: z.string(),
  type: z.literal('graph'),
  title: z.string(),
  subtitle: z.string().optional(),
  expression: z.string(),
  highlight: z.enum(['tangent', 'area', 'point', 'slope', 'curve']),
  focusX: z.number().optional(),
  domainMin: z.number().optional(),
  domainMax: z.number().optional(),
});

export const diagramBlockSchema = z.object({
  id: z.string(),
  type: z.literal('diagram'),
  title: z.string(),
  nodes: z.array(z.object({ label: z.string(), detail: z.string().optional() })).min(2).max(8),
});

export const boardMarkSchema = z.object({
  id: z.string(),
  kind: z.enum(['node', 'arrow', 'label', 'formula', 'highlight']),
  text: z.string(),
  detail: z.string().optional(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(6).max(60).optional(),
  h: z.number().min(5).max(30).optional(),
  toX: z.number().min(0).max(100).optional(),
  toY: z.number().min(0).max(100).optional(),
  tone: z.enum(['chalk', 'gold', 'green', 'blue']).optional(),
});

export const sketchBlockSchema = z.object({
  id: z.string(),
  type: z.literal('sketch'),
  title: z.string(),
  caption: z.string().optional(),
  layout: z.enum(['flow', 'cycle', 'compare', 'map', 'timeline', 'system']),
  marks: z.array(boardMarkSchema).min(3).max(12),
});

export const simulationBlockSchema = z.object({
  id: z.string(),
  type: z.literal('simulation'),
  title: z.string(),
  frames: z.array(z.object({
    label: z.string(),
    caption: z.string(),
    marks: z.array(boardMarkSchema).min(2).max(8),
  })).min(2).max(5),
});

export const physicsVectorSchema = z.object({
  id: z.string(),
  label: z.string(),
  direction: z.enum(['left', 'right', 'up', 'down', 'up-left', 'up-right', 'down-left', 'down-right']),
  magnitude: z.string().optional(),
  tone: z.enum(['chalk', 'gold', 'green', 'blue']).optional(),
});

export const freeBodyBlockSchema = z.object({
  id: z.string(),
  type: z.literal('freeBody'),
  title: z.string(),
  objectLabel: z.string(),
  surface: z.string().optional(),
  motion: z.string().optional(),
  equation: z.string().optional(),
  forces: z.array(physicsVectorSchema).min(1).max(6),
});

export const equationBlockSchema = z.object({
  id: z.string(),
  type: z.literal('equation'),
  title: z.string(),
  givens: z.array(z.string()).min(1).max(6),
  steps: z.array(z.object({
    left: z.string(),
    right: z.string(),
    note: z.string().optional(),
  })).min(1).max(6),
  result: z.string(),
});

export const stepsBlockSchema = z.object({
  id: z.string(),
  type: z.literal('steps'),
  title: z.string(),
  steps: z.array(z.string()).min(2).max(8),
});

// A generated picture taped to the board — for subjects chalk can't draw well
// (anatomy, geography, art, artifacts, animals, machines, architecture).
// Field order matters for streaming: "caption" arrives after "prompt" and
// "alt", so the client treats a block with a caption as safe to generate from.
export const imageBlockSchema = z.object({
  id: z.string(),
  type: z.literal('image'),
  title: z.string(),
  prompt: z.string().min(12),
  alt: z.string().min(8),
  style: z.enum(['photo', 'illustration', 'diagram', 'cutaway', 'map']).optional(),
  caption: z.string(),
  lookFor: z.array(z.string()).max(4).optional(),
});

export const quizBlockSchema = z.object({
  id: z.string(),
  type: z.literal('quiz'),
  question: z.string(),
  choices: z.array(z.string()).min(2).max(5),
  answerIndex: z.number().int().min(0),
  explanation: z.string(),
}).refine((block) => block.answerIndex < block.choices.length, {
  message: 'answerIndex must point to an existing choice',
  path: ['answerIndex'],
});

export const lessonBlockSchema = z.discriminatedUnion('type', [
  explanationBlockSchema,
  graphBlockSchema,
  diagramBlockSchema,
  sketchBlockSchema,
  simulationBlockSchema,
  freeBodyBlockSchema,
  equationBlockSchema,
  stepsBlockSchema,
  imageBlockSchema,
  quizBlockSchema,
]);

export const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string(),
  objective: z.string(),
  tutorMessage: z.string().optional(),
  blocks: z.array(lessonBlockSchema).min(3).max(8),
});

export type Lesson = z.infer<typeof lessonSchema>;
export type LessonBlock = z.infer<typeof lessonBlockSchema>;

// Stricter variant used for model structured output. Anthropic's grammar
// compiler caps schemas at 24 optional parameters, so fields the tutor should
// always set anyway are required here. Output remains assignable to Lesson.
const strictMarkSchema = boardMarkSchema.extend({
  tone: z.enum(['chalk', 'gold', 'green', 'blue']),
});

export const lessonStreamSchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string(),
  objective: z.string(),
  tutorMessage: z.string(),
  blocks: z.array(z.discriminatedUnion('type', [
    explanationBlockSchema,
    graphBlockSchema.extend({
      focusX: z.number(),
      domainMin: z.number(),
      domainMax: z.number(),
    }),
    diagramBlockSchema,
    sketchBlockSchema.extend({ marks: z.array(strictMarkSchema).min(3).max(12) }),
    simulationBlockSchema.extend({
      frames: z.array(z.object({
        label: z.string(),
        caption: z.string(),
        marks: z.array(strictMarkSchema).min(2).max(8),
      })).min(2).max(5),
    }),
    freeBodyBlockSchema.extend({
      forces: z.array(physicsVectorSchema.extend({ tone: z.enum(['chalk', 'gold', 'green', 'blue']) })).min(1).max(6),
    }),
    equationBlockSchema,
    stepsBlockSchema,
    imageBlockSchema.extend({
      style: z.enum(['photo', 'illustration', 'diagram', 'cutaway', 'map']),
      lookFor: z.array(z.string()).min(1).max(4),
    }),
    quizBlockSchema,
  ])).min(3).max(8),
});

// Deep partial of a streaming lesson — what the client sees while the tutor is
// still drawing. Block arrays may contain half-formed entries.
export type PartialLesson = {
  id?: string;
  title?: string;
  subject?: string;
  objective?: string;
  tutorMessage?: string;
  blocks?: Array<Partial<LessonBlock> | undefined>;
};

export const derivativeLesson: Lesson = {
  id: 'derivatives-first-look',
  title: 'Derivatives: slope at one instant',
  subject: 'Calculus',
  objective: 'Help a student see that a derivative is the slope of a curve at a single point.',
  blocks: [
    {
      id: 'intro',
      type: 'explanation',
      eyebrow: 'First mental model',
      title: 'A derivative is a speedometer for a graph.',
      body: 'Average slope measures change across an interval. A derivative zooms in until the interval is essentially one point, then asks: how steep is the curve right here?',
    },
    {
      id: 'graph',
      type: 'graph',
      title: 'Watch the tangent line touch once',
      subtitle: 'For y = x², the slope changes as x moves.',
      expression: 'y = x²',
      highlight: 'tangent',
      focusX: 1.2,
    },
    {
      id: 'slope-sketch',
      type: 'sketch',
      title: 'Zooming from average slope to instant slope',
      caption: 'The board can draw the idea as a changing picture, not just text.',
      layout: 'flow',
      marks: [
        { id: 'secant', kind: 'node', text: 'Average slope', detail: 'two points far apart', x: 6, y: 18, w: 24, h: 15, tone: 'chalk' },
        { id: 'zoom', kind: 'arrow', text: 'zoom in', x: 32, y: 26, toX: 50, toY: 26, tone: 'gold' },
        { id: 'tangent', kind: 'node', text: 'Tangent slope', detail: 'one point, same direction', x: 54, y: 17, w: 27, h: 16, tone: 'green' },
        { id: 'formula', kind: 'formula', text: 'derivative = slope right here', x: 18, y: 62, w: 48, h: 12, tone: 'gold' },
        { id: 'mark', kind: 'highlight', text: 'right here', x: 70, y: 58, w: 16, h: 13, tone: 'green' },
      ],
    },
    {
      id: 'diagram',
      type: 'diagram',
      title: 'What the board is showing',
      nodes: [
        { label: 'Curve', detail: 'The whole relationship' },
        { label: 'Point', detail: 'The exact x-value we care about' },
        { label: 'Tangent', detail: 'A line matching the curve’s direction there' },
        { label: 'Derivative', detail: 'The tangent line’s slope' },
      ],
    },
    {
      id: 'steps',
      type: 'steps',
      title: 'How to think through it',
      steps: [
        'Pick a point on the curve.',
        'Place a line that just touches the curve at that point.',
        'Measure the slope of that line.',
        'That slope is the derivative at that point.',
      ],
    },
    {
      id: 'quiz',
      type: 'quiz',
      question: 'If the tangent line is steeper, what does that tell us about the derivative?',
      choices: ['The derivative is larger', 'The derivative is always zero', 'The original curve disappears', 'The x-axis moved'],
      answerIndex: 0,
      explanation: 'The derivative is the slope of the tangent line. Steeper tangent means larger slope.',
    },
  ],
};
