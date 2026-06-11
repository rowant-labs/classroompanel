import type { Lesson } from './lesson-schema';
import { derivativeLesson } from './lesson-schema';

export const photosynthesisLesson: Lesson = {
  id: 'photosynthesis-energy-flow',
  title: 'Photosynthesis: turning light into sugar',
  subject: 'Biology',
  objective: 'Show how plants use light, water, and carbon dioxide to make glucose and oxygen.',
  blocks: [
    { id: 'intro', type: 'explanation', eyebrow: 'Big picture', title: 'A leaf is a tiny solar-powered food factory.', body: 'Photosynthesis converts light energy into chemical energy. The plant stores that energy in glucose, while oxygen is released as a byproduct.' },
    { id: 'diagram', type: 'diagram', title: 'Inputs and outputs', nodes: [ { label: 'Sunlight', detail: 'Energy source' }, { label: 'Water', detail: 'Comes from roots' }, { label: 'Carbon dioxide', detail: 'Enters through leaf pores' }, { label: 'Glucose', detail: 'Stored energy / food' }, { label: 'Oxygen', detail: 'Released into air' } ] },
    {
      id: 'leaf-sketch',
      type: 'sketch',
      title: 'Draw the leaf like a tiny factory',
      caption: 'Inputs move into the leaf, then sugar stays while oxygen leaves.',
      layout: 'system',
      marks: [
        { id: 'sun', kind: 'node', text: 'Sunlight', detail: 'energy', x: 8, y: 10, w: 20, h: 13, tone: 'gold' },
        { id: 'water', kind: 'node', text: 'Water', detail: 'from roots', x: 7, y: 68, w: 20, h: 13, tone: 'blue' },
        { id: 'co2', kind: 'node', text: 'CO2', detail: 'from air', x: 8, y: 40, w: 18, h: 13, tone: 'chalk' },
        { id: 'leaf', kind: 'node', text: 'Leaf', detail: 'chlorophyll does the work', x: 38, y: 35, w: 27, h: 20, tone: 'green' },
        { id: 'sugar', kind: 'node', text: 'Glucose', detail: 'stored food', x: 74, y: 30, w: 20, h: 13, tone: 'gold' },
        { id: 'oxygen', kind: 'node', text: 'Oxygen', detail: 'released', x: 74, y: 58, w: 20, h: 13, tone: 'chalk' },
        { id: 'a1', kind: 'arrow', text: 'in', x: 27, y: 17, toX: 40, toY: 37, tone: 'gold' },
        { id: 'a2', kind: 'arrow', text: 'in', x: 27, y: 47, toX: 38, toY: 45, tone: 'chalk' },
        { id: 'a3', kind: 'arrow', text: 'in', x: 27, y: 74, toX: 40, toY: 53, tone: 'blue' },
        { id: 'a4', kind: 'arrow', text: 'makes', x: 65, y: 43, toX: 75, toY: 38, tone: 'green' },
      ],
    },
    { id: 'steps', type: 'steps', title: 'The flow', steps: [ 'Chlorophyll captures light energy.', 'Water molecules split and release oxygen.', 'Carbon dioxide is rearranged into glucose.', 'The plant uses glucose for growth and energy storage.' ] },
    { id: 'quiz', type: 'quiz', question: 'Which molecule stores the energy made during photosynthesis?', choices: ['Glucose', 'Oxygen', 'Nitrogen', 'Salt'], answerIndex: 0, explanation: 'Glucose is the sugar molecule that stores chemical energy for the plant.' },
  ],
};

