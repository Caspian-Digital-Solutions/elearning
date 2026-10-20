const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const reservedSlugs = new Set(["new", "edit", "admin", "trainer"]);

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function validateSlug(slug: string): { ok: true } | { ok: false; error: string } {
  const value = slug.trim();
  if (!value) {
    return { ok: false, error: "Enter a slug." };
  }
  if (!slugPattern.test(value)) {
    return { ok: false, error: "Use lowercase letters, numbers and hyphens only." };
  }
  if (reservedSlugs.has(value)) {
    return { ok: false, error: "That slug is reserved. Choose another." };
  }
  return { ok: true };
}
