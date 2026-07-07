import { z } from 'zod';
import type { Course } from '@/lib/course-schema';

// The learner record: the portable, versioned document that holds everything
// the harness knows about a learner's mastery — per-concept state, attempt
// history, and the spaced-review schedule. This is the appreciating asset the
// product is built around (docs/VISION.md), so it lives apart from UI session
// state, survives "New session", and exports/imports as plain JSON.
// Format spec: docs/learner-record.md. Bump `version` on breaking changes and
// add a migration in parseLearnerRecord.

export const LEARNER_RECORD_VERSION = 1;

// Review gaps per Leitner stage: a correct answer at stage N schedules the
// next review INTERVALS_DAYS[N] out and advances the stage; a miss drops the
// concept back to stage 0 and re-queues it in minutes, not days.
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60] as const;
const MISS_RETRY_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// A concept only counts as MASTERED after a correct answer at least this long
// after the first correct answer — retention demonstrated across a real gap,
// not within one sitting. 20h (not 24) so "next morning" reviews qualify.
export const RETENTION_GAP_MS = 20 * 60 * 60 * 1000;

export const masteryLevels = ['new', 'learning', 'proficient', 'mastered'] as const;
export type MasteryLevel = (typeof masteryLevels)[number];

export const conceptStateSchema = z.object({
  id: z.string(),
  kind: z.enum(['course-lesson', 'topic']),
  courseId: z.string().optional(),
  lessonId: z.string().optional(),
  title: z.string(),
  subject: z.string().optional(),
  introducedAt: z.string(),
  lastAttemptAt: z.string().optional(),
  firstCorrectAt: z.string().optional(),
  lastCorrectAt: z.string().optional(),
  correctCount: z.number().int().min(0),
  incorrectCount: z.number().int().min(0),
  // Consecutive correct answers; a miss resets it to 0.
  streak: z.number().int().min(0),
  // Leitner stage — index into REVIEW_INTERVALS_DAYS for the NEXT gap.
  stage: z.number().int().min(0),
  dueAt: z.string().optional(),
  // Set permanently once a correct answer lands >= RETENTION_GAP_MS after the
  // first correct one. Mastery = spacedCorrect AND currently on a streak.
  spacedCorrect: z.boolean(),
  boardCount: z.number().int().min(0),
});
export type ConceptState = z.infer<typeof conceptStateSchema>;

export const recordAttemptSchema = z.object({
  id: z.string(),
  at: z.string(),
  conceptId: z.string(),
  question: z.string(),
  chosen: z.string(),
  correct: z.boolean(),
});
export type RecordAttempt = z.infer<typeof recordAttemptSchema>;

export const learnerRecordSchema = z.object({
  version: z.literal(LEARNER_RECORD_VERSION),
  createdAt: z.string(),
  updatedAt: z.string(),
  concepts: z.record(z.string(), conceptStateSchema),
  // Rolling window of raw attempt events, newest last. Concept counters are
  // monotonic and survive this cap.
  attempts: z.array(recordAttemptSchema),
  // Full course outlines embedded so an exported record is self-contained.
  courses: z.array(z.object({ addedAt: z.string(), course: z.unknown() })),
});
export type LearnerRecord = z.infer<typeof learnerRecordSchema>;

export const MAX_RECORD_ATTEMPTS = 500;

export function createLearnerRecord(now: Date): LearnerRecord {
  const at = now.toISOString();
  return { version: LEARNER_RECORD_VERSION, createdAt: at, updatedAt: at, concepts: {}, attempts: [], courses: [] };
}

export function conceptKeyForCourseLesson(courseId: string, lessonId: string): string {
  return `lesson:${courseId}:${lessonId}`;
}

export function conceptKeyForTopic(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `topic:${slug || 'untitled'}`;
}

export type ConceptRef = {
  key: string;
  kind: ConceptState['kind'];
  courseId?: string;
  lessonId?: string;
  title: string;
  subject?: string;
};

function ensureConcept(record: LearnerRecord, ref: ConceptRef, now: Date): ConceptState {
  const existing = record.concepts[ref.key];
  if (existing) {
    // Titles drift as boards get redrawn; keep the freshest human label.
    if (ref.title) existing.title = ref.title;
    if (ref.subject) existing.subject = ref.subject;
    return existing;
  }
  const created: ConceptState = {
    id: ref.key,
    kind: ref.kind,
    courseId: ref.courseId,
    lessonId: ref.lessonId,
    title: ref.title,
    subject: ref.subject,
    introducedAt: now.toISOString(),
    correctCount: 0,
    incorrectCount: 0,
    streak: 0,
    stage: 0,
    spacedCorrect: false,
    boardCount: 0,
  };
  record.concepts[ref.key] = created;
  return created;
}

