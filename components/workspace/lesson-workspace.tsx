'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { LessonRenderer } from '@/components/lesson-renderer';
import { lessonSchema, type Lesson } from '@/lib/lesson-schema';
import { toLessonView, type LessonView } from '@/lib/lesson-view';
import type { Course, CourseLesson, CourseUnit } from '@/lib/course-schema';
import type { LessonContext } from '@/lib/tutor-prompt';

type ChatMessage = { id: string; role: 'student' | 'tutor'; text: string };
type BoardRecord = { id: string; topic: string; lesson: Lesson; model?: string; courseLessonId?: string };

type SavedSession = {
  messages: ChatMessage[];
  boards: BoardRecord[];
  course: Course | null;
  done: Record<string, boolean>;
};

const STORAGE_KEY = 'classroompanel.session.v2';
const MAX_BOARDS = 16;

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
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [composerText, setComposerText] = useState('');
  const [sideTab, setSideTab] = useState<'tutor' | 'course'>('tutor');
  const [statusNote, setStatusNote] = useState('Ask anything. The board draws itself.');
  const [isFallbackLoading, setIsFallbackLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // What the in-flight generation is about (topic shown in history, course bookkeeping)
  const pendingRef = useRef<{ topic: string; context: LessonContext; courseLessonId?: string } | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  // ---- session persistence -------------------------------------------------
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedSession;
        if (Array.isArray(saved.boards) && saved.boards.length > 0) {
          setMessages(saved.messages ?? []);
          setBoards(saved.boards);
          setActiveBoardIndex(saved.boards.length - 1);
          setCourse(saved.course ?? null);
          setDone(saved.done ?? {});
          setStatusNote('Welcome back — your session is right where you left it.');
        }
      }
    } catch {
      // corrupted session — start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const session: SavedSession = { messages: messages.slice(-60), boards: boards.slice(-MAX_BOARDS), course, done };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // storage full — fine, session just won't persist
    }
  }, [hydrated, messages, boards, course, done]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  // ---- board commits -------------------------------------------------------
  const commitBoard = useCallback((lesson: Lesson, model?: string) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    const record: BoardRecord = {
      id: makeId('board'),
      topic: pending?.topic ?? lesson.title,
      lesson,
      model,
      courseLessonId: pending?.courseLessonId,
    };
    setBoards((prev) => {
      const next = [...prev, record].slice(-MAX_BOARDS);
      setActiveBoardIndex(next.length - 1);
      return next;
    });
    if (pending?.courseLessonId) {
      setDone((prev) => ({ ...prev, [pending.courseLessonId as string]: true }));
    }
    setMessages((prev) => [...prev, {
      id: makeId('msg'),
      role: 'tutor',
      text: lesson.tutorMessage ?? `Here’s the board for “${lesson.title}”. Try the quick check when you’re ready.`,
    }]);
    setSelectedAnswer(null);
  }, []);

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

  const teach = useCallback((request: string, context: LessonContext, options?: { spokenAs?: string; courseLessonId?: string }) => {
    if (isDrawing) return;
    const spoken = options?.spokenAs ?? request;
    setMessages((prev) => [...prev, { id: makeId('msg'), role: 'student', text: spoken }]);
    setSelectedAnswer(null);
    setStatusNote('The tutor is drawing…');
    pendingRef.current = { topic: spoken, context, courseLessonId: options?.courseLessonId };
    submit({ request, context });
  }, [isDrawing, submit]);

  const conversationContext = useCallback((): LessonContext => ({
    history: messages.slice(-8).map((message) => ({ role: message.role, text: message.text })),
  }), [messages]);

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
      { spokenAs: correct ? `I answered “${activeQuiz.choices[answerIndex]}” — got it right! Go deeper.` : `I picked “${activeQuiz.choices[answerIndex]}” and got it wrong. Show me another way.` },
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
        setDone({});
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
    }, { spokenAs: `Teach me: ${lesson.title}`, courseLessonId: lesson.id });
  }

  function resetSession() {
    setMessages([]);
    setBoards([]);
    setActiveBoardIndex(0);
    setCourse(null);
    setDone({});
    setSelectedAnswer(null);
    setStatusNote('Fresh board. Ask anything.');
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }

  const courseLessonCount = course ? countLessons(course) : 0;
  const courseDoneCount = course ? Object.keys(done).filter((key) => done[key]).length : 0;

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
          ) : (
            <div className="course-panel">
              {!course ? (
                <CourseUpload onFile={handleCurriculumFile} isUploading={isUploading} />
              ) : (
                <div className="course-outline">
                  <div className="course-header">
                    <span className="chalk-kicker-dark">{course.subject} · {course.gradeBand}</span>
                    <h2>{course.title}</h2>
                    <p>{course.overview}</p>
                    <button type="button" className="ghost-button" onClick={() => { setCourse(null); setDone({}); }}>
                      Replace curriculum
                    </button>
                  </div>
                  {course.units.map((unit) => (
                    <section key={unit.id} className="course-unit">
                      <h3>{unit.title}</h3>
                      <p>{unit.summary}</p>
                      <ul>
                        {unit.lessons.map((lesson) => (
                          <li key={lesson.id}>
                            <button
                              type="button"
                              className={done[lesson.id] ? 'course-lesson done' : 'course-lesson'}
                              onClick={() => teachCourseLesson(unit, lesson)}
                              disabled={isDrawing}
                            >
                              <span className="lesson-check" aria-hidden="true">{done[lesson.id] ? '✓' : ''}</span>
                              <span className="lesson-text">
                                <strong>{lesson.title}</strong>
                                <small>{lesson.objective}</small>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
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
                  onClick={() => { setActiveBoardIndex(index); setSelectedAnswer(null); }}
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
              onSelectAnswer={(index) => setSelectedAnswer(index)}
              onReteach={handleReteach}
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

function locateCourseLesson(course: Course, lessonId: string): { unit: CourseUnit; lesson: CourseLesson } | null {
  for (const unit of course.units) {
    const lesson = unit.lessons.find((entry) => entry.id === lessonId);
    if (lesson) return { unit, lesson };
  }
  return null;
}
