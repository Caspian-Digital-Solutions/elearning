import type { AppRole } from "@/config/navigation";

export type DepartmentNode = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
};

/** Department ids visible by default (self + child departments under Performance). */
export function defaultVisibleDepartmentIds(
  viewerDepartmentId: string | null,
  departments: readonly DepartmentNode[],
): Set<string> {
  const ids = new Set<string>();
  if (!viewerDepartmentId) {
    return ids;
  }
  ids.add(viewerDepartmentId);
  const children = departments.filter((d) => d.parentId === viewerDepartmentId);
  for (const child of children) {
    ids.add(child.id);
    for (const grand of departments.filter((d) => d.parentId === child.id)) {
      ids.add(grand.id);
    }
  }
  return ids;
}

export function leadershipVisibleByDefault(role: AppRole, departmentCode: string | null): boolean {
  if (role === "trainer" || role === "admin" || role === "manager") {
    return true;
  }
  return departmentCode === "senior-management";
}

export function lessonVisibleInDefaultView(
  departmentIds: readonly string[],
  visibleDeptIds: Set<string>,
): boolean {
  if (departmentIds.length === 0) {
    return true;
  }
  return departmentIds.some((id) => visibleDeptIds.has(id));
}

export function moduleVisibleInDefaultView(
  lessons: readonly { department_ids: readonly string[] }[],
  visibleDeptIds: Set<string>,
): boolean {
  if (lessons.length === 0) {
    return true;
  }
  return lessons.some((lesson) => lessonVisibleInDefaultView(lesson.department_ids, visibleDeptIds));
}
