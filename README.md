# ClassroomPanel

The AI tutor with a living blackboard. Open source (AGPL-3.0), self-hostable with your own model API keys.

ClassroomPanel helps students learn by turning questions, notes, PDFs, and course material into one adaptive visual learning space: explanation, diagrams, graphs, simulations, and quick checks on one board. Full textbooks become multi-unit courses; a persistent learner record drives mastery-gated progression and spaced review.

Read [docs/VISION.md](docs/VISION.md) for what this project believes and where it’s going.

## Product north star

A student should be able to ask, “I don’t understand derivatives,” and watch the panel become the lesson: graph, tangent line, explanation, animation, practice problem, and feedback — all in sync. And a month later, the panel should remember what stuck and re-ask what didn’t.

## Routes

- `/` — landing page
- `/studio` — interactive blackboard generator MVP
- `/demo` — fixed schema-rendered demo lesson
- `/vision.html` — early product vision page (the canonical vision is [docs/VISION.md](docs/VISION.md))

## Current wedge

Upload a textbook, chapter, or syllabus → a persistent multi-unit course of interactive blackboard lessons, with quizzes feeding a learner record.

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for ground rules (schema-first, no answer-dumping, provider quirks) and the CLA.

## Self-hosting

The entire learning product in this repo is free to self-host under AGPL-3.0: run it with your own model API keys and it's yours — for your family, classroom, school, or offline deployment. The hosted convenience version at classroompanel.com (accounts, sync, managed inference) is how the project funds itself; self-hosters never depend on it.

## License

[AGPL-3.0](LICENSE). Anyone can use, study, modify, and self-host ClassroomPanel; modifications served to users over a network must be shared under the same license. Contributions are welcomed under a lightweight CLA — see [CONTRIBUTING.md](CONTRIBUTING.md).
