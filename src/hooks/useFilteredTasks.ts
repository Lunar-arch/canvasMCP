"use client";

import { useMemo } from "react";
import { StudyTask, FilterState } from "@/types";
import { isWithinInterval, parseISO, isPast } from "date-fns";

export function useFilteredTasks(
  tasks: StudyTask[],
  filters: FilterState,
  excludedCourseIds: number[] = []
): StudyTask[] {
  return useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (task.courseId && excludedCourseIds.includes(task.courseId)) return false;
      if (filters.hideCompleted && task.completed) return false;

      if (
        filters.search &&
        !task.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !(task.courseName || "")
          .toLowerCase()
          .includes(filters.search.toLowerCase())
      )
        return false;

      if (
        filters.courses.length > 0 &&
        task.courseId &&
        !filters.courses.includes(task.courseId)
      )
        return false;

      if (
        filters.tags.length > 0 &&
        !filters.tags.some((t) => task.tags.includes(t))
      )
        return false;

      if (
        filters.priorities.length > 0 &&
        (task.priority === null || !filters.priorities.includes(task.priority))
      )
        return false;

      if (filters.dueDateRange.start || filters.dueDateRange.end) {
        if (!task.dueAt) return false;
        const due = parseISO(task.dueAt);
        const start = filters.dueDateRange.start
          ? parseISO(filters.dueDateRange.start)
          : new Date(0);
        const end = filters.dueDateRange.end
          ? parseISO(filters.dueDateRange.end)
          : new Date(9999, 11, 31);
        if (!isWithinInterval(due, { start, end })) return false;
      }

      return true;
    });

    // Sort: completed last, then overdue (nearest deadline first),
    // then upcoming (nearest deadline first), then no due date
    return filtered.sort((a, b) => {
      // Completed tasks go to the bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      const aDue = a.dueAt ? parseISO(a.dueAt) : null;
      const bDue = b.dueAt ? parseISO(b.dueAt) : null;

      // No due date goes last (among non-completed)
      if (!aDue && !bDue) return 0;
      if (!aDue) return 1;
      if (!bDue) return -1;

      const aOverdue = isPast(aDue);
      const bOverdue = isPast(bDue);

      // Overdue tasks come first
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

      // Within same category, sort by due date ascending (nearest first)
      return aDue.getTime() - bDue.getTime();
    });
  }, [tasks, filters]);
}
