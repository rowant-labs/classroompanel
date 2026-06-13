import { z } from 'zod';

// Guidance counselor report — the structured check-in shown in the Counselor
// side tab. Every field is REQUIRED: Anthropic's strict structured output
// rejects schemas with too many optional parameters, so nothing here may use
// .optional(). Keep it that way.

export const counselorFocusAreaSchema = z.object({
  // The specific idea the student is wrestling with (e.g. 'tangent slopes').
  topic: z.string(),
  // Why the counselor flagged it, grounded in what actually happened.
  why: z.string(),
  // A ready-to-send tutor request, phrased as the student speaking.
  tryThis: z.string(),
});

export const counselorExploreSchema = z.object({
  // Short adventure name shown on the button.
  title: z.string(),
  // The full tutor request sent when the student taps it.
  prompt: z.string(),
});

export const counselorReportSchema = z.object({
  // 2-3 warm sentences on how things are going, addressed to the student.
  checkIn: z.string(),
  strengths: z.array(z.string()).min(1).max(3),
  focusAreas: z.array(counselorFocusAreaSchema).max(3),
  explore: z.array(counselorExploreSchema).min(2).max(4),
  // One specific, non-generic sentence.
  encouragement: z.string(),
});

export type CounselorReport = z.infer<typeof counselorReportSchema>;
export type CounselorFocusArea = z.infer<typeof counselorFocusAreaSchema>;
export type CounselorExplore = z.infer<typeof counselorExploreSchema>;

// What the client sends to /api/counselor — a compact picture of the session.
export type CounselorSnapshot = {
  attempts: Array<{
    at: string;
    boardTitle: string;
    subject: string;
    question: string;
    chosen: string;
    correct: boolean;
  }>;
  boards: Array<{ title: string; subject: string }>;
  course: {
    title: string;
    subject?: string;
    gradeBand?: string;
    totalLessons: number;
    doneLessons: number;
  } | null;
  recentMessages: Array<{ role: 'student' | 'tutor'; text: string }>;
};
