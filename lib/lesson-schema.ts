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
  highlight: z.enum(['tangent', 'area', 'point', 'slope']),
  focusX: z.number().optional(),
});

export const diagramBlockSchema = z.object({
  id: z.string(),
  type: z.literal('diagram'),
  title: z.string(),
  nodes: z.array(z.object({ label: z.string(), detail: z.string().optional() })).min(2).max(8),
});

export const stepsBlockSchema = z.object({
  id: z.string(),
  type: z.literal('steps'),
  title: z.string(),
  steps: z.array(z.string()).min(2).max(8),
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
  stepsBlockSchema,
  quizBlockSchema,
]);

export const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string(),
  objective: z.string(),
  blocks: z.array(lessonBlockSchema).min(3).max(8),
});

export type Lesson = z.infer<typeof lessonSchema>;
export type LessonBlock = z.infer<typeof lessonBlockSchema>;

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
