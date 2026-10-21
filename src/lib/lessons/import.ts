import { slugifyTitle, validateSlug } from "@/lib/content/slug";
import { videoEmbedUrl } from "@/lib/markdown/video-embed";

export const lessonKinds = ["lesson", "recording", "worked_example"] as const;
export type LessonKind = (typeof lessonKinds)[number];

export const importDepartmentCodes = [
  "content",
  "creative",
  "performance",
  "performance-seo",
  "performance-paid",
  "performance-analytics",
  "account-management",
  "senior-management",
] as const;

export type ParsedLessonImport = {
  fileName: string;
  moduleCode: string;
  title: string;
  slug: string;
  kind: LessonKind;
  durationMin: number;
  departmentCodes: string[] | "all";
  sortOrder: number;
  videoUrl: string | null;
  resources: { title: string; url: string }[];
  summary: string;
  bodyMd: string;
  imageRefs: string[];
};

export type ImportPreviewRow = {
  fileName: string;
  moduleCode: string;
  title: string;
  kind: string;
  durationMin: number;
  departments: string;
  result: string;
  ready: boolean;
  duplicateNote?: string;
};

const frontMatterRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseYamlValue(line: string): { key: string; value: string } | null {
  const idx = line.indexOf(":");
  if (idx < 0) {
    return null;
  }
  return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
}

function parseResources(block: string[]): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  let current: { title?: string; url?: string } = {};
  for (const line of block) {
    const t = line.trim();
    if (t.startsWith("- title:")) {
      if (current.title && current.url) {
        out.push({ title: current.title, url: current.url });
      }
      current = { title: t.replace("- title:", "").trim() };
    } else if (t.startsWith("url:")) {
      current.url = t.replace("url:", "").trim();
    }
  }
  if (current.title && current.url) {
    out.push({ title: current.title, url: current.url });
  }
  return out;
}

export function findImageRefs(body: string): string[] {
  const matches = body.match(/!\[[^\]]*\]\([^)]+\)/g);
  return matches ?? [];
}

export function parseLessonMarkdown(fileName: string, raw: string): ParsedLessonImport {
  const match = frontMatterRe.exec(raw.trim());
  if (!match) {
    throw new Error("Missing YAML front matter between --- lines.");
  }
  const yaml = match[1];
  const bodyMd = match[2].trim();
  const fields: Record<string, string> = {};
  const resourcesBlock: string[] = [];
  let inResources = false;
  for (const line of yaml.split("\n")) {
    if (line.trim().startsWith("resources:")) {
      inResources = true;
      continue;
    }
    if (inResources) {
      if (line.startsWith("  ") || line.trim().startsWith("-")) {
        resourcesBlock.push(line);
        continue;
      }
      inResources = false;
    }
    const parsed = parseYamlValue(line);
    if (parsed) {
      fields[parsed.key] = parsed.value;
    }
  }

  const moduleCode = (fields.module ?? "").trim();
  const title = (fields.title ?? "").trim();
  const slug = (fields.slug ?? slugifyTitle(title)).trim().toLowerCase();
  const kind = (fields.kind ?? "lesson").trim() as LessonKind;
  const durationMin = Number(fields.duration_min);
  const sortOrder = fields.order ? Number(fields.order) : 0;
  const videoUrl = fields.video?.trim() || null;
  const summary = (fields.summary ?? "").trim();

  let departmentCodes: string[] | "all" = "all";
  if (fields.departments && fields.departments !== "all") {
    const cleaned = fields.departments.replace(/^\[|\]$/g, "");
    departmentCodes = cleaned
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  return {
    fileName,
    moduleCode,
    title,
    slug,
    kind,
    durationMin,
    departmentCodes,
    sortOrder,
    videoUrl,
    resources: parseResources(resourcesBlock),
    summary,
    bodyMd,
    imageRefs: findImageRefs(bodyMd),
  };
}

export type ModuleLookup = Record<string, string>;
export type DepartmentLookup = Record<string, string>;

export function validateLessonImport(
  parsed: ParsedLessonImport,
  modules: ModuleLookup,
  departments: DepartmentLookup,
  existingSlug?: boolean,
): string[] {
  const errors: string[] = [];
  const code = parsed.moduleCode.toUpperCase();
  if (!code) {
    errors.push("Module is required.");
  } else if (!modules[code]) {
    errors.push(`Module ${code} does not exist.`);
  }
  if (!parsed.title) {
    errors.push("Title is required.");
  }
  const slugCheck = validateSlug(parsed.slug);
  if (!slugCheck.ok) {
    errors.push(slugCheck.error);
  }
  if (!lessonKinds.includes(parsed.kind)) {
    errors.push("Kind must be lesson, recording or worked_example.");
  }
  if (!Number.isInteger(parsed.durationMin) || parsed.durationMin < 1 || parsed.durationMin > 60) {
    errors.push("Duration must be 1–60.");
  }
  if (parsed.summary.length > 300) {
    errors.push("Summary must be 300 characters or fewer.");
  }
  if (parsed.videoUrl && !videoEmbedUrl(parsed.videoUrl)) {
    errors.push("Video host not allowed.");
  }
  if (parsed.departmentCodes !== "all") {
    for (const dep of parsed.departmentCodes) {
      if (!departments[dep]) {
        errors.push(`Unknown department code: ${dep}.`);
      }
    }
  }
  if (parsed.imageRefs.length > 0) {
    errors.push("Image references are not supported in import files.");
  }
  if (existingSlug) {
    // not an error — handled in preview note
  }
  return errors;
}

export function previewRow(
  parsed: ParsedLessonImport,
  modules: ModuleLookup,
  departments: DepartmentLookup,
  existingSlug?: boolean,
): ImportPreviewRow {
  const errors = validateLessonImport(parsed, modules, departments, existingSlug);
  const deptLabel =
    parsed.departmentCodes === "all" ? "All" : parsed.departmentCodes.join(", ");
  return {
    fileName: parsed.fileName,
    moduleCode: parsed.moduleCode.toUpperCase(),
    title: parsed.title,
    kind: parsed.kind,
    durationMin: parsed.durationMin,
    departments: deptLabel,
    ready: errors.length === 0,
    result: errors.length ? errors.join(" ") : "Ready",
    duplicateNote: existingSlug ? "Will update draft of existing lesson." : undefined,
  };
}
