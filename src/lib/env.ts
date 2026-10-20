import "server-only";

import { z } from "zod";
import {
  blankToUndefined,
  describeEnvError,
  readPublicEnv,
  requiredText,
  type PublicEnv,
} from "@/lib/env-public";

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

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: requiredText("SUPABASE_SECRET_KEY"),
});

export type DevPreviewRole = z.infer<typeof devPreviewRole>;
export type ServerEnv = PublicEnv & z.infer<typeof serverEnvSchema>;

/**
 * Reads the optional development preview role.
 * Replaced by real sign-in in Prompt 03.
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

export { readPublicEnv };

/** Public settings plus the secret key. Server code only. */
export function readServerEnv(): ServerEnv {
  const publicEnv = readPublicEnv();
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SECRET_KEY: blankToUndefined(process.env.SUPABASE_SECRET_KEY),
  });

  if (!parsed.success) {
    throw new Error(describeEnvError(parsed.error));
  }

  return { ...publicEnv, ...parsed.data };
}
