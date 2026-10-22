import type { CurrentUser } from "@/lib/auth/types";

/** Whether this signed-in person may open another person's progress detail. */
export function canViewProgressPerson(viewer: CurrentUser, targetUserId: string, targetDepartmentId: string | null): boolean {
  if (viewer.id === targetUserId) {
    return true;
  }
  if (viewer.actualRole === "trainer" || viewer.actualRole === "admin") {
    return true;
  }
  if (viewer.progressScope === "all") {
    return true;
  }
  if (viewer.progressScope === "department" && viewer.departmentId && targetDepartmentId) {
    return viewer.departmentId === targetDepartmentId;
  }
  return false;
}

export function progressTabsForUser(user: CurrentUser): "self" | "manager" | "trainer" {
  if (user.role === "trainer" || user.role === "admin") {
    return "trainer";
  }
  if (user.progressScope === "department" && (user.role === "manager" || user.role === "champion")) {
    return "manager";
  }
  return "self";
}
