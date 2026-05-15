'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { GetCourseHomeOutput } from '@/types/course';

export type CourseDetailContextValue = GetCourseHomeOutput['course'];

const CourseDetailContext = createContext<CourseDetailContextValue | null>(null);

export function CourseDetailProvider({
  course,
  children,
}: {
  course: CourseDetailContextValue;
  children: ReactNode;
}) {
  return (
    <CourseDetailContext.Provider value={course}>{children}</CourseDetailContext.Provider>
  );
}

export function useCourseDetail() {
  const ctx = useContext(CourseDetailContext);
  if (!ctx) {
    throw new Error('useCourseDetail must be used within CourseDetailProvider');
  }
  return ctx;
}