// All mutators return a NEW record object (with structurally-shared innards
// replaced along the mutation path) so React state updates see a fresh
// reference. Callers must use the returned value.
function cloned(record: LearnerRecord): LearnerRecord {
  return {
    ...record,
    concepts: Object.fromEntries(Object.entries(record.concepts).map(([k, v]) => [k, { ...v }])),
    attempts: [...record.attempts],
    courses: [...record.courses],
  };
}

export function recordBoardDrawn(record: LearnerRecord, ref: ConceptRef, now: Date): LearnerRecord {
  const next = cloned(record);
  const concept = ensureConcept(next, ref, now);
  concept.boardCount += 1;
  // A drawn board with no answered check still deserves a next-day retrieval.
  if (!concept.dueAt && concept.correctCount === 0 && concept.incorrectCount === 0) {
    concept.dueAt = new Date(now.getTime() + DAY_MS).toISOString();
  }
  next.updatedAt = now.toISOString();
  return next;
}

export function recordQuizAttempt(
  record: LearnerRecord,
  ref: ConceptRef,
  attempt: { id: string; question: string; chosen: string; correct: boolean },
  now: Date,
): LearnerRecord {
  const next = cloned(record);
  const concept = ensureConcept(next, ref, now);
  const at = now.toISOString();
  concept.lastAttemptAt = at;
  if (attempt.correct) {
    concept.correctCount += 1;
    concept.streak += 1;
    concept.lastCorrectAt = at;
    if (!concept.firstCorrectAt) {
      concept.firstCorrectAt = at;
    } else if (!concept.spacedCorrect && now.getTime() - Date.parse(concept.firstCorrectAt) >= RETENTION_GAP_MS) {
      concept.spacedCorrect = true;
    }
    const gapDays = REVIEW_INTERVALS_DAYS[Math.min(concept.stage, REVIEW_INTERVALS_DAYS.length - 1)];
    concept.dueAt = new Date(now.getTime() + gapDays * DAY_MS).toISOString();
    concept.stage = Math.min(concept.stage + 1, REVIEW_INTERVALS_DAYS.length);
  } else {
    concept.incorrectCount += 1;
    concept.streak = 0;
    concept.stage = 0;
    concept.dueAt = new Date(now.getTime() + MISS_RETRY_MS).toISOString();
  }
  next.attempts = [...next.attempts, {
    id: attempt.id,
    at,
    conceptId: ref.key,
    question: attempt.question,
    chosen: attempt.chosen,
    correct: attempt.correct,
  }].slice(-MAX_RECORD_ATTEMPTS);
  next.updatedAt = at;
  return next;
}

export function addCourseToRecord(record: LearnerRecord, course: Course, now: Date): LearnerRecord {
  const next = cloned(record);
  if (!next.courses.some((entry) => (entry.course as Course | undefined)?.id === course.id)) {
    next.courses = [...next.courses, { addedAt: now.toISOString(), course }];
  }
  next.updatedAt = now.toISOString();
  return next;
}

// Mastery is derived, never stored:
// - new: never seen
// - learning: seen (board drawn or attempted), but no streak going
// - proficient: at least one correct AND the most recent answer was correct
// - mastered: proficient AND retention shown across >= RETENTION_GAP_MS
// A miss always lands back at learning — the review loop earns it back.
export function masteryOf(concept: ConceptState | undefined): MasteryLevel {
  if (!concept) return 'new';
  if (concept.correctCount > 0 && concept.streak > 0) {
    return concept.spacedCorrect ? 'mastered' : 'proficient';
  }
  if (concept.boardCount > 0 || concept.lastAttemptAt) return 'learning';
  return 'new';
}

export function conceptForCourseLesson(record: LearnerRecord, courseId: string, lessonId: string): ConceptState | undefined {
  return record.concepts[conceptKeyForCourseLesson(courseId, lessonId)];
}

export function dueConcepts(record: LearnerRecord, now: Date): ConceptState[] {
  const cutoff = now.getTime();
  return Object.values(record.concepts)
    .filter((concept) => concept.dueAt !== undefined && Date.parse(concept.dueAt) <= cutoff)
    .sort((a, b) => Date.parse(a.dueAt as string) - Date.parse(b.dueAt as string));
}

