'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { LessonRenderer, type DoBlockState, type PredictBlock, type SelfExplainBlock } from '@/components/lesson-renderer';
import { lessonSchema, type Lesson } from '@/lib/lesson-schema';
import { toLessonView, type LessonView } from '@/lib/lesson-view';
import { courseSchema, type Course, type CourseLesson, type CourseUnit } from '@/lib/course-schema';
import type { CounselorReport } from '@/lib/counselor-schema';
import type { LessonContext } from '@/lib/tutor-prompt';
import {
  addCourseToRecord,
  conceptForCourseLesson,
  conceptKeyForCourseLesson,
  conceptKeyForTopic,
  createLearnerRecord,
  dueConcepts,
  isLessonLocked,
  masteryOf,
  migrateFromLegacySession,
  parseLearnerRecord,
  recordBoardDrawn,
  recordPracticeEvent,
  recordQuizAttempt,
  serializeLearnerRecord,
  summarizeMastery,
  type ConceptRef,
  type ConceptState,
  type LearnerRecord,
  type MasteryLevel,
} from '@/lib/learner-record';

type ChatMessage = { id: string; role: 'student' | 'tutor'; text: string };
type BoardRecord = {
  id: string;
  topic: string;
  lesson: Lesson;
  model?: string;
  courseLessonId?: string;
  conceptKey?: string;
  // Set once the board's quiz is answered. Revisiting the board shows the
  // answer instead of offering the (now revealed) question again — re-answering
  // a question you've seen graded isn't retrieval, it's streak farming.
  answered?: { choice: number; at: string };
};

type QuizAttempt = {
  id: string;
  at: string; // ISO timestamp
  boardTitle: string;
  subject: string;
  question: string;
  chosen: string;
  correct: boolean;
  // What kind of doing this was; absent means 'quiz' (older saved sessions).
  // Predictions and self-explanations are practice — the counselor is told to
  // read wrong ones as engagement, not struggle.
  kind?: 'quiz' | 'predict' | 'selfExplain';
  courseLessonId?: string;
};

type CounselorState = {
  report: CounselorReport;
  model?: string;
  at: string; // ISO timestamp of the check-in
  // Event counts when this report was written — drives the refresh badge.
  attemptsAtReport: number;
  boardsAtReport: number;
};

type SavedSession = {
  messages: ChatMessage[];
  boards: BoardRecord[];
  course: Course | null;
  // Legacy done-on-draw flags — read once to seed the learner record migration,
  // never written anymore. Mastery now lives in the learner record.
  done?: Record<string, boolean>;
  // Optional so older saves under the same key still load.
  attempts?: QuizAttempt[];
  counselor?: CounselorState | null;
  // Monotonic event counters — unlike attempts/boards array lengths, these keep
  // growing past the storage caps, so counselor staleness detection never stalls.
  totalAttempts?: number;
  totalBoards?: number;
};

const STORAGE_KEY = 'classroompanel.session.v2';
// The learner record lives under its own key: it outlives sessions ("New
// session" never touches it) and is the unit of export/import.
const RECORD_KEY = 'classroompanel.record.v1';
// Where a stored record we CANNOT read (future version, corruption) is moved,
// untouched, instead of being overwritten. Losing a record because we merely
// failed to parse it would break the product's core promise.
const RECORD_QUARANTINE_KEY = 'classroompanel.record.unreadable';
const MAX_BOARDS = 16;
const MAX_ATTEMPTS = 40;
// Auto-refresh the counselor once this many new events (attempts or boards)
// have happened since the last report.
const COUNSELOR_REFRESH_EVENTS = 2;

