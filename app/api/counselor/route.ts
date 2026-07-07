import { generateObject, type RepairTextFunction } from 'ai';
import { counselorReportSchema, type CounselorSnapshot } from '@/lib/counselor-schema';
import { getRoutedModels } from '@/lib/model-router';

export const runtime = 'nodejs';
export const maxDuration = 60;

const system = `You are the guidance counselor at ClassroomPanel, a learning terminal where a tutor
teaches by drawing blackboard lessons. You watch over the student's whole session — boards drawn,
quiz answers, course progress — and check in with them like a kind school counselor would.

Voice and grounding:
- Speak directly to the student. Kid-friendly, warm, concrete. Never shaming — a wrong answer is
  a clue about what to practice, not a failure.
- Ground EVERY observation in the snapshot data: name the actual topics, boards, and quiz results
  you saw (e.g. mention derivatives by name if that is what they struggled with). Never invent
  events that are not in the snapshot.
- If there is little or no data yet, welcome them warmly and focus on exploration ideas instead of
  performance talk.

Fields:
- checkIn: 2-3 warm sentences on how things are going, addressed to the student.
- strengths: a list of 1-3 short phrases, EACH AS ITS OWN LIST ENTRY (never one combined
  sentence), naming things that genuinely went well (correct answers, curiosity, sticking with
  a course). With no data, name showing up and curiosity.
- focusAreas: up to 3 spots to grow, each grounded in a real miss or gap. tryThis must be a
  ready-to-send request to the tutor, phrased as the student speaking in first person
  (e.g. Show me tangent slopes again with a real-world example). Empty array is fine when
  nothing needs work.
- explore: 2-4 adventure suggestions tied to the student's apparent interests from the snapshot.
  Each prompt is a complete request the tutor can draw a board from.
- encouragement: one specific, non-generic sentence tied to this student's session.

Writing rules:
- Plain text only — no markdown, no bullets inside fields.
- Never use the double-quote character anywhere in any text; use apostrophes instead.`;

const MAX_ATTEMPTS = 25;
const MAX_BOARDS = 16;
const MAX_MESSAGES = 8;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, 400) : fallback;
}

function sanitizeSnapshot(raw: unknown): CounselorSnapshot {
  const snapshot = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const attempts = (Array.isArray(snapshot.attempts) ? snapshot.attempts : [])
    .slice(-MAX_ATTEMPTS)
    .map((entry) => {
      const attempt = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const kind = attempt.kind === 'predict' || attempt.kind === 'selfExplain' || attempt.kind === 'quiz'
        ? (attempt.kind as 'quiz' | 'predict' | 'selfExplain')
        : undefined;
      return {
        at: str(attempt.at),
        boardTitle: str(attempt.boardTitle, 'a board'),
        subject: str(attempt.subject, 'General'),
        question: str(attempt.question),
        chosen: str(attempt.chosen),
        correct: attempt.correct === true,
        kind,
      };
    });

  const boards = (Array.isArray(snapshot.boards) ? snapshot.boards : [])
    .slice(-MAX_BOARDS)
    .map((entry) => {
      const board = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      return { title: str(board.title, 'Untitled board'), subject: str(board.subject, 'General') };
    });

  let course: CounselorSnapshot['course'] = null;
  if (snapshot.course && typeof snapshot.course === 'object') {
    const rawCourse = snapshot.course as Record<string, unknown>;
    course = {
      title: str(rawCourse.title, 'Untitled course'),
      subject: str(rawCourse.subject) || undefined,
      gradeBand: str(rawCourse.gradeBand) || undefined,
      totalLessons: typeof rawCourse.totalLessons === 'number' ? rawCourse.totalLessons : 0,
      doneLessons: typeof rawCourse.doneLessons === 'number' ? rawCourse.doneLessons : 0,
    };
  }

  const recentMessages = (Array.isArray(snapshot.recentMessages) ? snapshot.recentMessages : [])
    .slice(-MAX_MESSAGES)
    .map((entry) => {
      const message = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      return {
        role: message.role === 'tutor' ? ('tutor' as const) : ('student' as const),
        text: str(message.text),
      };
    });

  let mastery: CounselorSnapshot['mastery'] = null;
  if (snapshot.mastery && typeof snapshot.mastery === 'object') {
    const rawMastery = snapshot.mastery as Record<string, unknown>;
    const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);
    mastery = {
      mastered: num(rawMastery.mastered),
      proficient: num(rawMastery.proficient),
      learning: num(rawMastery.learning),
      dueForReview: num(rawMastery.dueForReview),
    };
  }

  return { attempts, boards, course, mastery, recentMessages };
}

