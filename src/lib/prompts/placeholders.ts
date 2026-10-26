const PLACEHOLDER_RE = /\{\{([a-z][a-z0-9_]*)\}\}/gi;

/** Unique placeholder names in document order. */
export function parsePlaceholders(body: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const match of body.matchAll(PLACEHOLDER_RE)) {
    const name = match[1].toLowerCase();
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  return ordered;
}

/** Replace `{{name}}` with values (client-side only). Unknown keys stay as-is. */
export function fillPromptBody(body: string, values: Readonly<Record<string, string>>): string {
  return body.replace(PLACEHOLDER_RE, (full, name: string) => {
    const key = name.toLowerCase();
    const value = values[key];
    return value !== undefined ? value : full;
  });
}

export function humanizePlaceholder(name: string): string {
  return name.replaceAll("_", " ");
}
