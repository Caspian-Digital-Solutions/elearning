import "server-only";

import { z } from "zod";

const devPreviewRole = z.enum([
  "learner",
  "champion",
  "manager",
  "trainer",
  "admin",
]);

const envSchema = z.object({
  DEV_PREVIEW_ROLE: devPreviewRole.optional(),
});

export type DevPreviewRole = z.infer<typeof devPreviewRole>;

/**
 * Reads the optional development preview role.
 * Supabase variables are added in later prompts. They are not required yet.
 */
export function readDevPreviewRole(): DevPreviewRole | undefined {
  const raw = process.env.DEV_PREVIEW_ROLE;
  const parsed = envSchema.safeParse({
    DEV_PREVIEW_ROLE: raw === undefined || raw.trim() === "" ? undefined : raw.trim(),
  });

  if (!parsed.success) {
    throw new Error(
      "DEV_PREVIEW_ROLE is invalid. Use learner, champion, manager, trainer, or admin. See .env.example.",
    );
  }

  return parsed.data.DEV_PREVIEW_ROLE;
}
