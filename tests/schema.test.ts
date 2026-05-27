import { lessonSchema } from '../lib/lesson-schema';
import { sampleLessons } from '../lib/sample-lessons';

for (const lesson of sampleLessons) {
  const parsed = lessonSchema.safeParse(lesson);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error(`Invalid lesson fixture: ${lesson.id}`);
  }
}

console.log(`Validated ${sampleLessons.length} lesson fixtures.`);
