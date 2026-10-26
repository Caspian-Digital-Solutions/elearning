const NAME_RE = /^[a-z0-9-]{1,64}$/;
const FORBIDDEN_NAME = /(claude|anthropic)/i;
const MAX_DESCRIPTION = 1024;
const MAX_SKILL_MD = 102_400;

export function validateSkillName(name: string): string | null {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) {
    return "Name is required.";
  }
  if (trimmed.length > 64) {
    return "Name must be at most 64 characters.";
  }
  if (!NAME_RE.test(trimmed)) {
    return "Name must use lowercase letters, numbers and hyphens only.";
  }
  if (FORBIDDEN_NAME.test(trimmed)) {
    return 'Name cannot contain "claude" or "anthropic".';
  }
  return null;
}

export function validateSkillDescription(description: string): string | null {
  if (description.length > MAX_DESCRIPTION) {
    return "Description must be at most 1024 characters.";
  }
  return null;
}

export function validateSkillMdLength(text: string): string | null {
  if (text.length > MAX_SKILL_MD) {
    return "Instructions text must be at most 100 KB.";
  }
  return null;
}

export type SkillFrontMatter = {
  name?: string;
  description?: string;
};

/** Reads optional YAML-style front matter at the top of a Skill instructions file. */
export function parseSkillFrontMatter(text: string): SkillFrontMatter {
  const match = /^\s*---\s*\n([\s\S]*?)\n---/.exec(text);
  if (!match) {
    return {};
  }
  const block = match[1];
  const nameMatch = /(?:^|\n)name:\s*(.+)$/im.exec(block);
  const descMatch = /(?:^|\n)description:\s*(.+)$/im.exec(block);
  return {
    name: nameMatch?.[1]?.trim(),
    description: descMatch?.[1]?.trim(),
  };
}

export function validateSkillFrontMatter(
  text: string,
  catalogue: { name: string; description: string },
): string | null {
  const fm = parseSkillFrontMatter(text);
  if (fm.name && fm.name.toLowerCase() !== catalogue.name.toLowerCase()) {
    return `Front-matter name must match the catalogue name (${catalogue.name}).`;
  }
  if (fm.description && fm.description.trim() !== catalogue.description.trim()) {
    return "Front-matter description must match the catalogue description.";
  }
  return null;
}

export function normaliseSkillName(name: string): string {
  return name.trim().toLowerCase();
}
