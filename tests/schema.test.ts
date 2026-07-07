import { lessonSchema } from '../lib/lesson-schema';
import { sampleLessons } from '../lib/sample-lessons';
import { toLessonView } from '../lib/lesson-view';

for (const lesson of sampleLessons) {
  const parsed = lessonSchema.safeParse(lesson);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error(`Invalid lesson fixture: ${lesson.id}`);
  }
}

// Streaming safety for interactive do-blocks: a half-written predict (no
// reveal yet) or selfExplain (no exemplar yet) must not render, so a student
// can never commit to a block that can't answer back.
function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label);
}

const streamingView = toLessonView({
  title: 'Streaming',
  blocks: [
    { id: 'p1', type: 'predict', setup: 'A ball rolls to a cliff edge.', question: 'What path does it take after leaving the edge?', choices: ['Straight down', 'A curve'], answerIndex: 1 },
    { id: 's1', type: 'selfExplain', prompt: 'Explain projectile motion in your own words.', keyPoints: ['Horizontal motion continues', 'Gravity pulls down'] },
  ],
});
assert((streamingView?.blocks.length ?? -1) === 0, 'half-formed do-blocks are dropped mid-stream');

const completeView = toLessonView({
  title: 'Complete',
  blocks: [
    { id: 'p1', type: 'predict', setup: 'A ball rolls to a cliff edge.', question: 'What path after the edge?', choices: ['Straight down', 'A curve'], answerIndex: 1, reveal: 'It curves — forward motion continues while gravity pulls down.' },
    { id: 's1', type: 'selfExplain', prompt: 'Explain projectile motion.', keyPoints: ['Horizontal motion continues', 'Gravity pulls down'], exemplar: 'It keeps moving forward while gravity bends its path into a curve.' },
    { id: 'bad', type: 'predict', setup: 'x', question: 'y', choices: ['only'], answerIndex: 3, reveal: 'z' },
  ],
});
assert((completeView?.blocks.length ?? -1) === 2, 'complete do-blocks render; malformed ones are dropped');
assert(completeView?.blocks[0].type === 'predict' && completeView.blocks[1].type === 'selfExplain', 'do-block types survive coercion');

// A blank choice must reject the whole block, never silently shift indices —
// a shifted answerIndex would grade the student against the wrong choice.
const blankChoice = toLessonView({
  title: 'Blanks',
  blocks: [
    { id: 'p', type: 'predict', setup: 's', question: 'q', choices: ['  ', 'It floats', 'It sinks'], answerIndex: 1, reveal: 'r' },
    { id: 'q', type: 'quiz', question: 'q', choices: ['', 'Right', 'Wrong'], answerIndex: 1, explanation: 'e' },
  ],
});
assert((blankChoice?.blocks.length ?? -1) === 0, 'blocks with blank choices are dropped, not index-shifted');

console.log(`Validated ${sampleLessons.length} lesson fixtures.`);
