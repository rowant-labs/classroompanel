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
      return <article className="lesson-card span-2"><div className="mini-eyebrow">{block.eyebrow ?? 'Tutor note'}</div><h2>{block.title}</h2><p>{block.body}</p></article>;
    case 'graph':
      return <article className="lesson-card span-2"><h2>{block.title}</h2>{block.subtitle && <p>{block.subtitle}</p>}<ConceptGraph expression={block.expression} highlight={block.highlight} /></article>;
    case 'diagram':
      return <article className="lesson-card"><h2>{block.title}</h2><div className="node-list">{block.nodes.map((node) => <div className="node" key={node.label}><strong>{node.label}</strong><span>{node.detail}</span></div>)}</div></article>;
    case 'steps':
      return <article className="lesson-card"><h2>{block.title}</h2><ol className="steps-list">{block.steps.map((step) => <li key={step}>{step}</li>)}</ol></article>;
    case 'quiz':
      return <article className="lesson-card span-2 quiz-card"><h2>Quick check</h2><p>{block.question}</p><div className="choice-grid">{block.choices.map((choice, index) => <button className={index === block.answerIndex ? 'choice correct' : 'choice'} key={choice}>{choice}</button>)}</div><p className="answer-note">{block.explanation}</p></article>;
  }
}

function ConceptGraph({ expression, highlight }: { expression: string; highlight: string }) {
  const isLine = /2x|x\s*\+|linear|y\s*=\s*x/i.test(expression) && !/x²|x\^2|sin/i.test(expression);
  const isSin = /sin/i.test(expression);
  const path = isSin
    ? 'M95 210 C145 95 210 95 260 210 S375 325 425 210 S540 95 590 210 S655 325 705 210'
    : isLine
      ? 'M110 305 L665 75'
      : 'M115 300 C210 292 255 250 315 213 C410 155 495 127 665 58';
  const label = highlight === 'point' ? 'key point' : highlight === 'area' ? 'area changing' : 'slope right here';

  return (
    <div className="graph-wrap">
      <div className="expression">{expression}</div>
      <svg viewBox="0 0 760 420" role="img" aria-label={`${expression} concept graph`}>
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
        {highlight === 'area' && <path d="M265 320 L265 235 C340 190 420 145 510 105 L510 320 Z" fill="rgba(125,211,168,.18)" stroke="rgba(125,211,168,.4)" />}
        <path d={path} fill="none" stroke="url(#cp-curve)" strokeWidth="7" strokeLinecap="round" />
        {highlight !== 'point' && <line className="tangent-line" x1="335" y1="242" x2="560" y2="92" stroke="#7dd3a8" strokeWidth="5" strokeLinecap="round" />}
        <circle className="pulse-point" cx="448" cy="166" r="11" fill="#7dd3a8" />
        <text x="475" y="161" fill="#f6f8fb" fontSize="24" fontWeight="800">{label}</text>
        <text x="475" y="190" fill="#aab7c8" fontSize="18">generated visual block</text>
      </svg>
    </div>
  );
}
