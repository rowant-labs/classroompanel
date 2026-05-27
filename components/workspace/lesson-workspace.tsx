'use client';

import { useMemo, useState, useTransition } from 'react';
import { LessonRenderer } from '@/components/lesson-renderer';
import type { Lesson } from '@/lib/lesson-schema';

type GenerateResponse = { lesson: Lesson; mode: 'ai' | 'demo'; note?: string };

const starterPrompts = [
  'Explain derivatives with a visual tangent line',
  'Teach photosynthesis to a 7th grader',
  'Help me understand quadratic vertices',
];

export function LessonWorkspace({ initialLesson }: { initialLesson: Lesson }) {
  const [topic, setTopic] = useState('Explain derivatives with a visual tangent line');
  const [lesson, setLesson] = useState(initialLesson);
  const [mode, setMode] = useState<'ai' | 'demo'>('demo');
  const [note, setNote] = useState('Demo lesson loaded. Add an AI key to generate new panels live.');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const quiz = useMemo(() => lesson.blocks.find((block) => block.type === 'quiz'), [lesson]);

  async function generate() {
    setSelectedAnswer(null);
    startTransition(async () => {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = (await response.json()) as GenerateResponse;
      setLesson(data.lesson);
      setMode(data.mode);
      setNote(data.note ?? (data.mode === 'ai' ? 'Generated live from the AI planner.' : 'Loaded a built-in demo lesson.'));
    });
  }

  return (
    <main className="workspace-page">
      <section className="control-panel">
        <div>
          <div className="eyebrow">ClassroomPanel Studio</div>
          <h1>Generate a living blackboard lesson.</h1>
          <p>Type what the student is stuck on. ClassroomPanel turns it into structured lesson blocks the renderer can draw, quiz, and adapt.</p>
        </div>

        <div className="prompt-box">
          <label htmlFor="topic">Student request</label>
          <textarea id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} rows={4} />
          <button className="primary action-button" onClick={generate} disabled={isPending}>{isPending ? 'Building panel…' : 'Generate blackboard'}</button>
        </div>

        <div className="prompt-chips">
          {starterPrompts.map((prompt) => <button key={prompt} onClick={() => setTopic(prompt)}>{prompt}</button>)}
        </div>

        <div className="status-card">
          <strong>{mode === 'ai' ? 'AI generation active' : 'Demo-safe mode'}</strong>
          <span>{note}</span>
        </div>

        {quiz && quiz.type === 'quiz' && (
          <div className="tutor-card">
            <strong>Tutor check</strong>
            <p>{selectedAnswer === null ? 'Answer the quick check on the board. The tutor will respond here.' : selectedAnswer === quiz.answerIndex ? 'Correct. The concept landed — now the board could advance to a harder example.' : `Not quite. ${quiz.explanation}`}</p>
            <div className="mini-choices">
              {quiz.choices.map((choice, index) => <button key={choice} onClick={() => setSelectedAnswer(index)} className={selectedAnswer === index ? 'selected' : ''}>{choice}</button>)}
            </div>
          </div>
        )}
      </section>

      <LessonRenderer lesson={lesson} />
    </main>
  );
}
