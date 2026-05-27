import type { Lesson, LessonBlock } from '@/lib/lesson-schema';

export function LessonRenderer({ lesson }: { lesson: Lesson }) {
  return (
    <section className="lesson-shell">
      <div className="lesson-intro">
        <div className="eyebrow">{lesson.subject}</div>
        <h1>{lesson.title}</h1>
        <p>{lesson.objective}</p>
      </div>
      <div className="lesson-grid">
        {lesson.blocks.map((block) => (
          <LessonBlockRenderer key={block.id} block={block} />
        ))}
      </div>
    </section>
  );
}

function LessonBlockRenderer({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case 'explanation':
      return <article className="lesson-card span-2"><div className="mini-eyebrow">{block.eyebrow}</div><h2>{block.title}</h2><p>{block.body}</p></article>;
    case 'graph':
      return <article className="lesson-card span-2"><h2>{block.title}</h2>{block.subtitle && <p>{block.subtitle}</p>}<DerivativeGraph expression={block.expression} /></article>;
    case 'diagram':
      return <article className="lesson-card"><h2>{block.title}</h2><div className="node-list">{block.nodes.map((node) => <div className="node" key={node.label}><strong>{node.label}</strong><span>{node.detail}</span></div>)}</div></article>;
    case 'steps':
      return <article className="lesson-card"><h2>{block.title}</h2><ol className="steps-list">{block.steps.map((step) => <li key={step}>{step}</li>)}</ol></article>;
    case 'quiz':
      return <article className="lesson-card span-2 quiz-card"><h2>Quick check</h2><p>{block.question}</p><div className="choice-grid">{block.choices.map((choice, index) => <button className={index === block.answerIndex ? 'choice correct' : 'choice'} key={choice}>{choice}</button>)}</div><p className="answer-note">{block.explanation}</p></article>;
  }
}

function DerivativeGraph({ expression }: { expression: string }) {
  return (
    <div className="graph-wrap">
      <div className="expression">{expression}</div>
      <svg viewBox="0 0 760 420" role="img" aria-label="Derivative graph with tangent line">
        <defs>
          <linearGradient id="cp-curve" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#6ee7f9" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        {Array.from({ length: 7 }).map((_, i) => <line key={`v-${i}`} x1={90 + i * 90} y1="48" x2={90 + i * 90} y2="350" stroke="rgba(255,255,255,.08)" />)}
        {Array.from({ length: 5 }).map((_, i) => <line key={`h-${i}`} x1="70" y1={80 + i * 62} x2="700" y2={80 + i * 62} stroke="rgba(255,255,255,.08)" />)}
        <line x1="70" y1="320" x2="700" y2="320" stroke="rgba(255,255,255,.28)" />
        <line x1="110" y1="48" x2="110" y2="350" stroke="rgba(255,255,255,.28)" />
        <path d="M115 300 C210 292 255 250 315 213 C410 155 495 127 665 58" fill="none" stroke="url(#cp-curve)" strokeWidth="7" strokeLinecap="round" />
        <line className="tangent-line" x1="335" y1="242" x2="560" y2="92" stroke="#7dd3a8" strokeWidth="5" strokeLinecap="round" />
        <circle className="pulse-point" cx="448" cy="166" r="11" fill="#7dd3a8" />
        <text x="475" y="161" fill="#f6f8fb" fontSize="24" fontWeight="800">slope right here</text>
        <text x="475" y="190" fill="#aab7c8" fontSize="18">derivative at this point</text>
      </svg>
    </div>
  );
}
