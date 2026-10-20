export const updateTools = [
  "Claude",
  "ChatGPT",
  "Perplexity",
  "Jira",
  "Confluence",
  "Google Workspace",
  "Other",
] as const;

export type UpdateTool = (typeof updateTools)[number];

export function isUpdateTool(value: string): value is UpdateTool {
  return (updateTools as readonly string[]).includes(value);
}
