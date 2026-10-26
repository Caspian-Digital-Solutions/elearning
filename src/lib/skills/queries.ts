import "server-only";

import { formatCalendarDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { skillsCatalogueClient } from "@/lib/skills/db-client";
import { evaluateCertificationEvidence, malaysiaCalendarDate } from "@/lib/skills/certification-evidence";
import { skillStatusLabel } from "@/lib/skills/display";
import type { SkillApprovalRow, SkillRow, SkillStatus, SkillUsageLogRow, SkillVersionRow } from "@/lib/skills/types";

export { skillStatusLabel } from "@/lib/skills/display";

export type LearnerSkillCard = {
  name: string;
  displayName: string;
  departmentId: string;
  department: string;
  owner: string;
  version: string;
  status: string;
  liveSinceLabel: string;
};

export async function loadMinTestCases(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "skills.min_test_cases").maybeSingle();
  const value = data?.value;
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return 8;
}

export async function loadLearnerSkills(filters: {
  departmentId?: string | null;
  status?: SkillStatus | "all";
}): Promise<LearnerSkillCard[]> {
  const base = await createClient();
  const supabase = skillsCatalogueClient(base);
  let q = supabase.from("skills").select("*").order("display_name");

  const status = filters.status ?? "live";
  if (status === "all") {
    q = q.in("status", ["approved", "live", "retired"]);
  } else {
    q = q.eq("status", status);
  }

  if (filters.departmentId && filters.departmentId !== "all") {
    q = q.eq("department_id", filters.departmentId);
  }

  const { data, error } = await q;
  if (error) {
    throw new Error("Could not load Skills.");
  }
  const rows = (data as SkillRow[] | null) ?? [];
  const deptIds = [...new Set(rows.map((r) => r.department_id))];
  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))] as string[];

  const [{ data: depts }, { data: owners }] = await Promise.all([
    deptIds.length ? base.from("departments").select("id, name").in("id", deptIds) : { data: [] },
    ownerIds.length ? base.from("profiles").select("id, full_name").in("id", ownerIds) : { data: [] },
  ]);
  const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.full_name ?? "Unnamed"]));

  return rows.map((row) => ({
    name: row.name,
    displayName: row.display_name,
    departmentId: row.department_id,
    department: deptMap.get(row.department_id) ?? "—",
    owner: row.owner_id ? (ownerMap.get(row.owner_id) ?? "—") : "Not assigned",
    version: row.current_version,
    status: skillStatusLabel(row.status),
    liveSinceLabel: row.live_since ? `Live since ${formatCalendarDate(row.live_since)}` : "",
  }));
}

export async function loadSkillByName(name: string): Promise<SkillRow | null> {
  const supabase = skillsCatalogueClient(await createClient());
  const { data } = await supabase.from("skills").select("*").eq("name", name).maybeSingle();
  return (data as SkillRow | null) ?? null;
}

export async function loadSkillVersions(skillId: string): Promise<SkillVersionRow[]> {
  const supabase = skillsCatalogueClient(await createClient());
  const { data } = await supabase
    .from("skill_versions")
    .select("*")
    .eq("skill_id", skillId)
    .order("created_at", { ascending: false });
  return (data as SkillVersionRow[] | null) ?? [];
}

export async function loadSkillApprovals(versionIds: string[]): Promise<SkillApprovalRow[]> {
  if (!versionIds.length) {
    return [];
  }
  const supabase = skillsCatalogueClient(await createClient());
  const { data } = await supabase.from("skill_approvals").select("*").in("skill_version_id", versionIds);
  return (data as SkillApprovalRow[] | null) ?? [];
}

export async function loadMySkillUsage(userId: string): Promise<SkillUsageLogRow[]> {
  const supabase = skillsCatalogueClient(await createClient());
  const { data } = await supabase
    .from("skill_usage_logs")
    .select("*")
    .eq("user_id", userId)
    .order("used_on", { ascending: false });
  return (data as SkillUsageLogRow[] | null) ?? [];
}

export type TrainerSkillListRow = {
  id: string;
  name: string;
  displayName: string;
  department: string;
  owner: string;
  status: string;
  version: string;
  tests: string;
  headApproval: string;
  trainerApproval: string;
  liveSince: string;
  usageCount: string;
  distinctPeople: string;
  distinctDays: string;
};

