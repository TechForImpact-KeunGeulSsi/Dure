export function toggleAllCourseIds(
  selectedCourseIds: string[],
  allCourseIds: string[],
): string[] {
  const allSelected =
    selectedCourseIds.length === allCourseIds.length &&
    allCourseIds.every((courseId) => selectedCourseIds.includes(courseId));

  return allSelected ? [] : [...allCourseIds];
}
