import {
  createLearnerRecord,
  recordBoardDrawn,
  recordPracticeEvent,
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
  isLessonLocked,
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
// Stage is documented as "index of the NEXT gap" — it must stay a valid index
// no matter how long the streak, so exported records never hold gap[stage] = undefined.
assert(ladder.concepts[topicRef.key].stage === REVIEW_INTERVALS_DAYS.length - 1, 'stage caps at the last valid gap index');

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

// --- Regression never re-locks earned content ---
// gate currently has l1..l3 proficient. A missed spaced review on l1 pulls the
// frontier back — but l2/l3 were demonstrated and must stay open.
gate = recordQuizAttempt(gate, l1Ref, { id: 'g5', question: 'q', chosen: 'wrong', correct: false }, later(2 * HOUR));
assert(courseFrontier(gate, course) === 0, 'a regressed early lesson pulls the frontier back');
assert(!isLessonLocked(gate, course, 'l1'), 'the frontier lesson itself is open');
assert(!isLessonLocked(gate, course, 'l2') && !isLessonLocked(gate, course, 'l3'), 'earned lessons never re-lock after an early regression');
const freshGate = createLearnerRecord(T0);
assert(!isLessonLocked(freshGate, course, 'l1'), 'the first lesson starts open');
assert(isLessonLocked(freshGate, course, 'l2') && isLessonLocked(freshGate, course, 'l3'), 'unearned lessons past the frontier stay locked');

// --- Practice events (predict / selfExplain) are evidence, never grades ---
// The honesty rule: wrong predictions and self-marked gaps must never punish
// mastery, or students learn to stop predicting and stop being honest.
let practice = createLearnerRecord(T0);
practice = recordBoardDrawn(practice, l1Ref, T0);
practice = recordQuizAttempt(practice, l1Ref, { id: 'pq1', question: 'q', chosen: 'c', correct: true }, later(HOUR));
const graded = practice.concepts[l1Ref.key];
const gradedSnapshot = {
  correctCount: graded.correctCount,
  incorrectCount: graded.incorrectCount,
  streak: graded.streak,
  stage: graded.stage,
  dueAt: graded.dueAt,
  spacedCorrect: graded.spacedCorrect,
};
practice = recordPracticeEvent(practice, l1Ref, { id: 'pp1', kind: 'predict', prompt: 'What happens?', response: 'It falls', correct: false }, later(2 * HOUR));
practice = recordPracticeEvent(practice, l1Ref, { id: 'pp2', kind: 'selfExplain', prompt: 'Say it back', response: 'Speed is distance over time', correct: false }, later(3 * HOUR));
const afterPractice = practice.concepts[l1Ref.key];
assert(masteryOf(afterPractice) === 'proficient', 'wrong practice never demotes mastery');
assert(
  afterPractice.correctCount === gradedSnapshot.correctCount &&
  afterPractice.incorrectCount === gradedSnapshot.incorrectCount &&
  afterPractice.streak === gradedSnapshot.streak &&
  afterPractice.stage === gradedSnapshot.stage &&
  afterPractice.dueAt === gradedSnapshot.dueAt &&
  afterPractice.spacedCorrect === gradedSnapshot.spacedCorrect,
  'practice events leave counters, streak, stage, and schedule untouched',
);
assert(afterPractice.lastAttemptAt === later(3 * HOUR).toISOString(), 'practice keeps last-seen truthful');
assert(practice.attempts.length === 3, 'practice events land in the evidence window');
assert(practice.attempts[1].kind === 'predict' && practice.attempts[2].kind === 'selfExplain', 'practice attempts carry their kind');
assert(practice.attempts[0].kind === 'quiz', 'graded attempts are stamped quiz');

// A practice event on a NEVER-seen concept marks it learning (they did something).
let freshPractice = createLearnerRecord(T0);
freshPractice = recordPracticeEvent(freshPractice, topicRef, { id: 'pp3', kind: 'predict', prompt: 'q', response: 'r', correct: true }, T0);
assert(masteryOf(freshPractice.concepts[topicRef.key]) === 'learning', 'a practice act on a new concept reaches learning, never proficient');
assert(courseFrontier(recordPracticeEvent(createLearnerRecord(T0), l1Ref, { id: 'pp4', kind: 'predict', prompt: 'q', response: 'r', correct: true }, T0), course) === 0,
  'a correct prediction alone never advances the course frontier');

// Practice attempts round-trip (kind survives export/import), and records
// written before the kind field existed still parse.
const practiceTrip = parseLearnerRecord(serializeLearnerRecord(practice));
assert(practiceTrip.ok && isDeepStrictEqual(practiceTrip.ok ? practiceTrip.record : null, practice), 'practice kinds survive the round-trip');
const legacyAttempt = JSON.parse(serializeLearnerRecord(practice));
for (const attempt of legacyAttempt.attempts) delete attempt.kind;
assert(parseLearnerRecord(JSON.stringify(legacyAttempt)).ok, 'records without kind (older writers) still import');

// --- Mutators do not mutate their inputs ---
const before = createLearnerRecord(T0);
const frozen = JSON.stringify(before);
recordQuizAttempt(before, topicRef, { id: 'x', question: 'q', chosen: 'c', correct: true }, T0);
recordBoardDrawn(before, topicRef, T0);
recordPracticeEvent(before, topicRef, { id: 'x2', kind: 'predict', prompt: 'q', response: 'r', correct: true }, T0);
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

// Post-do-block sessions carry practice attempts (kind predict/selfExplain);
// re-migration must replay them as PRACTICE, never as graded quiz answers.
const remigrated = migrateFromLegacySession({
  course,
  attempts: [
    { id: 'r1', at: later(-DAY).toISOString(), boardTitle: 'Speed', question: 'guess', chosen: 'wrong guess', correct: false, kind: 'predict', courseLessonId: 'l1' },
    { id: 'r2', at: later(-DAY + HOUR).toISOString(), boardTitle: 'Speed', question: 'say it', chosen: 'my words', correct: false, kind: 'selfExplain', courseLessonId: 'l1' },
    { id: 'r3', at: later(-DAY + 2 * HOUR).toISOString(), boardTitle: 'Speed', question: 'q', chosen: 'c', correct: true, kind: 'quiz', courseLessonId: 'l1' },
  ],
}, T0);
const remigratedL1 = conceptForCourseLesson(remigrated, 'course-1', 'l1');
assert(remigratedL1?.incorrectCount === 0, 'migrated practice misses never count as graded misses');
assert(remigratedL1?.correctCount === 1 && masteryOf(remigratedL1) === 'proficient', 'migrated quiz attempts still grade');
assert(remigrated.attempts.filter((a) => a.kind === 'predict' || a.kind === 'selfExplain').length === 2, 'migrated practice attempts keep their kind');

console.log('Learner record: all assertions passed.');
