import { LessonWorkspace } from '@/components/workspace/lesson-workspace';
import { derivativeLesson } from '@/lib/lesson-schema';

export default function StudioPage() {
  return <LessonWorkspace initialLesson={derivativeLesson} />;
}
