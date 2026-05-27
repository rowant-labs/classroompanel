# ClassroomPanel

The AI tutor with a living blackboard.

ClassroomPanel helps students learn by turning questions, notes, PDFs, and course material into one adaptive visual learning space: explanation, diagrams, graphs, simulations, and quick checks on one board.

## Product north star

A student should be able to ask, “I don’t understand derivatives,” and watch the panel become the lesson: graph, tangent line, explanation, animation, practice problem, and feedback — all in sync.

## Routes

- `/` — landing page
- `/studio` — interactive blackboard generator MVP
- `/demo` — fixed schema-rendered demo lesson
- `/vision.html` — product vision artifact

## MVP wedge

Upload a PDF/chapter/syllabus → generate an interactive blackboard lesson.

## AI generation

The app is schema-first. The model returns validated lesson JSON, then our renderer draws known block types. This avoids random unsafe HTML and keeps the blackboard reliable.

Live generation is optional right now:

```bash
cp .env.example .env.local
# add GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY
```

Without keys, `/studio` still works in demo-safe mode using built-in sample lessons.

## Development

```bash
npm install
npm run dev
npm run test
npm run build
```
