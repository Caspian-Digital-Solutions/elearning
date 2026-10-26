import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import { malaysiaCalendarDate } from "@/lib/skills/certification-evidence";
import {
  loadMySkillUsage,
  loadSkillApprovals,
  loadSkillByName,
  loadSkillVersions,
} from "@/lib/skills/queries";
import { createClient } from "@/lib/supabase/server";
import { SkillDetailClient } from "../skill-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const row = await loadSkillByName(name);
  return { title: row?.display_name ?? "Skill" };
}

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const user = await requireUser();
  const { name } = await params;
  const skill = await loadSkillByName(name);
  if (!skill) {
    notFound();
  }

  const versions = await loadSkillVersions(skill.id);
  const approvals = await loadSkillApprovals(versions.map((v) => v.id));
  const myLogs = await loadMySkillUsage(user.id).then((rows) => rows.filter((r) => r.skill_id === skill.id));

  const supabase = await createClient();
  const approverIds = [...new Set(approvals.map((a) => a.approver_id))];
  const { data: approverRows } = approverIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", approverIds)
    : { data: [] };
  const approverNames = Object.fromEntries((approverRows ?? []).map((r) => [r.id, r.full_name ?? "Unnamed"]));

  return (
    <div className="space-y-6">
      <PageHeader title={skill.display_name} purpose="Skills catalogue" />
      <SkillDetailClient
        skill={skill}
        versions={versions}
        approvals={approvals}
        approverNames={approverNames}
        myLogs={myLogs}
        today={malaysiaCalendarDate(new Date())}
      />
      <p className="text-sm">
        <Link href="/skills" className="text-accent-strong underline underline-offset-2">
          Back to Skills catalogue
        </Link>
      </p>
    </div>
  );
}
