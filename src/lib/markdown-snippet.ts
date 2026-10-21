/** First-line teaser for cards: plain text without Markdown syntax. */
export function markdownSnippet(markdown: string, maxLength = 160): string {
  const firstLine = markdown.trim().split("\n")[0] ?? "";
  const text = firstLine
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#+\s*/, "");
  if (text.length > maxLength) {
    return `${text.slice(0, maxLength - 1)}…`;
  }
  return text;
}
