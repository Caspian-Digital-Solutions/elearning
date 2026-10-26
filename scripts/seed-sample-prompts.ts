import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertDevProjectRef, assertNotProductionAppEnv } from "./demo-data-guard";

function loadEnv() {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // ignore
  }
}

async function main() {
  loadEnv();
  const prodGuard = assertNotProductionAppEnv();
  if (!prodGuard.ok) {
    console.error(prodGuard.message);
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();
  const devRef = process.env.DEV_PROJECT_REF?.trim();
  if (!url || !secret || !dbUrl || !devRef) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_DB_URL, or DEV_PROJECT_REF.");
    process.exit(1);
  }
  const refCheck = assertDevProjectRef(dbUrl, devRef);
  if (!refCheck.ok) {
    console.error(refCheck.message);
    process.exit(1);
  }

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const samples = [
    {
      slug: "sample-content-draft-email",
      title: "SAMPLE Claude drafting — client email (fictional)",
      task_type: "drafting",
      tool: "claude",
      department_code: "content",
      body: "Draft a short email for {{client_brief}} using a {{tone}} tone. Use fictional names only.",
      usage_notes_md: "Replace placeholders locally before copying into Claude.",
      example_md: "Client: **Northwind Trainers** (fictional).",
      risk_tier: "low",
    },
    {
      slug: "sample-seo-research-perplexity",
      title: "SAMPLE Perplexity research — SEO topic scan",
      task_type: "research",
      tool: "perplexity",
      department_code: "performance",
      body: "Research {{topic}} for a fictional brand {{brand_name}}. Summarise sources and note gaps.",
      usage_notes_md: "Use only public sources; no client URLs.",
      example_md: "Brand: **Harbour & Co** (fictional).",
      risk_tier: "medium",
    },
    {
      slug: "sample-account-meeting-notes",
      title: "SAMPLE Claude meeting notes — account check-in",
      task_type: "meeting notes",
      tool: "claude",
      department_code: "account-management",
      body: "Turn these bullet notes into actions: {{raw_notes}}. Flag risks and owners.",
      usage_notes_md: "Paste anonymised bullets only.",
      example_md: "Notes about **Ridgeview Apps** (fictional).",
      risk_tier: "low",
    },
  ] as const;

  let created = 0;
  for (const sample of samples) {
    const { data: existing } = await supabase.from("prompts").select("id").eq("slug", sample.slug).maybeSingle();
    if (existing) {
      continue;
    }
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("code", sample.department_code)
      .maybeSingle();
    const { error } = await supabase.from("prompts").insert({
      slug: sample.slug,
      title: sample.title,
      task_type: sample.task_type,
      tool: sample.tool,
      department_id: dept?.id ?? null,
      body: sample.body,
      usage_notes_md: sample.usage_notes_md,
      example_md: sample.example_md,
      risk_tier: sample.risk_tier,
      status: "draft",
      is_sample: true,
    });
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    created += 1;
  }
  console.log(`Sample prompts: ${created} created (${samples.length - created} already present).`);
}

void main();
