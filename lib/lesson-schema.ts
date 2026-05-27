export type LessonBlock =
  | ExplanationBlock
  | GraphBlock
  | DiagramBlock
  | StepsBlock
  | QuizBlock;

export type Lesson = {
  id: string;
  title: string;
  subject: string;
  objective: string;
  blocks: LessonBlock[];
};

export type ExplanationBlock = {
  id: string;
  type: 'explanation';
  eyebrow?: string;
  title: string;
  body: string;
};

export type GraphBlock = {
  id: string;
  type: 'graph';
  title: string;
  subtitle?: string;
  expression: string;
  highlight: 'tangent' | 'area' | 'point' | 'slope';
};

export type DiagramBlock = {
  id: string;
  type: 'diagram';
  title: string;
  nodes: Array<{ label: string; detail?: string }>;
};

export type StepsBlock = {
  id: string;
  type: 'steps';
  title: string;
  steps: string[];
};

export type QuizBlock = {
  id: string;
  type: 'quiz';
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
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