export async function loadTrainerSkills(): Promise<TrainerSkillListRow[]> {
  const base = await createClient();
  const supabase = skillsCatalogueClient(base);
  const { data: skills, error } = await supabase.from("skills").select("*").order("display_name");
  if (error) {
    throw new Error("Could not load Skills.");
  }
  const rows = (skills as SkillRow[] | null) ?? [];
  if (!rows.length) {
    return [];
  }

  const skillIds = rows.map((r) => r.id);
  const [{ data: versions }, { data: counts }, { data: depts }, { data: owners }] = await Promise.all([
    supabase.from("skill_versions").select("*").in("skill_id", skillIds),
    supabase.from("skill_usage_manager_counts").select("*").in("skill_id", skillIds),
    base.from("departments").select("id, name"),
    base.from("profiles").select("id, full_name"),
  ]);

  const versionRows = (versions as SkillVersionRow[] | null) ?? [];
  const reviewVersionIds = rows.map((r) => r.review_version_id).filter(Boolean) as string[];
  const approvals = await loadSkillApprovals(reviewVersionIds.length ? reviewVersionIds : versionRows.map((v) => v.id));

  const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.full_name ?? "Unnamed"]));
  const countMap = new Map(
    (counts ?? []).map((c) => [
      c.skill_id as string,
      {
        usage: Number(c.usage_count ?? 0),
        people: Number(c.distinct_users ?? 0),
        days: Number(c.distinct_days ?? 0),
      },
    ]),
  );

  return rows.map((row) => {
    const reviewId = row.review_version_id;
    const reviewVer = reviewId ? versionRows.find((v) => v.id === reviewId) : versionRows.find((v) => v.version === row.current_version);
    const head = approvals.find((a) => a.skill_version_id === reviewId && a.approver_role === "department_head");
    const trainer = approvals.find((a) => a.skill_version_id === reviewId && a.approver_role === "trainer");
    const usage = countMap.get(row.id) ?? { usage: 0, people: 0, days: 0 };
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      department: deptMap.get(row.department_id) ?? "—",
      owner: row.owner_id ? (ownerMap.get(row.owner_id) ?? "—") : "Not assigned",
      status: skillStatusLabel(row.status),
      version: row.current_version,
      tests: reviewVer ? `${reviewVer.test_cases_passed} / ${reviewVer.test_cases_count}` : "—",
      headApproval: head ? (head.decision === "approved" ? "Yes" : "Changes") : "No",
      trainerApproval: trainer ? (trainer.decision === "approved" ? "Yes" : "Changes") : "No",
      liveSince: row.live_since ? formatCalendarDate(row.live_since) : "—",
      usageCount: String(usage.usage),
      distinctPeople: String(usage.people),
      distinctDays: String(usage.days),
    };
  });
}

export type SkillApprovalQueueItem = {
  skillId: string;
  skillName: string;
  displayName: string;
  versionId: string;
  version: string;
  testSummary: string;
  skillMdText: string;
};

export async function loadSkillApprovalQueue(): Promise<SkillApprovalQueueItem[]> {
  const supabase = skillsCatalogueClient(await createClient());
  const { data: skills } = await supabase
    .from("skills")
    .select("*")
    .not("review_version_id", "is", null);
  const rows = (skills as SkillRow[] | null) ?? [];
  if (!rows.length) {
    return [];
  }
  const versionIds = rows.map((r) => r.review_version_id).filter(Boolean) as string[];
  const { data: versions } = await supabase.from("skill_versions").select("*").in("id", versionIds);
  const versionMap = new Map(((versions as SkillVersionRow[] | null) ?? []).map((v) => [v.id, v]));

  return rows
    .map((row) => {
      const ver = row.review_version_id ? versionMap.get(row.review_version_id) : undefined;
      if (!ver) {
        return null;
      }
      return {
        skillId: row.id,
        skillName: row.name,
        displayName: row.display_name,
        versionId: ver.id,
        version: ver.version,
        testSummary: `${ver.test_cases_passed} / ${ver.test_cases_count} test cases passed`,
        skillMdText: ver.skill_md_text,
      };
    })
    .filter((item): item is SkillApprovalQueueItem => item !== null);
}

export type DepartmentCertificationRow = {
  department: string;
  skillName: string;
  displayName: string;
  status: string;
  owner: string;
  liveSince: string;
  evidenceSummary: string;
};

export async function loadDepartmentCertificationEvidence(): Promise<DepartmentCertificationRow[]> {
  const base = await createClient();
  const supabase = skillsCatalogueClient(base);
  const [{ data: skills }, { data: deptSetting }, { data: depts }] = await Promise.all([
    supabase.from("skills").select("*").eq("is_certification_skill", true),
    base.from("app_settings").select("value").eq("key", "certification.department").maybeSingle(),
    base.from("departments").select("id, name, code"),
  ]);
  const rows = (skills as SkillRow[] | null) ?? [];
  const weeks =
    typeof deptSetting?.value === "object" &&
    deptSetting.value !== null &&
    "live_use_weeks_required" in deptSetting.value &&
    typeof (deptSetting.value as { live_use_weeks_required: unknown }).live_use_weeks_required === "number"
      ? (deptSetting.value as { live_use_weeks_required: number }).live_use_weeks_required
      : 2;
  const todayMy = malaysiaCalendarDate();
  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))] as string[];
  const { data: owners } = ownerIds.length
    ? await base.from("profiles").select("id, full_name").in("id", ownerIds)
    : { data: [] };
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.full_name ?? "Unnamed"]));
  const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));

  const skillIds = rows.map((r) => r.id);
  const { data: counts } = skillIds.length
    ? await supabase.from("skill_usage_manager_counts").select("*").in("skill_id", skillIds)
    : { data: [] };
  const countMap = new Map(
    (counts ?? []).map((c) => [
      c.skill_id as string,
      {
        usage: Number(c.usage_count ?? 0),
        people: Number(c.distinct_users ?? 0),
        days: Number(c.distinct_days ?? 0),
      },
    ]),
  );

  return rows.map((row) => {
    const usage = countMap.get(row.id) ?? { usage: 0, people: 0, days: 0 };
    const evidence = evaluateCertificationEvidence({
      liveSince: row.live_since,
      liveWeeksRequired: weeks,
      usageLogCount: usage.usage,
      distinctPeople: usage.people,
      distinctUsageDays: usage.days,
      todayMy,
    });
    return {
      department: deptMap.get(row.department_id) ?? "—",
      skillName: row.name,
      displayName: row.display_name,
      status: skillStatusLabel(row.status),
      owner: row.owner_id ? (ownerMap.get(row.owner_id) ?? "—") : "Not assigned",
      liveSince: row.live_since ? formatCalendarDate(row.live_since) : "—",
      evidenceSummary: evidence.summary,
    };
  });
}
