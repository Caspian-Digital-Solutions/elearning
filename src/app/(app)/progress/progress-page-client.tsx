"use client";

import { useRouter } from "next/navigation";
import type { ProgressDepartmentRow, ProgressModuleRow, ProgressWeeklyRow } from "@/lib/progress/types";
import type { ProgressPeopleTableRow } from "@/lib/progress/queries";
import type { PlanModuleRow } from "@/lib/plan/queries";
import { ProgressScreen } from "./progress-screen";

export function ProgressPageClient(props: {
  mode: "self" | "manager" | "trainer";
  people: ProgressPeopleTableRow[];
  departments: ProgressDepartmentRow[];
  modules: ProgressModuleRow[];
  weekly: ProgressWeeklyRow[];
  myPlan: PlanModuleRow[] | null;
  mySummary: ProgressPeopleTableRow | null;
  includeTestAccounts: boolean;
  canOpenPerson: boolean;
  showTrainerMarks: boolean;
  tabErrors?: Partial<Record<"people" | "departments" | "modules" | "weekly" | "myPlan", string>>;
}) {
  const router = useRouter();
  return (
    <ProgressScreen
      {...props}
      onIncludeTestAccountsChange={
        props.mode === "trainer"
          ? (value) => {
              const params = new URLSearchParams();
              if (value) {
                params.set("test", "1");
              }
              router.push(`/progress${params.size ? `?${params}` : ""}`);
            }
          : undefined
      }
    />
  );
}