export const quadraticLesson: Lesson = {
  id: 'quadratics-vertex',
  title: 'Quadratics: finding the turning point',
  subject: 'Algebra',
  objective: 'Help a student understand the vertex as the highest or lowest point of a parabola.',
  blocks: [
    { id: 'intro', type: 'explanation', eyebrow: 'Graph intuition', title: 'The vertex is where the parabola turns around.', body: 'For a quadratic graph, the vertex is the minimum or maximum point. It is the moment the curve stops going one direction and starts going the other.' },
    { id: 'graph', type: 'graph', title: 'A parabola has one clear turning point', subtitle: 'For y = x², the vertex is at the origin.', expression: 'y = x²', highlight: 'point', focusX: 0 },
    {
      id: 'vertex-sim',
      type: 'simulation',
      title: 'Slide along the curve until it turns',
      frames: [
        {
          label: 'Left side',
          caption: 'The graph is still falling as x moves right.',
          marks: [
            { id: 'left', kind: 'node', text: 'falling', x: 16, y: 35, w: 22, h: 13, tone: 'chalk' },
            { id: 'move1', kind: 'arrow', text: 'move right', x: 39, y: 42, toX: 52, toY: 52, tone: 'gold' },
          ],
        },
        {
          label: 'Vertex',
          caption: 'At the turning point the direction changes.',
          marks: [
            { id: 'vertex', kind: 'highlight', text: 'vertex', x: 42, y: 48, w: 22, h: 16, tone: 'green' },
            { id: 'formula', kind: 'formula', text: '(0, 0)', x: 48, y: 28, w: 20, h: 10, tone: 'gold' },
          ],
        },
        {
          label: 'Right side',
          caption: 'After the vertex, the graph rises.',
          marks: [
            { id: 'right', kind: 'node', text: 'rising', x: 62, y: 35, w: 22, h: 13, tone: 'chalk' },
            { id: 'move2', kind: 'arrow', text: 'up', x: 54, y: 52, toX: 66, toY: 36, tone: 'gold' },
          ],
        },
      ],
    },
    { id: 'steps', type: 'steps', title: 'How to spot it', steps: [ 'Look for the curve’s lowest or highest point.', 'Find the x-value at that point.', 'Find the y-value at that point.', 'Write the vertex as an ordered pair.' ] },
    { id: 'quiz', type: 'quiz', question: 'On y = x², where is the vertex?', choices: ['(0, 0)', '(1, 1)', '(2, 4)', 'There is no vertex'], answerIndex: 0, explanation: 'The graph bottoms out at the origin, so the vertex is (0, 0).' },
  ],
};

export const newtonLesson: Lesson = {
  id: 'newtonian-physics-force-acceleration',
  title: 'Newtonian Physics: forces change motion',
  subject: 'Physics',
  objective: 'Show how Newton’s laws connect force, mass, and acceleration using a free-body diagram.',
  blocks: [
    {
      id: 'intro',
      type: 'explanation',
      eyebrow: 'Big idea',
      title: 'Forces are arrows that explain motion.',
      body: 'Newtonian physics predicts everyday motion by tracking pushes and pulls. A net force changes velocity, and the size of that change depends on mass.',
    },
    {
      id: 'free-body',
      type: 'freeBody',
      title: 'Free-body diagram for a pushed cart',
      objectLabel: '4 kg cart',
      surface: 'level floor',
      motion: 'accelerating right',
      equation: 'Fnet = ma',
      forces: [
        { id: 'push', label: 'Push', direction: 'right', magnitude: '12 N', tone: 'gold' },
        { id: 'weight', label: 'Weight', direction: 'down', magnitude: 'mg', tone: 'chalk' },
        { id: 'normal', label: 'Normal', direction: 'up', magnitude: 'N', tone: 'blue' },
        { id: 'accel', label: 'Acceleration', direction: 'right', magnitude: '3 m/s²', tone: 'green' },
      ],
    },
    {
      id: 'equation',
      type: 'equation',
      title: 'Solve the quick force question',
      givens: ['mass = 4 kg', 'net force = 12 N'],
      steps: [
        { left: 'Fnet', right: 'm × a', note: 'Newton’s second law' },
        { left: 'a', right: 'Fnet ÷ m', note: 'isolate acceleration' },
        { left: 'a', right: '12 N ÷ 4 kg', note: 'substitute the givens' },
      ],
      result: 'a = 3 m/s²',
    },
    {
      id: 'steps',
      type: 'steps',
      title: 'How to reason it out',
      steps: [
        'Draw the object by itself.',
        'Add one arrow for each force acting on it.',
        'Combine forces to find the net force.',
        'Use Fnet = ma to connect force, mass, and acceleration.',
      ],
    },
    {
      id: 'quiz',
      type: 'quiz',
      question: 'A 4 kg object experiences a net force of 12 N. What is its acceleration?',
      choices: ['3 m/s²', '8 m/s²', '16 m/s²', '48 m/s²'],
      answerIndex: 0,
      explanation: 'Use a = Fnet / m, so 12 N divided by 4 kg equals 3 m/s².',
    },
  ],
};

