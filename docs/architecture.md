# ClassroomPanel Architecture

## Core thesis

ClassroomPanel generates blackboard content on the fly, but the model does not directly own the UI. Product quality comes from a stable rendering system that turns structured lesson plans into beautiful, interactive learning panels.

## Runtime loop

```text
student input
  → tutor/planner model
  → lesson schema JSON
  → validation with Zod
  → ClassroomPanel renderer
  → student interaction / quiz answers
  → evaluator/adaptation step
  → next board state
```

## Current MVP

- `/` — landing page
- `/vision.html` — product vision artifact
- `/demo` — fixed schema-rendered demo lesson
- `/studio` — interactive blackboard studio
- `/api/generate` — prompt → lesson schema endpoint

If no API key is configured, `/api/generate` runs in demo-safe mode and selects from built-in lessons. With `GOOGLE_GENERATIVE_AI_API_KEY` or `OPENAI_API_KEY`, it generates lessons live through the AI SDK and validates the result before rendering.

## Why schema-first

If we ask an LLM to emit arbitrary HTML, the board will be inconsistent, unsafe, and hard to improve. If we ask it to emit a constrained lesson schema, we can:

- render reliably
- validate content before showing it
- animate known block types
- save/share lessons
- re-teach by modifying state instead of regenerating everything
- support multiple AI providers

## Initial block types

- `explanation` — short teacher-like explanation
- `graph` — function plots, axes, highlighted tangent/points/area
- `diagram` — labeled concept diagrams
- `steps` — ordered concept progression
- `quiz` — understanding check

## Near-term stack

- Next.js app on Vercel
- TypeScript + Zod lesson schema
- React/SVG renderer
- Vercel AI SDK for prompt → schema generation
- Supabase later for auth, saved panels, uploads, progress
- Railway later only if we need heavier workers or sandboxed execution

## Product principle

The board should feel alive, but not chaotic. The AI should teach through controlled visual tools, not random generated pictures.
