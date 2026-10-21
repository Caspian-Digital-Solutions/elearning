/**
 * Resolves which department's practical items apply in the department section.
 * Mirrors `resolve_department_item_department_id` in the database.
 */
export function resolveDepartmentItemDepartmentId(
  userDepartmentId: string | null,
  parentDepartmentId: string | null,
  departmentIdsWithDepartmentItems: readonly string[],
): string | null {
  if (userDepartmentId === null) {
    return null;
  }

  const hasItems = (departmentId: string) => departmentIdsWithDepartmentItems.includes(departmentId);

  if (hasItems(userDepartmentId)) {
    return userDepartmentId;
  }

  if (parentDepartmentId !== null && hasItems(parentDepartmentId)) {
    return parentDepartmentId;
  }

  return null;
}

export function departmentSubmitBlockMessage(
  hasDepartmentSection: boolean,
  resolvedDepartmentId: string | null,
): string | null {
  if (!hasDepartmentSection) {
    return null;
  }
  if (resolvedDepartmentId === null) {
    return "No department task is configured for your department. Contact a trainer.";
  }
  return null;
}
