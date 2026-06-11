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

## Current product

- `/` — landing page
- `/vision.html` — product vision artifact
- `/demo` — fixed schema-rendered demo lesson
- `/studio` — the learning terminal: tutor thread + streaming blackboard + course rail
- `/api/lesson` — streaming lesson generation (`streamObject` + `lessonStreamSchema`); the board
  draws itself block-by-block as JSON arrives (`experimental_useObject` on the client)
- `/api/generate` — non-streaming fallback; also serves demo-safe built-in lessons with no keys
- `/api/curriculum` — curriculum upload (PDF via native Claude/Gemini document input, or txt/md)
  → `courseSchema` outline of units and lessons, each with a self-contained `boardPrompt`
- `/api/models` — provider key + routing status
- `/api/board-image` — generates the picture for an `image` block (Gemini flash image first,
  OpenAI image models as fallback), disk-cached under `.cache/board-images` keyed by a hash of
  the prompt+style; `GET /api/board-image/[key]` serves the cached PNG with immutable headers

Key modules:
- `lib/expression.ts` — safe math expression parser/evaluator (no eval); graph blocks plot the
  model's actual expression with numeric tangents, area shading, and a draggable focus point
- `lib/lesson-view.ts` — coerces streaming partial lessons into safely renderable views
- `lib/tutor-prompt.ts` — shared tutor system prompt + context builder (conversation history,
  course context, quiz adaptation)
- `lib/model-router.ts` — provider routing with fallback (Anthropic primary, Google/OpenAI backup)

Sessions (thread, boards, course progress) persist in `localStorage`. Quiz answers feed an
adaptation context into the next board: correct → deeper; wrong → reteach with a new visual.

Note: Anthropic's strict structured-output grammar caps optional schema parameters, so the
lesson routes use `providerOptions.anthropic.structuredOutputMode: 'jsonTool'`.

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
- `sketch` / `simulation` — positioned chalk marks, static or frame-by-frame
- `freeBody` / `equation` — physics forces and worked numeric solutions
- `image` — a generated picture taped to the board, for subjects with a physical appearance
  chalk can't capture (anatomy, geography, art, artifacts, machines). The lesson block carries
  only `prompt`/`alt`/`caption`/`style`/`lookFor`; the client asks `/api/board-image` for the
  actual picture, so lessons stay small, replays hit the disk cache, and a missing image
  provider degrades to a described placeholder rather than a broken board
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

The board should feel alive, but not chaotic. The AI teaches through controlled visual tools;
generated pictures are one of those tools, never decoration — every image block must carry a
teaching caption, accessible alt text, and look-for cues, and the tutor is prompted to prefer
chalk (graph/sketch/freeBody) whenever chalk can teach it.
