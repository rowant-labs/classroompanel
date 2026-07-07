# The Learner Record format

The learner record is ClassroomPanel's portable mastery document: everything the harness knows about what a learner has studied, retained, and needs to review. It is the "appreciating asset" of [VISION.md](VISION.md) — sessions are disposable, the record is not — and this file is the documented open format behind the vision's export guarantee.

Design commitments:

- **Owned by the learner.** Export and import are first-class UI actions (Progress tab), producing/consuming plain JSON. Nothing in the format depends on our hosting, our accounts, or any particular AI provider.
- **Versioned.** Breaking changes bump `version` and ship with a migration; readers reject versions they don't understand rather than misreading them.
- **Deterministic semantics.** Mastery is *derived* from stored counters, never stored directly, so two implementations reading the same record agree on every level.

Canonical implementation: `lib/learner-record.ts` (schema + pure functions). Round-trip and semantics tests: `tests/learner-record.test.ts`.

## Top level (`version: 1`)

```jsonc
{
  "version": 1,
  "createdAt": "2026-07-05T09:00:00.000Z",   // ISO 8601, like all timestamps here
  "updatedAt": "2026-07-05T10:30:00.000Z",
  "concepts": { "<conceptId>": { /* ConceptState */ } },
  "attempts": [ { /* Attempt */ } ],          // rolling window, newest last, cap 500
  "courses":  [ { "addedAt": "…", "course": { /* full course outline */ } } ]
}
```

`courses` embeds full course outlines (`lib/course-schema.ts`) so an exported record is self-contained: an importing instance can rebuild the course rail, gating, and objectives without the original upload.

## Concept identity

A **concept** is the unit of mastery tracking. Two kinds:

- `lesson:<courseId>:<lessonId>` — a lesson taught from an uploaded course (`kind: "course-lesson"`)
- `topic:<slug-of-title>` — an ad-hoc topic the learner asked about (`kind: "topic"`)

Follow-up boards (reteach, go-deeper, spaced review) carry their concept key forward, so a reteach cycle updates one concept instead of forking a new one per board title.

## ConceptState

```jsonc
{
  "id": "lesson:course-1:l1",
  "kind": "course-lesson",           // or "topic"
  "courseId": "course-1",            // course-lesson only
  "lessonId": "l1",                  // course-lesson only
  "title": "Speed",
  "subject": "Physics",
  "introducedAt": "…",               // first time the harness saw this concept
  "lastAttemptAt": "…",              // optional
  "firstCorrectAt": "…",             // optional
  "lastCorrectAt": "…",              // optional
  "correctCount": 3,                 // monotonic — survives the attempts-window cap
  "incorrectCount": 1,               // monotonic
  "streak": 2,                       // consecutive correct; a miss resets to 0
  "stage": 2,                        // Leitner stage — index of the NEXT review gap
  "dueAt": "…",                      // optional — when this concept should be reviewed
  "spacedCorrect": true,             // permanent once earned; see Mastery below
  "boardCount": 4                    // boards drawn for this concept
}
```

## Mastery (derived)

Computed by `masteryOf()` — never stored:

| Level | Rule | Meaning |
|---|---|---|
| `new` | no boards, no attempts | never seen |
| `learning` | seen (board drawn or attempted), but no active streak | in progress — includes any concept whose **latest** answer was wrong |
| `proficient` | ≥1 correct **and** latest answer correct | learned it this sitting |
| `mastered` | proficient **and** `spacedCorrect` | retention demonstrated across a real gap |

`spacedCorrect` is set (permanently) when a correct answer lands at least **20 hours** after `firstCorrectAt`. This is the format's delayed-retention rule: no amount of same-session cramming reaches `mastered`, by construction. A later miss drops the level back to `learning` (streak = 0), but `spacedCorrect` persists — one correct answer restores `mastered`, because retention was already proven once.

## Review scheduling (Leitner)

Gaps by stage, in days: **1, 3, 7, 14, 30, 60** (`REVIEW_INTERVALS_DAYS`).

- **Correct answer:** `dueAt = now + gap[stage]`, then `stage += 1` (capped at the last gap).
- **Wrong answer:** `stage = 0`, `dueAt = now + 10 minutes` — missed concepts come back within the sitting, not next month.
- **Board drawn but quiz never answered:** `dueAt = now + 1 day`, so unanswered lessons surface for a retrieval check.

A concept is **due** when `dueAt <= now`. The due queue is ordered oldest-due first.

## Attempts

```jsonc
{ "id": "…", "at": "…", "conceptId": "lesson:course-1:l1", "kind": "quiz", "question": "…", "chosen": "…", "correct": true }
```

The attempts array is a rolling evidence window (cap 500) for counselors, parents, and future analytics. Concept counters are the durable tally; truncating attempts never changes a mastery level.

`kind` (optional; added within version 1, absent means `"quiz"`) says what kind of doing the attempt was:

| kind | What it is | Effect on mastery |
|---|---|---|
| `quiz` | A graded quick-check answer | Updates counters, streak, stage, `dueAt` (via `recordQuizAttempt`) |
| `predict` | A prediction committed *before* the lesson explained — `correct` records whether it matched, but wrong predictions are the pedagogy working | **None** — evidence only (via `recordPracticeEvent`; also touches `lastAttemptAt`) |
| `selfExplain` | The student's own-words explanation (`chosen` holds their text, capped) with `correct` = their self-mark | **None** — self-marked work never gates progression |

This is the format's honesty rule: only objectively graded retrieval moves mastery. Practice must be safe — a learner who predicts boldly and self-reports gaps is doing exactly what we want, and the record never punishes it.

## Course gating (derived)

The course rail unlocks lessons in order. The **frontier** is the first lesson (units flattened, in order) whose mastery is below `proficient`; every lesson up to and including the frontier is open (earlier ones stay open for review). A lesson past the frontier is locked **unless the learner already earned it**: a missed spaced review can regress an early concept and pull the frontier back, but lessons already at `proficient` or `mastered` never re-lock (`isLessonLocked()`). Drawing a board never advances the frontier — only a correct quiz answer does.

## Compatibility rules

1. Readers MUST reject a record whose `version` they don't support (no best-effort parsing of unknown majors).
2. Writers MUST NOT remove or repurpose fields within a version; additive optional fields are allowed.
3. Timestamps are ISO 8601 UTC strings; durations and schedules derive from them, never from wall-clock assumptions stored in the file.
4. Unknown extra fields SHOULD be dropped on import (the reference implementation strips them via schema parsing) — do not round-trip data you don't understand.
