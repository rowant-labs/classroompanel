import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import type { Lesson } from './lesson-schema';
import { lessonSchema } from './lesson-schema';
import { findSampleLesson } from './sample-lessons';

const system = `You are ClassroomPanel, an expert tutor that teaches through a living visual blackboard.
Create concise, accurate, student-friendly lessons. Prefer visual structure over long prose.
Return only valid data matching the schema. Use safe plain text. For graph blocks, use simple expressions such as y = x², y = 2x + 1, y = sin(x), or y = x.`;

export async function generateLesson(topic: string): Promise<{ lesson: Lesson; mode: 'ai' | 'demo'; note?: string }> {
  const trimmed = topic.trim().slice(0, 400);
  if (!trimmed) return { lesson: findSampleLesson('derivative'), mode: 'demo', note: 'No topic supplied, showing the default demo lesson.' };

  const provider = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    ? google(process.env.GEMINI_MODEL ?? 'gemini-2.5-flash')
    : process.env.OPENAI_API_KEY
      ? openai(process.env.OPENAI_MODEL ?? 'gpt-4.1-mini')
      : null;

  if (!provider) {
    return {
      lesson: findSampleLesson(trimmed),
      mode: 'demo',
      note: 'Demo mode: add GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY to generate new lessons on the fly.',
    };
  }

  try {
    const result = await generateObject({
      model: provider,
      schema: lessonSchema,
      system,
      prompt: `Create a living blackboard lesson for this student request: ${trimmed}`,
    });
    return { lesson: result.object, mode: 'ai' };
  } catch (error) {
    console.error('Lesson generation failed', error);
    return {
      lesson: findSampleLesson(trimmed),
      mode: 'demo',
      note: 'AI generation failed, so ClassroomPanel fell back to a built-in lesson.',
    };
  }
}
