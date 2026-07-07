import {
  createLearnerRecord,
  recordBoardDrawn,
  recordQuizAttempt,
  addCourseToRecord,
  masteryOf,
  conceptForCourseLesson,
  conceptKeyForCourseLesson,
  conceptKeyForTopic,
  dueConcepts,
  summarizeMastery,
  courseFrontier,
  flatLessonIndex,
  serializeLearnerRecord,
  parseLearnerRecord,
  migrateFromLegacySession,
  REVIEW_INTERVALS_DAYS,
  RETENTION_GAP_MS,
  MAX_RECORD_ATTEMPTS,
  type ConceptRef,
} from '../lib/learner-record';
import type { Course } from '../lib/course-schema';
import { isDeepStrictEqual } from 'node:util';

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label);
}

const T0 = new Date('2026-07-05T09:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const later = (ms: number) => new Date(T0.getTime() + ms);

const course: Course = {
  id: 'course-1',
  title: 'Physics Basics',
  subject: 'Physics',
  gradeBand: 'Grades 6-8',
  overview: 'Motion and forces.',
  units: [
    {
      id: 'u1',
      title: 'Motion',
      summary: 'How things move.',
      lessons: [
        { id: 'l1', title: 'Speed', objective: 'Compute speed.', boardPrompt: 'Teach speed.' },
        { id: 'l2', title: 'Acceleration', objective: 'Feel acceleration.', boardPrompt: 'Teach acceleration.' },
      ],
    },
    {
      id: 'u2',
      title: 'Forces',
      summary: 'Pushes and pulls.',
      lessons: [
        { id: 'l3', title: 'Gravity', objective: 'Understand gravity.', boardPrompt: 'Teach gravity.' },
      ],
    },
  ],
};

const l1Ref: ConceptRef = {
  key: conceptKeyForCourseLesson('course-1', 'l1'),
  kind: 'course-lesson',
  courseId: 'course-1',
  lessonId: 'l1',
  title: 'Speed',
  subject: 'Physics',
};

// --- Board drawn creates a learning-stage concept with a next-day check ---
let record = createLearnerRecord(T0);
record = recordBoardDrawn(record, l1Ref, T0);
const afterBoard = conceptForCourseLesson(record, 'course-1', 'l1');
assert(masteryOf(afterBoard) === 'learning', 'a drawn board puts the concept in learning');
assert(afterBoard?.dueAt !== undefined, 'a drawn board schedules a retrieval check');
assert(Date.parse(afterBoard?.dueAt as string) === T0.getTime() + DAY, 'unanswered board check is due in one day');
assert(masteryOf(undefined) === 'new', 'unknown concepts are new');

// --- Drawing a board never marks completion (the old done-on-draw bug) ---
assert(courseFrontier(record, course) === 0, 'drawing a board must not advance the frontier');

// --- A correct answer reaches proficient, never mastered same-session ---
record = recordQuizAttempt(record, l1Ref, { id: 'a1', question: 'q', chosen: '5 m/s', correct: true }, later(HOUR));
let l1 = conceptForCourseLesson(record, 'course-1', 'l1');
assert(masteryOf(l1) === 'proficient', 'first correct answer reaches proficient');
assert(Date.parse(l1?.dueAt as string) === later(HOUR).getTime() + REVIEW_INTERVALS_DAYS[0] * DAY, 'first correct schedules stage-0 gap');

// Repeat corrects within the same sitting must NOT reach mastered.
record = recordQuizAttempt(record, l1Ref, { id: 'a2', question: 'q', chosen: '5 m/s', correct: true }, later(2 * HOUR));
record = recordQuizAttempt(record, l1Ref, { id: 'a3', question: 'q', chosen: '5 m/s', correct: true }, later(3 * HOUR));
l1 = conceptForCourseLesson(record, 'course-1', 'l1');
assert(masteryOf(l1) === 'proficient', 'cramming in one sitting cannot reach mastered');

// --- Retention across the gap earns mastered ---
record = recordQuizAttempt(record, l1Ref, { id: 'a4', question: 'q', chosen: '5 m/s', correct: true }, later(RETENTION_GAP_MS + HOUR));
l1 = conceptForCourseLesson(record, 'course-1', 'l1');
assert(masteryOf(l1) === 'mastered', 'a spaced correct answer earns mastered');

// --- A miss drops mastery back to learning and resets the schedule ---
record = recordQuizAttempt(record, l1Ref, { id: 'a5', question: 'q', chosen: 'wrong', correct: false }, later(RETENTION_GAP_MS + 2 * HOUR));
l1 = conceptForCourseLesson(record, 'course-1', 'l1');
assert(masteryOf(l1) === 'learning', 'a miss drops the concept back to learning');
assert(l1?.stage === 0, 'a miss resets the Leitner stage');
const missDue = Date.parse(l1?.dueAt as string) - later(RETENTION_GAP_MS + 2 * HOUR).getTime();
assert(missDue > 0 && missDue <= 15 * 60 * 1000, 'a missed concept re-queues within minutes');

// --- Earning it back after a miss: proficient again, spacedCorrect persists ---
record = recordQuizAttempt(record, l1Ref, { id: 'a6', question: 'q', chosen: '5 m/s', correct: true }, later(RETENTION_GAP_MS + 3 * HOUR));
l1 = conceptForCourseLesson(record, 'course-1', 'l1');
assert(masteryOf(l1) === 'mastered', 'recovering after a miss restores mastered (retention was already shown)');

// --- Stage ladder grows the gap on consecutive correct answers ---
let ladder = createLearnerRecord(T0);
const topicRef: ConceptRef = { key: conceptKeyForTopic('Photosynthesis'), kind: 'topic', title: 'Photosynthesis' };
let cursor = T0;
for (let i = 0; i < REVIEW_INTERVALS_DAYS.length + 2; i += 1) {
  ladder = recordQuizAttempt(ladder, topicRef, { id: `s${i}`, question: 'q', chosen: 'c', correct: true }, cursor);
  const concept = ladder.concepts[topicRef.key];
  const expectedGap = REVIEW_INTERVALS_DAYS[Math.min(i, REVIEW_INTERVALS_DAYS.length - 1)] * DAY;
  assert(Date.parse(concept.dueAt as string) - cursor.getTime() === expectedGap, `correct #${i + 1} schedules a ${expectedGap / DAY}-day gap`);
  cursor = new Date(Date.parse(concept.dueAt as string));
}

// --- Due queue: filtering and ordering ---
let dueRec = createLearnerRecord(T0);
dueRec = recordQuizAttempt(dueRec, { key: conceptKeyForTopic('Alpha'), kind: 'topic', title: 'Alpha' }, { id: 'd1', question: 'q', chosen: 'c', correct: true }, T0);
dueRec = recordQuizAttempt(dueRec, { key: conceptKeyForTopic('Beta'), kind: 'topic', title: 'Beta' }, { id: 'd2', question: 'q', chosen: 'c', correct: false }, T0);
assert(dueConcepts(dueRec, T0).length === 0, 'nothing is due immediately after answering');
const soon = dueConcepts(dueRec, later(HOUR));
assert(soon.length === 1 && soon[0].title === 'Beta', 'the missed concept comes due within the hour');
const tomorrow = dueConcepts(dueRec, later(DAY + HOUR));
assert(tomorrow.length === 2, 'both concepts due after a day');
assert(tomorrow[0].title === 'Beta', 'due queue is ordered oldest-due first');

// --- Summary counts ---
const summary = summarizeMastery(dueRec, later(HOUR));
assert(summary.proficient === 1 && summary.learning === 1 && summary.dueForReview === 1, 'summary counts mastery and due items');

// --- Course frontier gating ---
let gate = createLearnerRecord(T0);
assert(courseFrontier(gate, course) === 0, 'fresh course gates at the first lesson');
gate = recordQuizAttempt(gate, l1Ref, { id: 'g1', question: 'q', chosen: 'c', correct: true }, T0);
assert(courseFrontier(gate, course) === 1, 'proficient first lesson advances the frontier');
const l2Ref: ConceptRef = { key: conceptKeyForCourseLesson('course-1', 'l2'), kind: 'course-lesson', courseId: 'course-1', lessonId: 'l2', title: 'Acceleration' };
gate = recordQuizAttempt(gate, l2Ref, { id: 'g2', question: 'q', chosen: 'c', correct: false }, T0);
assert(courseFrontier(gate, course) === 1, 'a missed lesson holds the frontier');
gate = recordQuizAttempt(gate, l2Ref, { id: 'g3', question: 'q', chosen: 'c', correct: true }, later(HOUR));
const l3Ref: ConceptRef = { key: conceptKeyForCourseLesson('course-1', 'l3'), kind: 'course-lesson', courseId: 'course-1', lessonId: 'l3', title: 'Gravity' };
gate = recordQuizAttempt(gate, l3Ref, { id: 'g4', question: 'q', chosen: 'c', correct: true }, later(HOUR));
assert(courseFrontier(gate, course) === 3, 'a fully proficient course unlocks everything');
assert(flatLessonIndex(course, 'l3') === 2, 'flat index spans units in order');
assert(flatLessonIndex(course, 'nope') === -1, 'unknown lesson id yields -1');

// --- Mutators do not mutate their inputs ---
const before = createLearnerRecord(T0);
const frozen = JSON.stringify(before);
recordQuizAttempt(before, topicRef, { id: 'x', question: 'q', chosen: 'c', correct: true }, T0);
recordBoardDrawn(before, topicRef, T0);
addCourseToRecord(before, course, T0);
assert(JSON.stringify(before) === frozen, 'record mutators must not mutate the input record');

// --- Export / import round-trip ---
let porta = createLearnerRecord(T0);
porta = addCourseToRecord(porta, course, T0);
porta = recordBoardDrawn(porta, l1Ref, T0);
porta = recordQuizAttempt(porta, l1Ref, { id: 'p1', question: 'q', chosen: 'c', correct: true }, later(HOUR));
const roundTrip = parseLearnerRecord(serializeLearnerRecord(porta));
assert(roundTrip.ok, 'exported record must re-import');
if (roundTrip.ok) {
  // zod re-emits keys in schema order, so compare structurally, not textually.
  assert(isDeepStrictEqual(roundTrip.record, porta), 'round-trip preserves the record exactly');
}

// --- Import rejects garbage and wrong versions ---
assert(!parseLearnerRecord('not json').ok, 'import rejects non-JSON');
assert(!parseLearnerRecord('{"version":99}').ok, 'import rejects unknown versions');
assert(!parseLearnerRecord('{"version":1,"concepts":"nope"}').ok, 'import rejects malformed records');

// --- addCourseToRecord is idempotent per course id ---
let twice = addCourseToRecord(addCourseToRecord(createLearnerRecord(T0), course, T0), course, later(HOUR));
assert(twice.courses.length === 1, 'the same course is embedded once');

// --- Attempts window is capped, counters are not ---
let capped = createLearnerRecord(T0);
for (let i = 0; i < MAX_RECORD_ATTEMPTS + 25; i += 1) {
  capped = recordQuizAttempt(capped, topicRef, { id: `c${i}`, question: 'q', chosen: 'c', correct: true }, later(i));
}
assert(capped.attempts.length === MAX_RECORD_ATTEMPTS, 'attempt log stays within its cap');
assert(capped.concepts[topicRef.key].correctCount === MAX_RECORD_ATTEMPTS + 25, 'concept counters keep the full count');

// --- Migration from the legacy session blob ---
const migrated = migrateFromLegacySession({
  course,
  done: { l1: true, l2: true },
  attempts: [
    { id: 'm1', at: later(-DAY).toISOString(), boardTitle: 'Speed', subject: 'Physics', question: 'q', chosen: 'c', correct: true, courseLessonId: 'l1' },
    { id: 'm2', at: later(-DAY + HOUR).toISOString(), boardTitle: 'Free topic', subject: 'History', question: 'q', chosen: 'c', correct: false },
  ],
}, T0);
assert(migrated.courses.length === 1, 'migration embeds the course');
assert(masteryOf(conceptForCourseLesson(migrated, 'course-1', 'l1')) === 'proficient', 'migrated correct attempt counts toward mastery');
assert(masteryOf(conceptForCourseLesson(migrated, 'course-1', 'l2')) === 'learning', 'legacy done-on-draw only reaches learning, never proficient');
assert(masteryOf(migrated.concepts[conceptKeyForTopic('Free topic')]) === 'learning', 'ad-hoc legacy attempts migrate as topics');
assert(courseFrontier(migrated, course) === 1, 'migrated record gates on real mastery, not legacy done flags');

console.log('Learner record: all assertions passed.');
