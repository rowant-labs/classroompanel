const lessonSteps = [
  'Understand the question',
  'Build the visual model',
  'Interact with the concept',
  'Check understanding',
];

const GITHUB_URL = 'https://github.com/rowant-labs/classroompanel';

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">ClassroomPanel</div>
        <h1>The AI tutor with a living blackboard.</h1>
        <p>
          Sit down and learn anything. Ask a question and watch the board draw the lesson — live graphs you can drag, simulations, worked equations, and quick checks that adapt to your answers. Or upload a curriculum and learn it lesson by lesson.
        </p>
        <div className="hero-actions">
          <a href="/panel" className="primary">Open the learning terminal</a>
          <a href="/vision" className="secondary">Read the vision</a>
          <a href={GITHUB_URL} className="secondary">GitHub</a>
        </div>
      </section>

      <section className="workspace" aria-label="ClassroomPanel concept preview">
        <aside className="chat-panel">
          <div className="panel-label">Tutor thread</div>
          <div className="bubble student">Explain derivatives like I’m seeing them for the first time.</div>
          <div className="bubble tutor">Let’s make slope visible. Watch the tangent line move as x changes.</div>
          <div className="bubble tutor muted">Then I’ll ask one quick check to see if the idea landed.</div>
        </aside>

        <div className="blackboard">
          <div className="board-header">
            <span>Living blackboard</span>
            <span className="live-dot">Live render</span>
          </div>
          <svg viewBox="0 0 680 390" role="img" aria-label="Concept sketch of a graph with tangent line">
            <defs>
              <linearGradient id="curve" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#6ee7f9" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <line x1="70" y1="320" x2="620" y2="320" stroke="rgba(255,255,255,.28)" />
            <line x1="95" y1="40" x2="95" y2="340" stroke="rgba(255,255,255,.28)" />
            <path d="M100 285 C190 280 230 215 285 190 C375 150 445 130 585 70" fill="none" stroke="url(#curve)" strokeWidth="6" strokeLinecap="round" />
            <line x1="300" y1="235" x2="500" y2="95" stroke="#7dd3a8" strokeWidth="4" strokeLinecap="round" />
            <circle cx="405" cy="160" r="10" fill="#7dd3a8" />
            <text x="430" y="158" fill="#f6f8fb" fontSize="24">instantaneous slope</text>
            <rect x="120" y="55" width="230" height="72" rx="18" fill="rgba(255,255,255,.1)" />
            <text x="140" y="88" fill="#f6f8fb" fontSize="22">Derivative = slope</text>
            <text x="140" y="113" fill="#aab7c8" fontSize="16">at one exact point</text>
          </svg>
          <div className="board-footer">
            {lessonSteps.map((step, index) => (
              <div key={step} className="step"><span>{index + 1}</span>{step}</div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
