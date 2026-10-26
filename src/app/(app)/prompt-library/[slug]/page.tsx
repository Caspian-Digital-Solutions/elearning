import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth";
import { loadPromptBySlug } from "@/lib/prompts/queries";
import { createClient } from "@/lib/supabase/server";
import { PromptDetailClient } from "../prompt-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const row = await loadPromptBySlug(slug);
  return { title: row?.title ?? "Prompt" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser();
  const { slug } = await params;
  const prompt = await loadPromptBySlug(slug);
  if (!prompt) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: owner }, { data: dept }, { data: module }] = await Promise.all([
    prompt.owner_id
      ? supabase.from("profiles").select("full_name").eq("id", prompt.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    prompt.department_id
      ? supabase.from("departments").select("name").eq("id", prompt.department_id).maybeSingle()
      : Promise.resolve({ data: null }),
    prompt.module_id
      ? supabase.from("modules").select("code, title").eq("id", prompt.module_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const moduleLink =
    module?.code
      ? { href: `/lessons/${module.code.toLowerCase()}`, label: `${module.code} — ${module.title}` }
      : null;

  return (
    <div className="space-y-6">
      <PageHeader title={prompt.title} purpose="Prompt library" />
      <PromptDetailClient
        prompt={prompt}
        ownerName={owner?.full_name?.trim() || "not yet assigned"}
        departmentName={dept?.name ?? "Everyone"}
        moduleLink={moduleLink}
      />
      <p className="text-sm">
        <Link href="/prompt-library" className="text-accent-strong underline underline-offset-2">
          Back to Prompt library
        </Link>
      </p>
    </div>
  );
}