export type MasterySummary = { mastered: number; proficient: number; learning: number; new: number; dueForReview: number };

export function summarizeMastery(record: LearnerRecord, now: Date): MasterySummary {
  const summary: MasterySummary = { mastered: 0, proficient: 0, learning: 0, new: 0, dueForReview: 0 };
  for (const concept of Object.values(record.concepts)) {
    summary[masteryOf(concept)] += 1;
  }
  summary.dueForReview = dueConcepts(record, now).length;
  return summary;
}

// Mastery gating for the course rail. Lessons unlock in order: everything up
// to and including the frontier — the first lesson not yet proficient — is
// clickable (earlier lessons stay open for review); everything past it is
// locked until the frontier lesson is answered correctly.
export function courseFrontier(record: LearnerRecord, course: Course): number {
  let index = 0;
  for (const unit of course.units) {
    for (const lesson of unit.lessons) {
      const level = masteryOf(conceptForCourseLesson(record, course.id, lesson.id));
      if (level !== 'proficient' && level !== 'mastered') return index;
      index += 1;
    }
  }
  return index; // whole course proficient — nothing locked
}

export function flatLessonIndex(course: Course, lessonId: string): number {
  let index = 0;
  for (const unit of course.units) {
    for (const lesson of unit.lessons) {
      if (lesson.id === lessonId) return index;
      index += 1;
    }
  }
  return -1;
}

// ---- import / export --------------------------------------------------------

export function serializeLearnerRecord(record: LearnerRecord): string {
  return JSON.stringify(record, null, 2);
}

export type ParseResult = { ok: true; record: LearnerRecord } | { ok: false; error: string };

export function parseLearnerRecord(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  const version = (data as { version?: unknown } | null)?.version;
  if (version !== LEARNER_RECORD_VERSION) {
    return { ok: false, error: `Unsupported record version ${String(version)} — this build reads version ${LEARNER_RECORD_VERSION}.` };
  }
  const result = learnerRecordSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: 'File does not match the learner record format.' };
  }
  return { ok: true, record: result.data };
}

// ---- migration from the pre-record session blob ------------------------------

// Shape of the relevant slice of the legacy localStorage session (v2). Boards
// only carried courseLessonId; attempts carried title/subject/correct.
export type LegacySessionSlice = {
  course?: (Course & { id?: string }) | null;
  done?: Record<string, boolean>;
  attempts?: Array<{
    id?: string;
    at?: string;
    boardTitle?: string;
    subject?: string;
    question?: string;
    chosen?: string;
    correct?: boolean;
    courseLessonId?: string;
  }>;
};

export function migrateFromLegacySession(session: LegacySessionSlice, now: Date): LearnerRecord {
  let record = createLearnerRecord(now);
  const course = session.course ?? null;
  if (course) {
    record = addCourseToRecord(record, course, now);
  }

  const refFor = (courseLessonId: string | undefined, title: string, subject?: string): ConceptRef => {
    if (course && courseLessonId) {
      for (const unit of course.units) {
        const lesson = unit.lessons.find((entry) => entry.id === courseLessonId);
        if (lesson) {
          return {
            key: conceptKeyForCourseLesson(course.id, lesson.id),
            kind: 'course-lesson',
            courseId: course.id,
            lessonId: lesson.id,
            title: lesson.title,
            subject: course.subject,
          };
        }
      }
    }
    return { key: conceptKeyForTopic(title), kind: 'topic', title, subject };
  };

  // Lessons the old model called "done" (board drawn) become learning-stage
  // concepts — mastery must still be demonstrated under the new rules.
  if (course && session.done) {
    for (const lessonId of Object.keys(session.done)) {
      if (!session.done[lessonId]) continue;
      const ref = refFor(lessonId, lessonId);
      if (ref.kind === 'course-lesson') {
        record = recordBoardDrawn(record, ref, now);
      }
    }
  }

  for (const legacy of session.attempts ?? []) {
    const title = legacy.boardTitle ?? 'Earlier topic';
    const at = legacy.at ? new Date(legacy.at) : now;
    record = recordQuizAttempt(
      record,
      refFor(legacy.courseLessonId, title, legacy.subject),
      {
        id: legacy.id ?? `migrated-${Math.random().toString(36).slice(2, 10)}`,
        question: legacy.question ?? '',
        chosen: legacy.chosen ?? '',
        correct: legacy.correct === true,
      },
      Number.isNaN(at.getTime()) ? now : at,
    );
  }

  return record;
}
