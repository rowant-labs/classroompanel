import { z } from 'zod';

export const courseLessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string(),
  // A self-contained instruction for drawing this lesson's board, written while the
  // source document is in view — so teaching it later doesn't need the document again.
  boardPrompt: z.string(),
});

export const courseUnitSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  lessons: z.array(courseLessonSchema).min(1).max(8),
});

export const courseSchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string(),
  gradeBand: z.string(),
  overview: z.string(),
  units: z.array(courseUnitSchema).min(1).max(12),
});

export type Course = z.infer<typeof courseSchema>;
export type CourseUnit = z.infer<typeof courseUnitSchema>;
export type CourseLesson = z.infer<typeof courseLessonSchema>;