const starterPrompts = [
  'I don’t understand derivatives',
  'Why do heavy and light things fall at the same speed?',
  'Teach me photosynthesis like I’m in 7th grade',
  'Show me how the human heart pumps blood',
  'What made the Roman Empire fall?',
];

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function LessonWorkspace({ initialLesson }: { initialLesson: Lesson }) {
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [boards, setBoards] = useState<BoardRecord[]>([]);
  const [activeBoardIndex, setActiveBoardIndex] = useState(0);
  const [course, setCourse] = useState<Course | null>(null);
  const [record, setRecord] = useState<LearnerRecord | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  // Interaction state for predict/selfExplain blocks on the ACTIVE board view,
  // keyed by block id. Reset alongside selectedAnswer on new boards and board
  // switches — revisiting a board offers the do-blocks fresh, like the quiz.
  const [doStates, setDoStates] = useState<Record<string, DoBlockState>>({});
  const [composerText, setComposerText] = useState('');
  const [sideTab, setSideTab] = useState<'tutor' | 'course' | 'progress' | 'counselor'>('tutor');
  const [statusNote, setStatusNote] = useState('Ask anything. The board draws itself.');
  const [isFallbackLoading, setIsFallbackLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [counselor, setCounselor] = useState<CounselorState | null>(null);
  const [isCounselorLoading, setIsCounselorLoading] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [totalBoards, setTotalBoards] = useState(0);

  // What the in-flight generation is about (topic shown in history, course bookkeeping)
  const pendingRef = useRef<{ topic: string; context: LessonContext; courseLessonId?: string; conceptKey?: string } | null>(null);
  // Legacy done-on-draw flags kept in session saves ONLY until the migrated
  // record is safely persisted — so a failed record write can't strand the
  // migration source.
  const legacyDoneRef = useRef<Record<string, boolean> | undefined>(undefined);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  // Counselor fetch guards: never two requests in flight, and don't auto-retry
  // a failed check-in until something new happens.
  const counselorInFlightRef = useRef(false);
  const counselorTriedKeyRef = useRef<string | null>(null);

  // ---- session + record persistence -----------------------------------------
  useEffect(() => {
    let saved: SavedSession | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        saved = JSON.parse(raw) as SavedSession;
        if (Array.isArray(saved.boards) && saved.boards.length > 0) {
          setMessages(saved.messages ?? []);
          setBoards(saved.boards);
          setActiveBoardIndex(saved.boards.length - 1);
          setSelectedAnswer(saved.boards[saved.boards.length - 1]?.answered?.choice ?? null);
          setCourse(saved.course ?? null);
          setAttempts(saved.attempts ?? []);
          setCounselor(saved.counselor ?? null);
          setTotalAttempts(saved.totalAttempts ?? (saved.attempts ?? []).length);
          setTotalBoards(saved.totalBoards ?? saved.boards.length);
          setStatusNote('Welcome back — your session is right where you left it.');
        }
      }
    } catch {
      saved = null; // corrupted session — start fresh
    }
    // The learner record loads from its own key; a missing record gets seeded
    // by migrating whatever the legacy session blob knew (one-time upgrade).
    let loaded: LearnerRecord | null = null;
    let unreadable: string | null = null;
    try {
      const rawRecord = window.localStorage.getItem(RECORD_KEY);
      if (rawRecord) {
        const parsed = parseLearnerRecord(rawRecord);
        if (parsed.ok) loaded = parsed.record;
        else unreadable = rawRecord;
      }
    } catch {
      loaded = null;
    }
    if (!loaded) {
      loaded = saved
        ? migrateFromLegacySession({ course: saved.course, done: saved.done, attempts: saved.attempts }, new Date())
        : createLearnerRecord(new Date());
    }
    if (unreadable) {
      // A record we can't read (newer version, corruption) is moved aside
      // untouched — never overwritten. The save effect below would otherwise
      // destroy it the moment a fresh record hydrates.
      try { window.localStorage.setItem(RECORD_QUARANTINE_KEY, unreadable); } catch { /* storage full — the original stays under RECORD_KEY until a save succeeds */ }
      setStatusNote('Your saved learning record was written by a different version. It was backed up untouched; starting fresh here.');
    }
    // Persist the loaded record NOW: the session save effect strips the legacy
    // done flags, so the record must be on disk first (or the flags kept).
    try {
      window.localStorage.setItem(RECORD_KEY, JSON.stringify(loaded));
    } catch {
      legacyDoneRef.current = saved?.done;
    }
    setRecord(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const session: SavedSession = {
        messages: messages.slice(-60),
        boards: boards.slice(-MAX_BOARDS),
        course,
        // Carried only while a migrated record has not yet been written to disk.
        done: legacyDoneRef.current,
        attempts: attempts.slice(-MAX_ATTEMPTS),
        counselor,
        totalAttempts,
        totalBoards,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // storage full — fine, session just won't persist
    }
  }, [hydrated, messages, boards, course, attempts, counselor, totalAttempts, totalBoards]);

  useEffect(() => {
    if (!hydrated || !record) return;
    try {
      window.localStorage.setItem(RECORD_KEY, JSON.stringify(record));
      legacyDoneRef.current = undefined; // record is on disk — legacy flags no longer needed
    } catch {
      // storage full — record just won't persist this round
    }
  }, [hydrated, record]);

  useEffect(() => {
    setConfirmErase(false);
  }, [sideTab]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  // ---- board commits -------------------------------------------------------
  const commitBoard = useCallback((lesson: Lesson, model?: string) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    const conceptKey = pending?.conceptKey
      ?? (course && pending?.courseLessonId ? conceptKeyForCourseLesson(course.id, pending.courseLessonId) : undefined);
    const boardRecord: BoardRecord = {
      id: makeId('board'),
      topic: pending?.topic ?? lesson.title,
      lesson,
      model,
      courseLessonId: pending?.courseLessonId,
      conceptKey,
    };
    setBoards((prev) => {
      const next = [...prev, boardRecord].slice(-MAX_BOARDS);
      setActiveBoardIndex(next.length - 1);
      return next;
    });
    // Drawing a board puts its concept in "learning" — completion is earned at
    // the quiz, never granted for watching. (This replaced the old done-on-draw.)
    setRecord((prev) => {
      if (!prev) return prev;
      const ref = boardConceptRef(prev, course, conceptKey, pending?.courseLessonId, lesson);
      return recordBoardDrawn(prev, ref, new Date());
    });
    setMessages((prev) => [...prev, {
      id: makeId('msg'),
      role: 'tutor',
      text: lesson.tutorMessage ?? `Here’s the board for “${lesson.title}”. Try the quick check when you’re ready.`,
    }]);
    setTotalBoards((count) => count + 1);
    setSelectedAnswer(null);
    setDoStates({});
  }, [course]);

  const fallbackGenerate = useCallback(async (topic: string, context: LessonContext) => {
    setIsFallbackLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, context }),
      });
      const data = await response.json();
      if (data?.lesson) {
        commitBoard(data.lesson as Lesson, data.model);
        setStatusNote(data.note ?? (data.mode === 'ai' ? `Drawn with ${data.model}.` : 'Demo board (no AI key live right now).'));
      } else {
        setStatusNote('The tutor couldn’t draw that one. Try rephrasing?');
        pendingRef.current = null;
      }
    } catch {
      setStatusNote('Connection hiccup — try drawing again.');
      pendingRef.current = null;
    } finally {
      setIsFallbackLoading(false);
    }
  }, [commitBoard]);

  // ---- streaming generation ------------------------------------------------
  const { object: streamingLesson, submit, isLoading: isStreaming } = useObject({
    api: '/api/lesson',
    schema: lessonSchema,
    onFinish: ({ object }) => {
      const pending = pendingRef.current;
      if (object) {
        commitBoard(object);
        setStatusNote('Board drawn live. Play with it.');
      } else if (pending) {
        // Stream finished but didn't validate — recover through the sturdy path
        fallbackGenerate(pending.topic, pending.context);
      }
    },
    onError: () => {
      const pending = pendingRef.current;
      if (pending) fallbackGenerate(pending.topic, pending.context);
    },
  });

  const isDrawing = isStreaming || isFallbackLoading;

  const teach = useCallback((request: string, context: LessonContext, options?: { spokenAs?: string; courseLessonId?: string; conceptKey?: string }) => {
    if (isDrawing) return;
    const spoken = options?.spokenAs ?? request;
    setMessages((prev) => [...prev, { id: makeId('msg'), role: 'student', text: spoken }]);
    setSelectedAnswer(null);
    setDoStates({});
    setStatusNote('The tutor is drawing…');
    pendingRef.current = { topic: spoken, context, courseLessonId: options?.courseLessonId, conceptKey: options?.conceptKey };
    submit({ request, context });
  }, [isDrawing, submit]);

  const conversationContext = useCallback((): LessonContext => ({
    history: messages.slice(-8).map((message) => ({ role: message.role, text: message.text })),
  }), [messages]);

  // ---- guidance counselor ----------------------------------------------------
  // Events (attempts + boards) that happened since the last report. With no
  // report yet, everything counts as new.
  const counselorNewEvents = counselor
    ? Math.max(0, totalAttempts - counselor.attemptsAtReport) + Math.max(0, totalBoards - counselor.boardsAtReport)
    : totalAttempts + totalBoards;
  const counselorRefreshPending = counselor
    ? counselorNewEvents >= COUNSELOR_REFRESH_EVENTS
    : counselorNewEvents > 0;

  // Bumped on reset so an in-flight check-in from the old session is dropped.
  const counselorEpochRef = useRef(0);

  const fetchCounselorReport = useCallback(async (force = false) => {
    if (counselorInFlightRef.current) return;
    const tryKey = `${totalAttempts}:${totalBoards}`;
    if (!force && counselorTriedKeyRef.current === tryKey) return;
    counselorInFlightRef.current = true;
    counselorTriedKeyRef.current = tryKey;
    setIsCounselorLoading(true);
    const epoch = counselorEpochRef.current;
    const attemptsAtReport = totalAttempts;
    const boardsAtReport = totalBoards;
    try {
      const snapshot = {
        attempts: attempts.slice(-25).map(({ at, boardTitle, subject, question, chosen, correct, kind }) => (
          { at, boardTitle, subject, question, chosen, correct, kind }
        )),
        boards: boards.slice(-MAX_BOARDS).map((board) => ({ title: board.lesson.title, subject: board.lesson.subject })),
        course: course ? {
          title: course.title,
          subject: course.subject,
          gradeBand: course.gradeBand,
          totalLessons: countLessons(course),
          doneLessons: record ? courseProficientCount(record, course) : 0,
        } : null,
        mastery: record ? summarizeMastery(record, new Date()) : null,
        recentMessages: messages.slice(-8).map((message) => ({ role: message.role, text: message.text })),
      };
      const response = await fetch('/api/counselor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      });
      const data = await response.json();
      if (epoch !== counselorEpochRef.current) return; // session was reset mid-flight
      if (response.ok && data?.report) {
        setCounselor({
          report: data.report as CounselorReport,
          model: data.model,
          at: new Date().toISOString(),
          attemptsAtReport,
          boardsAtReport,
        });
        setStatusNote('Your counselor just checked in.');
      } else {
        setStatusNote('The counselor couldn’t check in just now — try again in a moment.');
      }
    } catch {
      if (epoch === counselorEpochRef.current) {
        setStatusNote('The counselor couldn’t check in just now — try again in a moment.');
      }
    } finally {
      counselorInFlightRef.current = false;
      setIsCounselorLoading(false);
    }
  }, [attempts, boards, course, record, messages, totalAttempts, totalBoards]);

  // Auto-refresh when the Counselor tab is open and the report is missing or
  // stale. The tried-key guard above stops error loops until new events land.
  useEffect(() => {
    if (!hydrated || sideTab !== 'counselor') return;
    if (!counselor || counselorNewEvents >= COUNSELOR_REFRESH_EVENTS) {
      fetchCounselorReport();
    }
  }, [hydrated, sideTab, counselor, counselorNewEvents, fetchCounselorReport]);

  function handleComposerSubmit() {
    const text = composerText.trim();
    if (!text || isDrawing) return;
    setComposerText('');
    setSideTab('tutor');
    teach(text, conversationContext());
  }

  // ---- quiz adaptive loop ----------------------------------------------------
  const activeBoard = boards[activeBoardIndex] ?? null;
  const displayedLesson: LessonView | null = useMemo(() => {
    if (isStreaming) {
      const view = toLessonView(streamingLesson as Partial<Lesson> | undefined);
      if (view) return view;
    }
    if (activeBoard) return toLessonView(activeBoard.lesson);
    return toLessonView(initialLesson);
  }, [isStreaming, streamingLesson, activeBoard, initialLesson]);

  const activeQuiz = useMemo(() => displayedLesson?.blocks.find((block) => block.type === 'quiz'), [displayedLesson]);

  // Record an attempt only on the FIRST answer per board view. Re-clicks after
  // that change the displayed selection but record nothing.
  function handleSelectAnswer(index: number) {
    // While a board is still streaming, the committed-board bookkeeping
    // (activeBoard, courseLessonId) refers to the PREVIOUS board — recording
    // here would attribute the attempt to the wrong lesson, and the selection
    // would be wiped on commit anyway. Quiz opens once the board lands.
    if (isStreaming) return;
    if (selectedAnswer === null && displayedLesson && activeQuiz && activeQuiz.type === 'quiz') {
      const correct = index === activeQuiz.answerIndex;
      const attempt: QuizAttempt = {
        id: makeId('attempt'),
        at: new Date().toISOString(),
        boardTitle: displayedLesson.title,
        subject: displayedLesson.subject,
        question: activeQuiz.question,
        chosen: activeQuiz.choices[index] ?? 'unknown',
        correct,
        courseLessonId: activeBoard?.courseLessonId,
      };
      setAttempts((prev) => [...prev, attempt].slice(-MAX_ATTEMPTS));
      setTotalAttempts((count) => count + 1);
      // The learner record is the mastery source of truth — this is the moment
      // that advances (or resets) a concept's level and review schedule.
      setRecord((prev) => {
        if (!prev) return prev;
        const ref = boardConceptRef(prev, course, activeBoard?.conceptKey, activeBoard?.courseLessonId, displayedLesson);
        return recordQuizAttempt(prev, ref, {
          id: attempt.id,
          question: attempt.question,
          chosen: attempt.chosen,
          correct,
        }, new Date());
      });
      // Mark the board answered so revisits show the result instead of
      // re-grading a question whose answer was just revealed.
      if (activeBoard) {
        setBoards((prev) => prev.map((board) => (
          board.id === activeBoard.id ? { ...board, answered: { choice: index, at: attempt.at } } : board
        )));
      }
    }
    setSelectedAnswer(index);
  }

  // ---- practice do-blocks (predict / say-it-back) ----------------------------
  // Both land in the record as PRACTICE evidence — they never move mastery.
  // Wrong predictions are the pedagogy working, and self-marked explanations
  // must not gate progression; the quiz stays the only graded act.

  function recordPractice(kind: 'predict' | 'selfExplain', prompt: string, response: string, correct: boolean) {
    if (!displayedLesson) return;
    const attempt: QuizAttempt = {
      id: makeId('attempt'),
      at: new Date().toISOString(),
      boardTitle: displayedLesson.title,
      subject: displayedLesson.subject,
      question: prompt,
      chosen: response,
      correct,
      kind,
      courseLessonId: activeBoard?.courseLessonId,
    };
    setAttempts((prev) => [...prev, attempt].slice(-MAX_ATTEMPTS));
    setTotalAttempts((count) => count + 1);
    setRecord((prev) => {
      if (!prev) return prev;
      const ref = boardConceptRef(prev, course, activeBoard?.conceptKey, activeBoard?.courseLessonId, displayedLesson);
      return recordPracticeEvent(prev, ref, { id: attempt.id, kind, prompt, response, correct }, new Date());
    });
  }

  function handlePredictCommit(block: PredictBlock, choice: number) {
    // Same streaming guard as the quiz: mid-stream, board bookkeeping still
    // points at the PREVIOUS board, and doStates get wiped on commit anyway.
    if (isStreaming) return;
    if (doStates[block.id]?.choice !== undefined) return;
    setDoStates((prev) => ({ ...prev, [block.id]: { ...prev[block.id], choice } }));
    recordPractice('predict', block.question, block.choices[choice] ?? 'unknown', choice === block.answerIndex);
  }

  function handleSelfExplainReveal(block: SelfExplainBlock, text: string) {
    if (isStreaming || !text) return;
    // The record caps free text: the learner's words are theirs, but the
    // portable file shouldn't balloon on one long paragraph.
    setDoStates((prev) => ({ ...prev, [block.id]: { ...prev[block.id], text: text.slice(0, 500), revealed: true } }));
  }

  function handleSelfExplainMark(block: SelfExplainBlock, covered: boolean) {
    if (isStreaming) return;
    const state = doStates[block.id];
    if (!state?.revealed || state.selfMark) return;
    setDoStates((prev) => ({ ...prev, [block.id]: { ...prev[block.id], selfMark: covered ? 'covered' : 'missed' } }));
    recordPractice('selfExplain', block.prompt, state.text ?? '', covered);
  }

  function handleReteach(answerIndex: number) {
    if (!activeQuiz || activeQuiz.type !== 'quiz' || !displayedLesson) return;
    const correct = answerIndex === activeQuiz.answerIndex;
    const context: LessonContext = {
      ...conversationContext(),
      adaptation: {
        boardTitle: displayedLesson.title,
        question: activeQuiz.question,
        studentAnswer: activeQuiz.choices[answerIndex] ?? 'unknown',
        correctAnswer: activeQuiz.choices[activeQuiz.answerIndex],
        correct,
      },
    };
    if (course && activeBoard?.courseLessonId) {
      const located = locateCourseLesson(course, activeBoard.courseLessonId);
      if (located) {
        context.course = {
          title: course.title,
          subject: course.subject,
          gradeBand: course.gradeBand,
          unitTitle: located.unit.title,
          lessonTitle: located.lesson.title,
          objective: located.lesson.objective,
        };
      }
    }
    teach(
      correct ? 'Continue from the last board — go one level deeper.' : 'Reteach the last board’s idea a different way.',
      context,
      {
        spokenAs: correct ? `I answered “${activeQuiz.choices[answerIndex]}” — got it right! Go deeper.` : `I picked “${activeQuiz.choices[answerIndex]}” and got it wrong. Show me another way.`,
        // Follow-up boards stay attributed to the same concept, so the mastery
        // loop (and course gating) tracks the reteach cycle instead of forking
        // a new concept per board title.
        courseLessonId: activeBoard?.courseLessonId,
        conceptKey: activeBoard?.conceptKey ?? conceptKeyForTopic(displayedLesson.title),
      },
    );
  }

  // ---- curriculum upload -----------------------------------------------------
  async function handleCurriculumFile(file: File) {
    if (isUploading) return;
    setIsUploading(true);
    setStatusNote(`Reading “${file.name}” and building your course…`);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/curriculum', { method: 'POST', body: form });
      const data = await response.json();
      if (response.ok && data?.course) {
        setCourse(data.course as Course);
        setRecord((prev) => (prev ? addCourseToRecord(prev, data.course as Course, new Date()) : prev));
        setSideTab('course');
        setStatusNote(`Course ready: ${data.course.title}. Pick a lesson to start.`);
        setMessages((prev) => [...prev, {
          id: makeId('msg'),
          role: 'tutor',
          text: `I read “${file.name}” and built “${data.course.title}” — ${countLessons(data.course)} lessons across ${data.course.units.length} units. Pick one and I’ll draw it.`,
        }]);
      } else {
        setStatusNote(data?.error ?? 'Couldn’t build a course from that file.');
      }
    } catch {
      setStatusNote('Upload failed — try again.');
    } finally {
      setIsUploading(false);
    }
  }

  function teachCourseLesson(unit: CourseUnit, lesson: CourseLesson) {
    if (!course) return;
    setSideTab('tutor');
    teach(lesson.boardPrompt, {
      ...conversationContext(),
      course: {
        title: course.title,
        subject: course.subject,
        gradeBand: course.gradeBand,
        unitTitle: unit.title,
        lessonTitle: lesson.title,
        objective: lesson.objective,
      },
    }, { spokenAs: `Teach me: ${lesson.title}`, courseLessonId: lesson.id, conceptKey: conceptKeyForCourseLesson(course.id, lesson.id) });
  }

  // ---- spaced review + record portability ------------------------------------
  function startReview(concept: ConceptState) {
    const lastSeen = concept.lastAttemptAt ?? concept.introducedAt;
    const daysSinceLastSeen = Math.max(0, Math.round((Date.now() - Date.parse(lastSeen)) / (24 * 60 * 60 * 1000)));
    const context: LessonContext = {
      ...conversationContext(),
      review: {
        conceptTitle: concept.title,
        daysSinceLastSeen,
        priorStruggle: concept.incorrectCount > 0,
      },
    };
    if (course && concept.kind === 'course-lesson' && concept.courseId === course.id && concept.lessonId) {
      const located = locateCourseLesson(course, concept.lessonId);
      if (located) {
        context.review = { ...context.review!, objective: located.lesson.objective };
        context.course = {
          title: course.title,
          subject: course.subject,
          gradeBand: course.gradeBand,
          unitTitle: located.unit.title,
          lessonTitle: located.lesson.title,
          objective: located.lesson.objective,
        };
      }
    }
    setSideTab('tutor');
    teach(
      `Spaced review: check whether I still remember "${concept.title}".`,
      context,
      { spokenAs: `Quick review: ${concept.title}`, courseLessonId: concept.lessonId, conceptKey: concept.id },
    );
  }

  function handleExportRecord() {
    if (!record) return;
    const blob = new Blob([serializeLearnerRecord(record)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `classroompanel-record-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusNote('Learning record exported — it’s yours.');
  }

  async function handleImportRecord(file: File) {
    try {
      const parsed = parseLearnerRecord(await file.text());
      if (parsed.ok) {
        setRecord(parsed.record);
        // Records embed their course outlines precisely so an import can
        // rebuild the rail — without this, course concepts would orphan
        // (re-uploading the same book mints new model-chosen ids).
        const embedded = parsed.record.courses[parsed.record.courses.length - 1];
        const restoredCourse = embedded ? courseSchema.safeParse(embedded.course) : null;
        if (restoredCourse?.success) {
          setCourse(restoredCourse.data);
          setStatusNote(`Learning record imported — “${restoredCourse.data.title}” restored with it. Welcome back.`);
        } else {
          setStatusNote('Learning record imported. Welcome back.');
        }
      } else {
        setStatusNote(`Couldn’t import that file: ${parsed.error}`);
      }
    } catch {
      setStatusNote('Couldn’t read that file — try again.');
    }
  }

  function handleEraseRecord() {
    if (!confirmErase) {
      setConfirmErase(true);
      return;
    }
    // A loaded course stays embedded so the next export remains self-contained
    // (concepts reference courseIds; the format promises the outline rides along).
    const now = new Date();
    const fresh = course ? addCourseToRecord(createLearnerRecord(now), course, now) : createLearnerRecord(now);
    setRecord(fresh);
    setConfirmErase(false);
    setStatusNote('Learning record erased. Fresh start.');
  }

  function resetSession() {
    setMessages([]);
    setBoards([]);
    setActiveBoardIndex(0);
    setCourse(null);
    setSelectedAnswer(null);
    setDoStates({});
    setAttempts([]);
    setCounselor(null);
    setTotalAttempts(0);
    setTotalBoards(0);
    counselorEpochRef.current += 1;
    counselorTriedKeyRef.current = null;
    setStatusNote('Fresh board. Ask anything.');
    // The learner record deliberately survives — sessions are disposable, the
    // record is not. Erasing it is a separate, explicit act in the Progress tab.
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }

  const courseLessonCount = course ? countLessons(course) : 0;
  const courseDoneCount = course && record ? courseProficientCount(record, course) : 0;
  const reviewDue = record ? dueConcepts(record, new Date()) : [];
  const masterySummary = record ? summarizeMastery(record, new Date()) : null;
  const trackedConcepts = record
    ? Object.values(record.concepts).sort((a, b) =>
        Date.parse(b.lastAttemptAt ?? b.introducedAt) - Date.parse(a.lastAttemptAt ?? a.introducedAt))
    : [];

  return (
    <main className="terminal-page">
      <header className="terminal-topbar">
        <div className="terminal-brand">
          <span className="studio-mark">ClassroomPanel</span>
          <span className="terminal-status">{statusNote}</span>
        </div>
        <div className="terminal-actions">
          {course && <span className="course-progress-pill">{courseDoneCount}/{courseLessonCount} lessons</span>}
          <button type="button" onClick={resetSession} className="ghost-button">New session</button>
        </div>
      </header>

      <div className="terminal-grid">
        <aside className="terminal-side">
          <div className="side-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={sideTab === 'tutor'} className={sideTab === 'tutor' ? 'active' : ''} onClick={() => setSideTab('tutor')}>
              Tutor
            </button>
            <button type="button" role="tab" aria-selected={sideTab === 'course'} className={sideTab === 'course' ? 'active' : ''} onClick={() => setSideTab('course')}>
              Course{course ? ` · ${courseDoneCount}/${courseLessonCount}` : ''}
            </button>
            <button type="button" role="tab" aria-selected={sideTab === 'progress'} className={sideTab === 'progress' ? 'active' : ''} onClick={() => setSideTab('progress')}>
              Progress
              {reviewDue.length > 0 && sideTab !== 'progress' && (
                <span className="counselor-dot" aria-label={`${reviewDue.length} concepts due for review`} />
              )}
            </button>
            <button type="button" role="tab" aria-selected={sideTab === 'counselor'} className={sideTab === 'counselor' ? 'active' : ''} onClick={() => setSideTab('counselor')}>
              Counselor
              {counselorRefreshPending && sideTab !== 'counselor' && (
                <span className="counselor-dot" aria-label="New check-in available" />
              )}
            </button>
          </div>

          {sideTab === 'tutor' ? (
            <div className="thread-panel">
              <div className="thread-scroll">
                {messages.length === 0 && (
                  <div className="thread-empty">
                    <p>Hi! I teach by drawing. Ask me anything you want to learn, or upload a curriculum in the Course tab.</p>
                    <div className="starter-stack">
                      {starterPrompts.map((prompt) => (
                        <button type="button" key={prompt} onClick={() => teach(prompt, conversationContext())} disabled={isDrawing}>
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((message) => (
                  <div key={message.id} className={`thread-bubble ${message.role}`}>
                    {message.text}
                  </div>
                ))}
                {isDrawing && <div className="thread-bubble tutor drawing">Drawing the board…</div>}
                <div ref={threadEndRef} />
              </div>

              <form
                className="terminal-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleComposerSubmit();
                }}
              >
                <textarea
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleComposerSubmit();
                    }
                  }}
                  rows={2}
                  placeholder="What do you want to learn?"
                  aria-label="Ask the tutor"
                />
                <button type="submit" className="draw-button" disabled={isDrawing || !composerText.trim()}>
                  {isDrawing ? 'Drawing…' : 'Draw it'}
                </button>
              </form>
            </div>
          ) : sideTab === 'course' ? (
            <div className="course-panel">
              {!course ? (
                <CourseUpload onFile={handleCurriculumFile} isUploading={isUploading} />
              ) : (
                <div className="course-outline">
                  <div className="course-header">
                    <span className="chalk-kicker-dark">{course.subject} · {course.gradeBand}</span>
                    <h2>{course.title}</h2>
                    <p>{course.overview}</p>
                    <button type="button" className="ghost-button" onClick={() => setCourse(null)}>
                      Replace curriculum
                    </button>
                  </div>
                  {course.units.map((unit) => (
                    <section key={unit.id} className="course-unit">
                      <h3>{unit.title}</h3>
                      <p>{unit.summary}</p>
                      <ul>
                        {unit.lessons.map((lesson) => {
                          const level = masteryOf(record ? conceptForCourseLesson(record, course.id, lesson.id) : undefined);
                          // Mastery gating: lessons past the frontier wait —
                          // unless already earned (a regressed early concept
                          // never re-locks content the learner demonstrated).
                          const locked = record ? isLessonLocked(record, course, lesson.id) : false;
                          return (
                            <li key={lesson.id}>
                              <button
                                type="button"
                                className={`course-lesson ${level === 'mastered' ? 'mastered' : ''} ${level === 'proficient' ? 'done' : ''} ${locked ? 'locked' : ''}`.trim()}
                                onClick={() => teachCourseLesson(unit, lesson)}
                                disabled={isDrawing || locked}
                                title={locked ? 'Answer the earlier checks correctly to unlock this lesson.' : undefined}
                              >
                                <span className="lesson-check" aria-hidden="true">{masteryGlyph(level, locked)}</span>
                                <span className="lesson-text">
                                  <strong>{lesson.title}</strong>
                                  <small>{locked ? 'Unlocks after the lesson before it.' : lesson.objective}</small>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          ) : sideTab === 'progress' ? (
            <div className="progress-panel">
              <div className="progress-section">
                <span className="chalk-kicker-dark">Due for review</span>
                {reviewDue.length > 0 ? (
                  <>
                    <p className="progress-hint">
                      Answering these again after a break is what makes learning stick.
                    </p>
                    <div className="review-queue">
                      {reviewDue.slice(0, 8).map((concept) => (
                        <button type="button" key={concept.id} disabled={isDrawing} onClick={() => startReview(concept)}>
                          <strong>{concept.title}</strong>
                          <small>{masteryLabel(masteryOf(concept))} · last seen {daysAgoLabel(concept.lastAttemptAt ?? concept.introducedAt)}</small>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="progress-hint">
                    Nothing due right now. Review checks appear here after you learn things — spaced out so they stick.
                  </p>
                )}
              </div>

              <div className="progress-section">
                <span className="chalk-kicker-dark">Mastery</span>
                {masterySummary && (masterySummary.mastered + masterySummary.proficient + masterySummary.learning > 0) ? (
                  <>
                    <div className="counselor-chips">
                      <span className="counselor-chip">★ {masterySummary.mastered} mastered</span>
                      <span className="counselor-chip">✓ {masterySummary.proficient} learned</span>
                      <span className="counselor-chip">· {masterySummary.learning} in progress</span>
                    </div>
                    <ul className="mastery-list">
                      {trackedConcepts.slice(0, 30).map((concept) => {
                        const level = masteryOf(concept);
                        return (
                          <li key={concept.id} className="mastery-row">
                            <span className={`level-dot ${level}`} aria-hidden="true" />
                            <span className="mastery-title">{concept.title}</span>
                            <span className="mastery-level">{masteryLabel(level)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="progress-hint">
                    Your mastery map is empty so far — answer a board’s quick check to start it.
                  </p>
                )}
              </div>

              <div className="progress-section record-tools">
                <span className="chalk-kicker-dark">Your record</span>
                <p className="progress-hint">
                  This learning record belongs to you — take it with you, bring it back, or start over. New sessions never erase it.
                </p>
                <div className="record-buttons">
                  <button type="button" className="ghost-button" onClick={handleExportRecord} disabled={!record}>
                    Export
                  </button>
                  <button type="button" className="ghost-button" onClick={() => importInputRef.current?.click()}>
                    Import
                  </button>
                  <button type="button" className={`ghost-button ${confirmErase ? 'danger' : ''}`} onClick={handleEraseRecord}>
                    {confirmErase ? 'Really erase?' : 'Erase record'}
                  </button>
                </div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleImportRecord(file);
                    event.target.value = '';
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="counselor-panel">
              {!counselor && isCounselorLoading ? (
                <div className="counselor-empty">
                  <p className="counselor-loading">Looking over your session…</p>
                </div>
              ) : !counselor ? (
                <div className="counselor-empty">
                  <p>
                    I keep an eye on how your learning is going — what’s clicking, what could use
                    another pass, and fun places to explore next.
                  </p>
                  <button type="button" className="draw-button" onClick={() => fetchCounselorReport(true)}>
                    Check in with me
                  </button>
                </div>
              ) : (
                <div className="counselor-report">
                  {isCounselorLoading && <p className="counselor-loading">Checking in again…</p>}
                  <p className="counselor-checkin">{counselor.report.checkIn}</p>

                  <div className="counselor-section">
                    <span className="chalk-kicker-dark">Going strong</span>
                    <div className="counselor-chips">
                      {counselor.report.strengths.map((strength) => (
                        <span key={strength} className="counselor-chip">{strength}</span>
                      ))}
                    </div>
                  </div>

                  {counselor.report.focusAreas.length > 0 && (
                    <div className="counselor-section">
                      <span className="chalk-kicker-dark">Worth another pass</span>
                      {counselor.report.focusAreas.map((area) => (
                        <div key={area.topic} className="counselor-focus-card">
                          <strong>{area.topic}</strong>
                          <p>{area.why}</p>
                          <button
                            type="button"
                            className="counselor-action"
                            disabled={isDrawing}
                            onClick={() => {
                              setSideTab('tutor');
                              teach(area.tryThis, conversationContext(), { spokenAs: `Help me get better at ${area.topic}` });
                            }}
                          >
                            Practice this with the tutor
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="counselor-section">
                    <span className="chalk-kicker-dark">Explore next</span>
                    <div className="counselor-explore">
                      {counselor.report.explore.map((idea) => (
                        <button
                          type="button"
                          key={idea.title}
                          disabled={isDrawing}
                          onClick={() => {
                            setSideTab('tutor');
                            teach(idea.prompt, conversationContext(), { spokenAs: idea.title });
                          }}
                        >
                          {idea.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="counselor-encouragement">{counselor.report.encouragement}</p>

                  <div className="counselor-footer">
                    <span className="counselor-timestamp">
                      Checked in {new Date(counselor.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={isCounselorLoading}
                      onClick={() => fetchCounselorReport(true)}
                    >
                      {isCounselorLoading ? 'Checking…' : 'New check-in'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        <section className="terminal-stage">
          {boards.length > 1 && (
            <nav className="board-timeline" aria-label="Boards drawn this session">
              {boards.map((board, index) => (
                <button
                  type="button"
                  key={board.id}
                  className={index === activeBoardIndex && !isStreaming ? 'timeline-chip active' : 'timeline-chip'}
                  onClick={() => { setActiveBoardIndex(index); setSelectedAnswer(board.answered?.choice ?? null); setDoStates({}); }}
                >
                  {index + 1}. {board.lesson.title}
                </button>
              ))}
            </nav>
          )}

          {displayedLesson && (
            <LessonRenderer
              lesson={displayedLesson}
              selectedAnswer={selectedAnswer}
              onSelectAnswer={handleSelectAnswer}
              onReteach={handleReteach}
              doStates={doStates}
              onPredictCommit={handlePredictCommit}
              onSelfExplainReveal={handleSelfExplainReveal}
              onSelfExplainMark={handleSelfExplainMark}
              boardKey={isStreaming ? 'streaming' : activeBoard?.id ?? 'initial'}
              isDrawing={isDrawing}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function CourseUpload({ onFile, isUploading }: { onFile: (file: File) => void; isUploading: boolean }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className={`course-upload ${isDragging ? 'dragging' : ''} ${isUploading ? 'busy' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <h2>Bring your curriculum</h2>
      <p>
        Drop in a syllabus, textbook chapter, or standards doc — PDF, .txt, or .md.
        I’ll turn it into an interactive course you can learn lesson by lesson on the board.
      </p>
      <button type="button" className="draw-button" onClick={() => inputRef.current?.click()} disabled={isUploading}>
        {isUploading ? 'Building course…' : 'Choose a file'}
      </button>
      <span className="upload-hint">or drag it here</span>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}

function countLessons(course: Course): number {
  return course.units.reduce((total, unit) => total + unit.lessons.length, 0);
}

// Resolve which concept a board belongs to, in priority order: an explicit
// concept key carried through teach() (review/reteach continuity), the course
// lesson it was taught from, else an ad-hoc topic keyed by board title.
function boardConceptRef(
  record: LearnerRecord,
  course: Course | null,
  conceptKey: string | undefined,
  courseLessonId: string | undefined,
  lesson: { title: string; subject: string },
): ConceptRef {
  if (conceptKey) {
    const existing = record.concepts[conceptKey];
    if (existing) {
      return {
        key: conceptKey,
        kind: existing.kind,
        courseId: existing.courseId,
        lessonId: existing.lessonId,
        title: existing.title,
        subject: existing.subject,
      };
    }
  }
  if (course && courseLessonId) {
    const located = locateCourseLesson(course, courseLessonId);
    if (located) {
      return {
        key: conceptKeyForCourseLesson(course.id, courseLessonId),
        kind: 'course-lesson',
        courseId: course.id,
        lessonId: courseLessonId,
        title: located.lesson.title,
        subject: course.subject,
      };
    }
  }
  return { key: conceptKeyForTopic(lesson.title), kind: 'topic', title: lesson.title, subject: lesson.subject };
}

function courseProficientCount(record: LearnerRecord, course: Course): number {
  let count = 0;
  for (const unit of course.units) {
    for (const lesson of unit.lessons) {
      const level = masteryOf(conceptForCourseLesson(record, course.id, lesson.id));
      if (level === 'proficient' || level === 'mastered') count += 1;
    }
  }
  return count;
}

function masteryGlyph(level: MasteryLevel, locked: boolean): string {
  if (locked) return '·';
  if (level === 'mastered') return '★';
  if (level === 'proficient') return '✓';
  if (level === 'learning') return '…';
  return '';
}

function masteryLabel(level: MasteryLevel): string {
  if (level === 'mastered') return 'mastered';
  if (level === 'proficient') return 'learned';
  if (level === 'learning') return 'in progress';
  return 'new';
}

function daysAgoLabel(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000)));
  if (days === 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function locateCourseLesson(course: Course, lessonId: string): { unit: CourseUnit; lesson: CourseLesson } | null {
  for (const unit of course.units) {
    const lesson = unit.lessons.find((entry) => entry.id === lessonId);
    if (lesson) return { unit, lesson };
  }
  return null;
}