export const heartLesson: Lesson = {
  id: 'heart-double-pump',
  title: 'The heart: a double pump on one beat',
  subject: 'Anatomy',
  objective: 'Show that the heart is two pumps working side by side — one sends blood to the lungs, the other to the body.',
  blocks: [
    {
      id: 'intro',
      type: 'explanation',
      eyebrow: 'Big picture',
      title: 'Your heart is two pumps glued together.',
      body: 'The right side collects tired, oxygen-poor blood and pushes it to the lungs. The left side takes the freshly oxygenated blood and pushes it out to the whole body. Both pumps squeeze on the same beat.',
    },
    {
      id: 'heart-photo',
      type: 'image',
      title: 'See the real structure',
      prompt: 'A cutaway cross-section of a human heart showing all four chambers — two atria on top and two larger ventricles below — with the thick muscular wall of the left ventricle clearly visible, anatomically accurate.',
      alt: 'A cross-section of a human heart with four chambers visible: two smaller atria at the top and two larger ventricles at the bottom. The wall of the left ventricle is noticeably thicker than the right.',
      style: 'cutaway',
      caption: 'Four chambers, two pumps: the right side is plumbed to the lungs, the left side to everything else.',
      lookFor: ['Two small atria on top', 'Two big ventricles below', 'Thicker left ventricle wall'],
    },
    {
      id: 'flow-sketch',
      type: 'sketch',
      title: 'Follow one drop of blood',
      caption: 'The loop passes through the heart twice — once on each side.',
      layout: 'cycle',
      marks: [
        { id: 'body', kind: 'node', text: 'Body', detail: 'oxygen used up', x: 6, y: 40, w: 18, h: 14, tone: 'chalk' },
        { id: 'right', kind: 'node', text: 'Right side', detail: 'collects tired blood', x: 32, y: 14, w: 20, h: 14, tone: 'blue' },
        { id: 'lungs', kind: 'node', text: 'Lungs', detail: 'oxygen loaded', x: 62, y: 14, w: 18, h: 14, tone: 'green' },
        { id: 'left', kind: 'node', text: 'Left side', detail: 'pushes fresh blood out', x: 62, y: 64, w: 20, h: 14, tone: 'gold' },
        { id: 'a1', kind: 'arrow', text: 'in', x: 24, y: 38, toX: 34, toY: 26, tone: 'blue' },
        { id: 'a2', kind: 'arrow', text: 'to lungs', x: 52, y: 20, toX: 62, toY: 20, tone: 'blue' },
        { id: 'a3', kind: 'arrow', text: 'back', x: 72, y: 28, toX: 72, toY: 62, tone: 'green' },
        { id: 'a4', kind: 'arrow', text: 'to body', x: 60, y: 72, toX: 22, toY: 52, tone: 'gold' },
      ],
    },
    {
      id: 'steps',
      type: 'steps',
      title: 'One full lap',
      steps: [
        'Tired blood from the body enters the right atrium.',
        'The right ventricle pumps it to the lungs to pick up oxygen.',
        'Fresh blood returns to the left atrium.',
        'The powerful left ventricle pumps it out to the whole body.',
      ],
    },
    {
      id: 'quiz',
      type: 'quiz',
      question: 'Why is the left ventricle wall thicker than the right?',
      choices: [
        'It pumps blood to the whole body, which takes more force',
        'It holds more blood than the other chambers',
        'It beats more often than the right side',
        'It stores extra oxygen for emergencies',
      ],
      answerIndex: 0,
      explanation: 'Both sides beat together, but the left ventricle pushes blood through the entire body, so it needs much stronger muscle than the right ventricle, which only reaches the nearby lungs.',
    },
  ],
};

export const sampleLessons = [derivativeLesson, photosynthesisLesson, quadraticLesson, newtonLesson, heartLesson];

export function findSampleLesson(topic: string): Lesson {
  const normalized = topic.toLowerCase();
  if (normalized.includes('heart') || normalized.includes('anatomy') || normalized.includes('blood') || normalized.includes('body')) return heartLesson;
  if (normalized.includes('newton') || normalized.includes('force') || normalized.includes('physics') || normalized.includes('acceleration')) return newtonLesson;
  if (normalized.includes('photo') || normalized.includes('plant') || normalized.includes('bio')) return photosynthesisLesson;
  if (normalized.includes('quad') || normalized.includes('parabola') || normalized.includes('vertex')) return quadraticLesson;
  return derivativeLesson;
}
