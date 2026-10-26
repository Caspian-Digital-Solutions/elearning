import { parsePlaceholders } from "@/lib/prompts/placeholders";
import type { AiTool, RiskTier } from "@/lib/prompts/types";

const TOOLS: readonly AiTool[] = ["claude", "perplexity", "chatgpt"];
const RISKS: readonly RiskTier[] = ["low", "medium", "high"];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BODY = 12000;

export type PromptImportEntry = {
  title: string;
  slug: string;
  task_type: string;
  tool: AiTool;
  risk_tier: RiskTier;
  body: string;
  usage_notes_md?: string;
  example_md?: string;
  department_code?: string | null;
  module_code?: string | null;
  is_sample?: boolean;
};

export type PromptImportFile = {
  prompts: PromptImportEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePromptImportJson(
  text: string,
): { ok: true; data: PromptImportFile } | { ok: false; errors: string[] } {
  if (text.trim() === "") {
    return { ok: false, errors: ["The file is empty."] };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.prompts)) {
      return { ok: false, errors: ['The file must be a JSON object with a "prompts" array.'] };
    }
    return { ok: true, data: { prompts: parsed.prompts as PromptImportEntry[] } };
  } catch (error) {
    const detail = error instanceof Error ? ` (${error.message})` : "";
    return { ok: false, errors: [`That is not valid JSON${detail}.`] };
  }
}

export type ValidatePromptImportOptions = {
  taskTypes: readonly string[];
  departmentCodes: readonly string[];
  moduleCodes: readonly string[];
};

export function validatePromptImport(
  file: PromptImportFile,
  options: ValidatePromptImportOptions,
): { ok: true; entries: PromptImportEntry[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const taskSet = new Set(options.taskTypes.map((t) => t.toLowerCase()));
  const deptSet = new Set(options.departmentCodes.map((d) => d.toLowerCase()));
  const modSet = new Set(options.moduleCodes.map((m) => m.toLowerCase()));

  file.prompts.forEach((raw, index) => {
    const label = `Prompt ${index + 1}`;
    if (!isRecord(raw)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) {
      errors.push(`${label} title is required.`);
    }
    const slug = typeof raw.slug === "string" ? raw.slug.trim().toLowerCase() : "";
    if (!slug || !SLUG_RE.test(slug)) {
      errors.push(`${label} slug must be lowercase letters, numbers, and hyphens.`);
    }
    const taskType = typeof raw.task_type === "string" ? raw.task_type.trim().toLowerCase() : "";
    if (!taskType || !taskSet.has(taskType)) {
      errors.push(`${label} task_type is not in library.task_types.`);
    }
    const tool = typeof raw.tool === "string" ? raw.tool.trim().toLowerCase() : "";
    if (!TOOLS.includes(tool as AiTool)) {
      errors.push(`${label} tool must be claude, perplexity, or chatgpt.`);
    }
    const risk = typeof raw.risk_tier === "string" ? raw.risk_tier.trim().toLowerCase() : "";
    if (!RISKS.includes(risk as RiskTier)) {
      errors.push(`${label} risk_tier must be low, medium, or high.`);
    }
    const body = typeof raw.body === "string" ? raw.body : "";
    if (!body.trim()) {
      errors.push(`${label} body is required.`);
    } else if (body.length > MAX_BODY) {
      errors.push(`${label} body is longer than ${MAX_BODY} characters.`);
    } else {
      try {
        parsePlaceholders(body);
      } catch {
        errors.push(`${label} has invalid placeholder syntax.`);
      }
    }
    const dept =
      raw.department_code === null || raw.department_code === undefined
        ? null
        : String(raw.department_code).trim().toLowerCase();
    if (dept && !deptSet.has(dept)) {
      errors.push(`${label} department_code "${dept}" is not in the curriculum.`);
    }
    const mod =
      raw.module_code === null || raw.module_code === undefined
        ? null
        : String(raw.module_code).trim().toLowerCase();
    if (mod && !modSet.has(mod)) {
      errors.push(`${label} module_code "${mod}" is not in the curriculum.`);
    }
  });

  if (errors.length) {
    return { ok: false, errors };
  }
  return { ok: true, entries: file.prompts };
}
