import { LessonRenderer } from '@/components/lesson-renderer';
import { derivativeLesson } from '@/lib/lesson-schema';

export default function DemoPage() {
  return <LessonRenderer lesson={derivativeLesson} />;
}
