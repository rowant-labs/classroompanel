const GITHUB_URL = 'https://github.com/rowant-labs/classroompanel';

export const metadata = { title: 'ClassroomPanel — Vision' };

export default function VisionPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">ClassroomPanel / Product North Star</div>
        <h1>The AI tutor with a living blackboard.</h1>
        <p>
          <strong>ClassroomPanel</strong> helps students learn by turning questions, notes, PDFs, and course material into one adaptive visual learning space. It does not just answer. It teaches, draws, simulates, quizzes, and adjusts.
        </p>
      </section>

      <div className="vision-flow">
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
