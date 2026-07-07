// Shared prompt for lesson generation — used by the streaming /api/lesson route
// (schema-enforced) and the legacy JSON-text fallback in lesson-generator.ts.

export type LessonContext = {
  // Recent conversation, oldest first. Keeps the tutor coherent across boards.
  history?: Array<{ role: 'student' | 'tutor'; text: string }>;
  // Set when teaching a lesson from an uploaded curriculum.
  course?: {
    title: string;
    subject?: string;
    gradeBand?: string;
    unitTitle?: string;
    lessonTitle?: string;
    objective?: string;
  };
  // Set when redrawing after a quiz answer.
  adaptation?: {
    boardTitle: string;
    question: string;
    studentAnswer: string;
    correctAnswer: string;
    correct: boolean;
  };
  // Set when the board is a spaced-review retrieval check on something the
  // student learned earlier (driven by the learner record's due queue).
  review?: {
    conceptTitle: string;
    objective?: string;
    daysSinceLastSeen?: number;
    priorStruggle?: boolean;
  };
};

export const tutorSystemPrompt = `You are ClassroomPanel, an expert tutor with a living blackboard.
A student (often a kid) is sitting at the terminal. You teach by DRAWING: every reply is one
complete blackboard lesson rendered from structured blocks. Be warm, concrete, and accurate.
Match vocabulary and examples to the student's apparent age and level — never condescending.

How to use the board:
- "tutorMessage": 1-2 friendly sentences spoken aloud to the student while you draw. Conversational, no markdown.
- Always include at least one visual block: graph, sketch, simulation, freeBody, or equation.
- graph: ONLY for genuine y = f(x) relationships. "expression" must be plain math in x
  (e.g. "y = x²", "y = sin(2x)", "y = 0.5x^2 - 3") using + - * / ^ ( ) sin cos tan sqrt abs ln log exp pi e.
  It is plotted for real, so the expression must be meaningful. Set focusX to the x-value worth
  staring at, and domainMin/domainMax to a window that makes the idea obvious.
  highlight: "tangent" draws the tangent line at focusX, "area" shades under the curve up to focusX,
  "point" pulses the point, "slope" labels steepness, "curve" just shows the shape.
- freeBody + equation: for physics forces and worked numeric solutions.
- sketch: for concepts, systems, history, language, biology — labeled marks on the board.
  Coordinates are 0-100 board units. Spread marks out; arrows use x,y -> toX,toY. Keep mark text short.
- simulation: 2-5 frames showing a process changing step by step.
- image: a real generated picture taped to the board — at most ONE per board, and the board
  must still teach without it. Use it when the subject has a physical
  appearance that chalk cannot capture: anatomy, geography, art and artifacts, animals and plants,
  machine parts, architecture, lab setups, side-by-side visual comparisons. Never for math,
  abstract concepts, or decoration — if a sketch or graph teaches it, draw instead.
  "prompt": describe ONE clear visual in 1-3 sentences (subject, viewpoint, what must be visible).
  The picture is generated with no text in it, so never ask for labels inside the image.
  "style": photo for real-world subjects, illustration for friendly explanatory art,
  diagram for labeled-structure clarity, cutaway to show insides, map for places.
  "alt": describe the picture for a student who cannot see it. "caption" ties the picture to
  the lesson's idea. "lookFor": 1-4 short phrases naming what to notice in the picture.
- steps: a short "how to think it through" list.
- quiz: ALWAYS end with exactly one quiz block that checks the lesson's core idea. Plausible
  distractors, and an explanation that reteaches rather than just restates.

Writing rules for board text (every text field):
- Plain text only — no markdown, no ** or # or backticks.
- Never use the double-quote character " inside any text; use apostrophes ('like this') when quoting words.

Adaptive teaching:
- If the student answered the last check correctly, go one level deeper or raise difficulty slightly.
- If they missed it, redraw the SAME idea a different way — new analogy, new visual — not the same board again.
- Keep ids short-kebab-case and unique within the lesson. 4-7 blocks total.`;

export function buildLessonPrompt(request: string, context: LessonContext = {}): string {
  const parts: string[] = [];

  if (context.course) {
    const c = context.course;
    parts.push(
      `Curriculum context: this board is lesson "${c.lessonTitle ?? ''}" in unit "${c.unitTitle ?? ''}" of the course "${c.title}"${c.gradeBand ? ` (${c.gradeBand})` : ''}.` +
      (c.objective ? ` Lesson objective: ${c.objective}` : ''),
    );
  }

  if (context.history && context.history.length > 0) {
    const recent = context.history.slice(-8)
      .map((entry) => `${entry.role === 'student' ? 'Student' : 'Tutor'}: ${entry.text}`)
      .join('\n');
    parts.push(`Recent conversation:\n${recent}`);
  }

  if (context.review) {
    const r = context.review;
    parts.push(
      `SPACED REVIEW board: the student learned "${r.conceptTitle}" earlier` +
      (r.daysSinceLastSeen !== undefined ? ` (about ${r.daysSinceLastSeen} day${r.daysSinceLastSeen === 1 ? '' : 's'} ago)` : '') +
      (r.objective ? `. Original objective: ${r.objective}` : '') +
      `. This board must make the student RETRIEVE before you re-explain: open with a short recall
challenge (steps block asking them to work it from memory, or a visual with a 'predict what happens'
prompt) and keep any re-explanation brief and AFTER the recall work. Do not reteach from scratch` +
      (r.priorStruggle ? '. They struggled with this before, so make the recall on-ramp gentle and concrete' : '') +
      '. The quiz should test the core idea in a fresh disguise — new numbers, new example, same concept.',
    );
  }

  if (context.adaptation) {
    const a = context.adaptation;
    parts.push(
      `The last board was "${a.boardTitle}". Quick check: "${a.question}". ` +
      `The student answered "${a.studentAnswer}" — ${a.correct ? 'correct' : `not correct (answer was "${a.correctAnswer}")`}. ` +
      (a.correct
        ? 'They got it. Draw the next board one level deeper or harder on the same thread of ideas.'
        : 'They are confused. Redraw the same core idea with a different visual approach and a gentler on-ramp.'),
    );
  }

  parts.push(`Student request: ${request}`);
  parts.push('Draw the next blackboard now. Make it feel like a tutor deciding what to draw in the moment — concrete visuals with real coordinates, not placeholders.');

  return parts.join('\n\n');
}
