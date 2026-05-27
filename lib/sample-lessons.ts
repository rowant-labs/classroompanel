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
    { id: 'steps', type: 'steps', title: 'How to spot it', steps: [ 'Look for the curve’s lowest or highest point.', 'Find the x-value at that point.', 'Find the y-value at that point.', 'Write the vertex as an ordered pair.' ] },
    { id: 'quiz', type: 'quiz', question: 'On y = x², where is the vertex?', choices: ['(0, 0)', '(1, 1)', '(2, 4)', 'There is no vertex'], answerIndex: 0, explanation: 'The graph bottoms out at the origin, so the vertex is (0, 0).' },
  ],
};

export const sampleLessons = [derivativeLesson, photosynthesisLesson, quadraticLesson];

export function findSampleLesson(topic: string): Lesson {
  const normalized = topic.toLowerCase();
  if (normalized.includes('photo') || normalized.includes('plant') || normalized.includes('bio')) return photosynthesisLesson;
  if (normalized.includes('quad') || normalized.includes('parabola') || normalized.includes('vertex')) return quadraticLesson;
  return derivativeLesson;
}
