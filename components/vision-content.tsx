const GITHUB_URL = 'https://github.com/rowant-labs/classroompanel';

const principles = [
  {
    title: 'Bring your own key',
    text: 'Use your own Anthropic, OpenAI, or Google API key. ClassroomPanel sends it only with the generation request you make, so you control the provider, the cost, and when access stops.',
  },
  {
    title: 'Your record stays yours',
    text: 'The learner record lives in the browser and in files you export. It contains the concepts studied, practice attempts, spaced-review schedule, and course progress. It is portable by design.',
  },
  {
    title: 'Nothing saved by us',
    text: 'No accounts are required for the open app. We do not store lessons, keys, learner records, uploads, or student progress on our servers.',
  },
  {
    title: 'Open source by default',
    text: 'The product is AGPL-3.0 open source because learning software should be inspectable, self-hostable, and improvable by the families, teachers, and communities using it.',
  },
];

export function VisionContent() {
  return (
    <main className="page-shell">
      <section className="hero vision-hero">
        <div className="eyebrow">ClassroomPanel / Vision</div>
        <h1>AI learning should be open, inspectable, and deeply adaptive.</h1>
        <p>
          <strong>ClassroomPanel</strong> is an open-source learning terminal: a tutor, visual board, curriculum engine, and portable learner record designed to help students understand.
        </p>
        <div className="hero-actions">
          <a href="/panel" className="primary">Open ClassroomPanel</a>
          <a href={GITHUB_URL} className="secondary">GitHub</a>
        </div>
      </section>

      <div className="vision-flow">
        <section className="vision-card vision-lede">
          <div>
            <div className="mini-eyebrow">The core idea</div>
            <h2>A living blackboard for one student at a time.</h2>
          </div>
          <p>
            A student should be able to ask, "I do not understand derivatives," and watch the panel become the lesson: a graph, tangent line, explanation, animation, practice problem, and feedback, all shaped around the learner in front of it.
          </p>
          <div className="vision-pill-row" aria-label="ClassroomPanel learning surfaces">
            <span className="vision-pill">Conversational tutor</span>
            <span className="vision-pill">Visual canvas</span>
            <span className="vision-pill">Interactive simulations</span>
            <span className="vision-pill">Adaptive checks</span>
          </div>
        </section>

        <section className="vision-card vision-grid-card">
          <div className="vision-grid">
            <div>
              <div className="mini-eyebrow">What we reject</div>
              <h2>Not an answer machine.</h2>
              <p>
                Most students meet AI as a shortcut: paste the homework, copy the answer, move on. That feels like help, but it trains dependence. The product has to make the student think, predict, explain, and check understanding.
              </p>
            </div>
            <div>
              <div className="mini-eyebrow">What we build</div>
              <h2>A tutor that makes the work visible.</h2>
              <p>
                ClassroomPanel is built around active learning. Before the board explains, the student commits to a prediction. After it explains, they say it back in their own words. The tutor guides them toward the answer instead of handing it over.
              </p>
            </div>
          </div>
        </section>

        <section className="vision-card vision-principles">
          <div className="vision-section-heading">
            <div className="mini-eyebrow">Trust model</div>
            <h2>Parents and schools should be able to see how it works.</h2>
            <p>
              AI is already teaching children. Families, teachers, and decision makers deserve clarity about what models are used, what instructions guide them, what student work is remembered, and where that record lives.
            </p>
          </div>

          <div className="principle-grid">
            {principles.map((principle, index) => (
              <article className="principle" key={principle.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{principle.title}</h3>
                <p>{principle.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="vision-card vision-grid-card">
          <div className="vision-grid">
            <div>
              <div className="mini-eyebrow">The learner record</div>
              <h2>Progress should belong to the learner.</h2>
              <p>
                A chat session disappears. A learner record compounds. ClassroomPanel keeps track of what a student has practiced, what stuck, what needs review, and what course material they have already earned their way through.
              </p>
            </div>
            <div>
              <div className="mini-eyebrow">The open standard</div>
              <h2>The record should move with them.</h2>
              <p>
                Export it, import it, self-host it, or take it somewhere else. The point is not to trap a family inside one app. The point is to make the student's progress real, inspectable, and durable.
              </p>
            </div>
          </div>
        </section>

        <section className="vision-card vision-future">
          <div className="mini-eyebrow">Where this goes</div>
          <h2>Lessons should adapt faster than a textbook ever could.</h2>
          <p>
            The next generation of learning should build around the exact student and the exact question. A lesson should create the right visual in the moment: pictures, graphs, diagrams, simulations, and eventually short video, always surrounded by real practice.
          </p>
          <p>
            It should also stay model-agnostic. Today's best model will not stay best forever. ClassroomPanel treats models as interchangeable engines, while the board, course, and learner record remain the durable parts families can understand and control.
          </p>
        </section>

        <section className="vision-card">
          <div className="mini-eyebrow">In practice</div>
          <h2>What a session looks like.</h2>
          <ol className="vision-timeline">
            <li><strong>Ask a question, or choose the next lesson</strong> from a course built from your own curriculum.</li>
            <li><strong>The board draws the lesson</strong> with an explanation, graph, diagram, simulation, or generated visual.</li>
            <li><strong>The student does the work</strong> by predicting first, explaining it back, and answering a quick check.</li>
            <li><strong>The record remembers</strong> what stuck, what did not, and when the concept should come back.</li>
            <li><strong>Parents stay in the loop</strong> through visible progress instead of vague screen-time numbers.</li>
          </ol>
          <div className="hero-actions">
            <a href="/panel" className="primary">Open the learning terminal</a>
            <a href={GITHUB_URL} className="secondary">Read the code on GitHub</a>
          </div>
        </section>
      </div>

      <footer className="site-footer">
        <span>© ClassroomPanel · <a href={`${GITHUB_URL}/blob/main/LICENSE`}>AGPL-3.0</a></span>
        <span><a href="/terms">Terms &amp; Privacy</a> · <a href={GITHUB_URL}>GitHub</a></span>
      </footer>
    </main>
  );
}
