# ClassroomPanel Architecture

## Core thesis

ClassroomPanel should generate blackboard content on the fly, but the model should not directly own the UI. The product quality comes from a stable rendering system that can turn structured lesson plans into beautiful, interactive learning panels.

## Runtime loop

```text
student input
  → tutor/planner model
  → lesson schema JSON
  → validation
  → ClassroomPanel renderer
  → student interaction / quiz answers
  → evaluator model
  → next board state
```

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
- `graph` — function plots, axes, highlighted tangent/points
- `diagram` — labeled concept diagrams
- `steps` — ordered concept progression
- `quiz` — understanding check

## Near-term stack

- Next.js app on Vercel
- TypeScript lesson schema
- React/SVG renderer
- API route for prompt → schema generation
- Supabase later for auth, saved panels, uploads, progress
- Railway later only if we need heavier workers or sandboxed execution

## Product principle

The board should feel alive, but not chaotic. The AI should teach through controlled visual tools, not random generated pictures.