function describeSnapshot(snapshot: CounselorSnapshot): string {
  const lines: string[] = ['Session snapshot for your check-in:'];

  if (snapshot.attempts.length > 0) {
    lines.push(
      '',
      'Attempts (oldest first). Kinds: quiz = graded check; predict = a guess made BEFORE learning,',
      'so wrong predictions are healthy engagement, never struggle; say-it-back = the student',
      'explaining in their own words, self-marked (covered / missed some).',
    );
    for (const attempt of snapshot.attempts) {
      const kind = attempt.kind ?? 'quiz';
      const outcome = kind === 'predict'
        ? (attempt.correct ? 'called it' : 'guessed differently')
        : kind === 'selfExplain'
          ? (attempt.correct ? 'self-marked: covered the key ideas' : 'self-marked: missed some')
          : (attempt.correct ? 'CORRECT' : 'WRONG');
      const label = kind === 'selfExplain' ? 'say-it-back' : kind;
      lines.push(
        `- [${label}] [${attempt.subject} / ${attempt.boardTitle}] Q: ${attempt.question} | answered: ${attempt.chosen} | ${outcome}`,
      );
    }
  } else {
    lines.push('', 'Attempts: none yet.');
  }

  if (snapshot.boards.length > 0) {
    lines.push('', 'Boards drawn this session (oldest first):');
    for (const board of snapshot.boards) {
      lines.push(`- ${board.title} (${board.subject})`);
    }
  } else {
    lines.push('', 'Boards drawn: none yet — the student just arrived.');
  }

  if (snapshot.course) {
    const meta = [snapshot.course.subject, snapshot.course.gradeBand].filter(Boolean).join(', ');
    lines.push(
      '',
      `Course in progress: ${snapshot.course.title}${meta ? ` (${meta})` : ''} — ${snapshot.course.doneLessons} of ${snapshot.course.totalLessons} lessons learned (quiz answered correctly, not just viewed).`,
    );
  } else {
    lines.push('', 'Course: none uploaded.');
  }

  if (snapshot.mastery) {
    const m = snapshot.mastery;
    lines.push(
      '',
      `Mastery record: ${m.mastered} mastered (remembered across days), ${m.proficient} learned, ${m.learning} in progress, ${m.dueForReview} due for spaced review.` +
      (m.dueForReview > 0 ? ' If review items are waiting, gently encourage the student to visit the Progress tab and clear one.' : ''),
    );
  }

  if (snapshot.recentMessages.length > 0) {
    lines.push('', 'Recent conversation:');
    for (const message of snapshot.recentMessages) {
      lines.push(`${message.role}: ${message.text}`);
    }
  }

  lines.push('', 'Write your counselor report now.');
  return lines.join('\n');
}

// Models occasionally emit near-miss reports (observed: a fast model writing
// strengths as one comma-joined string instead of an array). Repair the cheap
// slips instead of burning a whole fallback model on them.
const repairReportText: RepairTextFunction = async ({ text }) => {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (typeof raw.strengths === 'string') {
      raw.strengths = raw.strengths
        .split(/\n+|;|,(?=\s)/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    if (Array.isArray(raw.strengths)) raw.strengths = raw.strengths.slice(0, 3);
    if (Array.isArray(raw.focusAreas)) raw.focusAreas = raw.focusAreas.slice(0, 3);
    if (Array.isArray(raw.explore)) raw.explore = raw.explore.slice(0, 4);
    return JSON.stringify(raw);
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'expected a JSON body with a "snapshot" field' }, { status: 400 });
  }

  const snapshot = sanitizeSnapshot((body as Record<string, unknown> | null)?.snapshot);
  const prompt = describeSnapshot(snapshot);

  const models = [
    ...getRoutedModels('fast'),
    ...getRoutedModels('tutor'),
  ].filter((model, index, list) => (
    list.findIndex((item) => item.provider === model.provider && item.modelId === model.modelId) === index
  ));

  if (models.length === 0) {
    return Response.json({ error: 'No AI provider configured for the counselor.' }, { status: 503 });
  }

  const failures: string[] = [];
  for (const routed of models) {
    try {
      const result = await generateObject({
        model: routed.model,
        schema: counselorReportSchema,
        system,
        prompt,
        providerOptions: { anthropic: { structuredOutputMode: 'jsonTool' } },
        experimental_repairText: repairReportText,
      });
      return Response.json({ report: result.object, model: `${routed.provider}:${routed.modelId}` });
    } catch (error) {
      failures.push(`${routed.provider}:${routed.modelId}`);
      console.error(`Counselor report failed with ${routed.provider}:${routed.modelId}`, error);
    }
  }

  return Response.json({ error: `Counselor check-in failed (${failures.join(', ')}). Try again.` }, { status: 502 });
}
