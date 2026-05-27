import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClassroomPanel',
  description: 'An AI tutor with a living blackboard for interactive learning.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
