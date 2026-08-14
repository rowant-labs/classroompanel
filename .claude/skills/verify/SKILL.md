---
name: verify
description: Drive ClassroomPanel end-to-end in a headless browser to verify changes at the real surface — launch recipe, state-injection trick, and the flows worth exercising.
---

# Verifying ClassroomPanel

The workspace lives at **`/studio`** (`/` is a landing page, `/demo` renders a bare board with no state). All learner state is client-side localStorage — no accounts, no API keys needed for the initial demo board.

## Launch

```bash
npm run dev -- --port 3789   # ready in ~2s; wait for HTTP 200 on /studio
```

Checks that are NOT verification but should stay green: `npm run typecheck`, `npm test`, `npm run build`.

## Drive it headless

Playwright's chromium is cached on this machine; use `playwright-core` (install in a tmp dir, not the repo) with:

```
executablePath: ~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell
```

## The state-injection trick

Any app state can be staged without AI generation by writing localStorage and reloading:

- `classroompanel.session.v2` — boards (each with a full `lesson` object; minimal valid lesson = explanation + steps + quiz blocks), messages, course, attempts, counselor report, counters.
- `classroompanel.record.v1` — the learner record: concepts keyed `lesson:<courseId>:<lessonId>` or `topic:<slug>`, attempts (with `kind`), embedded courses. Set `dueAt` in the past to populate the review queue; `spacedCorrect: true` + streak ≥ 1 for mastered.
- `classroompanel.record.unreadable` — where unparseable records get quarantined (test by writing `{"version":99}` to the record key and reloading).

## Flows worth exercising after a change

1. **Do-block loop** (initial demo board, no state needed): commit a predict choice → reveal appears, buttons lock; type ≥20 chars in say-it-back → compare → self-mark; answer quiz → record in localStorage gains attempts with kinds `[predict, selfExplain, quiz]`; only the quiz moves concept counters.
2. **Mastery honesty**: wrong predict / "missed some" self-mark must never change `correctCount`/`incorrectCount`/`streak`/`stage`/`dueAt`.
3. **Answered persistence**: an answered board's quiz shows its result after board-switch and reload, and re-clicking records nothing.
4. **Record safety**: unreadable record → quarantined verbatim + status note, never overwritten; export/import round-trips and restores the embedded course.
5. **Gating**: course rail — one "Up next" lesson, locked lessons named after their prerequisite, earned lessons never re-lock after a failed review.
6. **BYOK** (run the dev server with provider env vars stripped: `env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY -u GOOGLE_GENERATIVE_AI_API_KEY -u GOOGLE_API_KEY npm run dev`): save a fake key via the tutor-panel "Bring your own key" toggle → `classroompanel.keys.v1` in localStorage, `/api/lesson` and `/api/generate` requests carry `x-classroompanel-key-*` headers, the failure status note names the attempted provider's models (proof the key was used), and the toggle still shows the key after reload.

## Gotchas

- Screenshot tabs by clicking `.side-tabs button` with `hasText`; the panels are `.thread-panel/.course-panel/.progress-panel/.counselor-panel`.
- The floating "N" circle bottom-left is the Next.js dev indicator, not app UI.
- Parallel background jobs: run the dev server on a non-default port and keep driver scripts in `$CLAUDE_JOB_DIR/tmp`.
