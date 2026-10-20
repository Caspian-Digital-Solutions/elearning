export function wordCount(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_\-\[\]()!`]/g, " ")
    .trim();
  if (!text) {
    return 0;
  }
  return text.split(/\s+/).filter(Boolean).length;
}

/** Rough reading time at 200 words per minute. */
export function readingMinutes(markdown: string): number {
  const words = wordCount(markdown);
  return Math.max(1, Math.ceil(words / 200));
}
