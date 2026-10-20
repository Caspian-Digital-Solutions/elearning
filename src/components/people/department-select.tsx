import type { ComponentProps } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import type { DepartmentOption } from "@/lib/people/types";

/**
 * Active departments only. A department with sub-departments (Performance)
 * becomes a group holding itself and its sub-departments. `keepId` keeps a
 * person's current department in the list even if it is no longer active.
 */
export function DepartmentSelect({
  departments,
  emptyLabel,
  keepId,
  prompt,
  ...props
}: Omit<ComponentProps<typeof NativeSelect>, "children"> & {
  departments: readonly DepartmentOption[];
  emptyLabel: string;
  keepId?: string | null;
  /** A first "Choose…" option that is not a department. */
  prompt?: { value: string; label: string };
}) {
  const active = departments.filter((department) => department.isActive);
  const topLevel = active.filter((department) => !department.parentId);
  const childrenOf = (id: string) => active.filter((department) => department.parentId === id);
  const kept = keepId ? departments.find((department) => department.id === keepId && !department.isActive) : null;

  return (
    <NativeSelect {...props}>
      {prompt ? <option value={prompt.value}>{prompt.label}</option> : null}
      <option value="">{emptyLabel}</option>
      {topLevel.map((department) => {
        const children = childrenOf(department.id);
        if (children.length === 0) {
          return (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          );
        }
        return (
          <optgroup key={department.id} label={department.name}>
            <option value={department.id}>{department.name} (whole team)</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </optgroup>
        );
      })}
      {kept ? (
        <option value={kept.id}>{kept.name} (no longer active)</option>
      ) : null}
    </NativeSelect>
  );
}
