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

      <div className="vision-flow" id="vision">
        <section className="vision-card">
          <h2>The core idea</h2>
          <p>
            A student should be able to say, “I don’t understand derivatives,” and watch the panel become the lesson: graph, tangent line, explanation, animation, practice problem, and feedback — all on one board.
          </p>
          <span className="vision-pill">Conversational tutor</span>
          <span className="vision-pill">Visual canvas</span>
          <span className="vision-pill">Interactive simulations</span>
          <span className="vision-pill">Adaptive checks</span>
        </section>

        <section className="vision-card vision-grid-card">
          <div className="vision-grid">
            <div>
              <h2>The answer machine</h2>
              <p>
                This is how most kids meet AI today: paste the homework, harvest the answer, move on. The research is blunt about where that leads — students who lean on it practice more and <strong>learn less</strong>. It feels like help. It is the opposite.
              </p>
            </div>
            <div>
              <h2>The tutor that makes them work</h2>
              <p>
                ClassroomPanel is built the other way. Before the board explains, the student <strong>commits to a prediction</strong>. After it explains, they <strong>say it back in their own words</strong> — and the tutor actually reads it. The tutor never hands over the answer to graded work; it teaches toward the student finding it.
              </p>
            </div>
          </div>
        </section>

        <section className="vision-card">
          <h2>Learning through AI should be open source.</h2>
          <p>
            AI is already teaching this generation — the only question is whether anyone can see how. <strong>Parents deserve to know as much as possible about how everything works</strong>, and the people making decisions for children — families, teachers, school boards — <strong>should be clear on exactly what LLMs are teaching their kids</strong>. That is impossible with a black box.
          </p>
          <p>
            So the entire learning product is <strong>open source (AGPL-3.0)</strong>. Every rule the tutor follows — including the ones that refuse to dump answers — is public code you can read, audit, run on your own machine, and improve. For software children learn from, “trust us” isn’t good enough. Inspectable is the standard.
          </p>
        </section>

        <section className="vision-card vision-grid-card">
          <div className="vision-grid">
            <div>
              <h2>Bring your own key</h2>
              <p>
                ClassroomPanel doesn’t sell you AI — you connect your own. Bring an API key from Anthropic, OpenAI, or Google and lessons generate live on inference <strong>you fund directly and can cut off at any time</strong>. One key from any provider unlocks the tutor. No subscription marking up someone else’s models, no middleman between your family and the AI.
              </p>
            </div>
            <div>
              <h2>We don’t save anything</h2>
              <p>
                No accounts. No tracking. Nothing stored on anyone’s servers. The learner record — every prediction, every explanation in their own words, every concept mastered and kept weeks later — <strong>lives in your browser and in files you export</strong>. Move it to another computer, or another tutor entirely. It is your kid’s proof of work, and it belongs to your family.
              </p>
            </div>
          </div>
        </section>

        <section className="vision-card">
          <h2>Super adaptive, by construction</h2>
          <p>
            The next generation of learning should be <strong>super adaptive to the student</strong> — lessons that build themselves around the exact question a kid just asked, creating visuals on the fly: pictures, live graphs, diagrams, simulations, and — as the economics arrive — <strong>video generated in the moment</strong>, sandwiched between real practice.
          </p>
          <p>
            And it should never be welded to one AI company. As AI keeps improving, the platform routes every job to <strong>whatever best-suited model fits</strong> — today’s frontier models, next year’s, <strong>even custom fine-tuned models</strong> a family or school trains on their own curriculum. Models are the engine, and engines get replaced. The board, the course, and your child’s record are the car.
          </p>
        </section>

        <section className="vision-card">
          <h2>What a session looks like</h2>
          <ol className="vision-timeline">
            <li><strong>Ask, or pick the next lesson</strong> from a course built out of your own curriculum — even a full textbook.</li>
            <li><strong>The board draws the lesson</strong> — explanation, live graph, diagram, simulation, or picture.</li>
            <li><strong>The student does the work:</strong> predict first, say it back, then the quick check.</li>
            <li><strong>The record remembers</strong> what stuck, what didn’t, and schedules the return visit.</li>
            <li><strong>Parents stay in the loop</strong> — the counselor and the record show real progress, not screen time.</li>
          </ol>
          <div className="hero-actions">
            <a href="/panel" className="primary">Open the learning terminal</a>
            <a href={GITHUB_URL} className="secondary">Read the code on GitHub</a>
          </div>
        </section>
      </div>
    </main>
  );
}
