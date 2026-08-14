// Lesson salvage: a mostly-right generation (one bad block, one bad mark)
// must survive as a teachable lesson instead of failing wholesale — this is
// what keeps Gemini-only BYOK sessions from collapsing to errors.
// Run with: npx tsx tests/salvage.test.ts

import assert from 'node:assert/strict';
import { parseLessonJson } from '../lib/lesson-generator';

const goodMark = (id: string, x: number) => ({ id, kind: 'node', text: 'part', x, y: 30, w: 20, h: 10 });

const mostlyGood = {
  id: 'incline-basics',
  title: 'Inclined planes',
  subject: 'Physics',
  objective: 'See how a ramp trades force for distance.',
  tutorMessage: 'Here is the ramp board.',
  blocks: [
    { id: 'intro', type: 'explanation', title: 'The ramp trick', body: 'A ramp lets a small force move a big load.' },
    // One invalid mark (bad kind) among three valid — the block must survive with 3 marks.
    { id: 'sketch', type: 'sketch', title: 'The setup', layout: 'system', marks: [
      goodMark('m1', 10), goodMark('m2', 40), goodMark('m3', 70),
      { id: 'bad', kind: 'sparkle', text: 'nope', x: 50, y: 50 },
    ] },
    // Invalid block type — must be dropped, not sink the lesson.
    { id: 'holo', type: 'hologram', title: 'Not a real block' },
    { id: 'steps', type: 'steps', title: 'Think it through', steps: ['Find the angle', 'Split the forces', 'Compare'] },
    { id: 'quiz', type: 'quiz', question: 'Steeper ramp means…?', choices: ['More force needed', 'Less force needed'], answerIndex: 0, explanation: 'Steeper is harder.' },
  ],
};

{
  const lesson = parseLessonJson('```json\n' + JSON.stringify(mostlyGood) + '\n```');
  assert.equal(lesson.blocks.length, 4, 'invalid block dropped, valid ones kept');
  assert.ok(!lesson.blocks.some((block) => (block as { type: string }).type === 'hologram'));
  const sketch = lesson.blocks.find((block) => block.type === 'sketch');
  assert.ok(sketch && sketch.type === 'sketch');
  assert.equal(sketch.marks.length, 3, 'invalid mark stripped, block salvaged');
}

{
  // A perfectly valid lesson passes straight through untouched.
  const clean = { ...mostlyGood, blocks: mostlyGood.blocks.filter((block) => block.id !== 'holo' && block.id !== 'sketch') };
  const lesson = parseLessonJson(JSON.stringify(clean));
  assert.equal(lesson.blocks.length, 3);
}

{
  // Too little survives → a real failure, thrown, never a fake lesson.
  const hopeless = { ...mostlyGood, blocks: [mostlyGood.blocks[0], { id: 'x', type: 'nope' }] };
  assert.throws(() => parseLessonJson(JSON.stringify(hopeless)), 'a lesson below the schema minimum still fails');
}

{
  assert.throws(() => parseLessonJson('The model wrote prose instead of JSON.'));
}

console.log('Lesson salvage: all assertions passed.');
