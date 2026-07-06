# Contributing to ClassroomPanel

Thanks for wanting to make learning software better. Before you start, read [docs/VISION.md](docs/VISION.md) — it explains what this project optimizes for (delayed retention, learner ownership, guardianship) and what it deliberately won't build (answer-getting, engagement optimization). PRs that conflict with those principles won't merge, however clean the code.

## Development

```bash
npm install
npm run dev        # Next.js dev server
npm run test       # schema, expression, board-image, curriculum-ingest tests
npm run typecheck
npm run build
```

Copy `.env.example` to `.env.local` and add at least one model API key for live generation; without keys, `/studio` runs in demo-safe mode on built-in sample lessons.

## Ground rules for changes

- **Schema-first, always.** Models return validated lesson JSON; the renderer draws known block types. Never render model-produced HTML. New block types need: a schema entry (both the strict streaming variant and the lenient client variant — keep them in sync), a renderer, and a test.
- **Provider quirks are load-bearing.** Anthropic routes require `structuredOutputMode: 'jsonTool'`; field ordering in streamed schemas is deliberate (e.g. image blocks emit only once `caption` arrives, guaranteeing `prompt` finished streaming). If a constraint looks odd, check `docs/` and git history before "fixing" it.
- **Pedagogy is a spec, not a vibe.** Changes to tutoring prompts or lesson flow should preserve: no direct answer-dumping, do-blocks in every lesson, mastery gating. If your change makes the tutor more "helpful" by giving answers away, it's a regression.
- Run `npm run test` and `npm run typecheck` before opening a PR. Keep PRs focused; unrelated refactors belong in separate PRs.

## Licensing and the CLA

ClassroomPanel's code is licensed under [AGPL-3.0](LICENSE). That grant to the community is irrevocable: everything released under AGPL stays available under AGPL, permanently.

To keep the project sustainable (including the ability to offer commercial licenses that fund development, or to update licensing as the ecosystem evolves), we ask contributors for a lightweight Contributor License Agreement:

> By submitting a contribution to this repository, you agree that: (1) you have the right to license your contribution; (2) you license your contribution to the project maintainer under the Apache License 2.0, including the right to relicense and dual-license it as part of the project; and (3) your contribution is provided without warranty. You retain copyright in your contribution and all rights to use it elsewhere.

A CLA bot will ask for a one-time click-through confirmation on your first PR. If you're contributing on behalf of an employer, make sure you're authorized.

To be explicit about what the CLA is for, per [docs/VISION.md](docs/VISION.md): it exists so the project can sell commercial licenses *alongside* the open one — not to take the community edition closed. Every version released under AGPL stays AGPL.

## Reporting issues

- **Bugs:** include the route (`/studio`, `/api/lesson`, etc.), the model/provider in use, and — for generation bugs — the lesson JSON if you can capture it.
- **Security issues:** do not open a public issue. Email the maintainer (see repository profile) and allow reasonable time for a fix before disclosure. This product is used by learners; treat reports accordingly.

## What contributions are most valuable right now

1. Learning-science-grounded improvements to the mastery loop (do-blocks, spaced review, feedback quality)
2. New board block types (schema + renderer + tests)
3. Curriculum ingestion robustness (weird PDFs, non-English textbooks)
4. Self-hosting experience (setup friction, docs, deployment recipes)
5. Accessibility of the board (screen readers, keyboard nav, contrast)
