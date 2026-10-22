import {
  correctCountFromPercentage,
  formatQuizOutcomeLabel,
  quizHasPassMark,
  quizPassed,
} from "@/lib/assessments/quiz-status";
import { assignmentMarkPassed } from "@/lib/assignments/validators";
import type { ModuleAssignmentRequirement } from "@/lib/assignments/types";

export type PublishedLesson = {
  id: string;
  status: string;
};

export type LessonProgressRow = {
  lessonId: string;
};

export type ModuleQuizState = {
  passMarkPct: number | null;
  itemsPerAttempt: number | null;
  questionCount: number;
  bestPercentage: number | null;
  hasSubmittedAttempt: boolean;
};

export function allPublishedLessonsComplete(
  lessons: readonly PublishedLesson[],
  progress: readonly LessonProgressRow[],
): boolean {
  const published = lessons.filter((lesson) => lesson.status === "published");
  if (published.length === 0) {
    return true;
  }
  const done = new Set(progress.map((row) => row.lessonId));
  return published.every((lesson) => done.has(lesson.id));
}

export function assignmentRequirementSatisfied(requirement: ModuleAssignmentRequirement): boolean {
  if (requirement.releasedTotal === null) {
    return false;
  }
  return assignmentMarkPassed(
    requirement.releasedTotal,
    requirement.maxTotal,
    requirement.passMarkPct,
  );
}

export function assignmentsSatisfied(
  requirements: readonly ModuleAssignmentRequirement[],
): boolean {
  if (requirements.length === 0) {
    return true;
  }
  return requirements.every((requirement) => assignmentRequirementSatisfied(requirement));
}

export function moduleQuizSatisfied(quiz: ModuleQuizState | null): boolean {
  if (!quiz) {
    return true;
  }
  if (!quiz.hasSubmittedAttempt || quiz.bestPercentage === null) {
    return false;
  }
  if (!quizHasPassMark(quiz.passMarkPct)) {
    return true;
  }
  return quizPassed(quiz.bestPercentage, quiz.passMarkPct as number);
}

export function isModuleComplete(
  lessons: readonly PublishedLesson[],
  progress: readonly LessonProgressRow[],
  quiz: ModuleQuizState | null,
  assignments: readonly ModuleAssignmentRequirement[] = [],
): boolean {
  return (
    allPublishedLessonsComplete(lessons, progress) &&
    moduleQuizSatisfied(quiz) &&
    assignmentsSatisfied(assignments)
  );
}

export function moduleQuizOutcomeLabel(quiz: ModuleQuizState): string | null {
  if (!quiz.hasSubmittedAttempt || quiz.bestPercentage === null) {
    return null;
  }
  const total = quiz.itemsPerAttempt ?? quiz.questionCount;
  const correct = correctCountFromPercentage(quiz.bestPercentage, total);
  return formatQuizOutcomeLabel(correct, total, quiz.bestPercentage, quiz.passMarkPct);
}
