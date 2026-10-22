import "server-only";

import { z } from "zod";

const appEnvSchema = z.enum(["development", "preview", "production"]);

export type AppEnv = z.infer<typeof appEnvSchema>;

/** Deployment environment. Defaults to development when unset (local dev). */
export function readAppEnv(): AppEnv {
  const raw = process.env.APP_ENV?.trim().toLowerCase();
  if (!raw) {
    return process.env.NODE_ENV === "production" ? "preview" : "development";
  }
  const parsed = appEnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("APP_ENV must be development, preview, or production. See .env.example.");
  }
  return parsed.data;
}

export function isProductionAppEnv(): boolean {
  return readAppEnv() === "production";
}
