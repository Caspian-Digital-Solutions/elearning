import { z } from "zod";

/**
 * Public Supabase settings, safe for the browser.
 * Each variable is read by its full literal name so Next.js can inline it
 * into the browser bundle at build time.
 */

export function requiredText(name: string) {
  return z
    .string({ error: `${name} is missing. See .env.example.` })
    .min(1, { error: `${name} is empty. See .env.example.` });
}

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: (issue) =>
      issue.input === undefined
        ? "NEXT_PUBLIC_SUPABASE_URL is missing. See .env.example."
        : "NEXT_PUBLIC_SUPABASE_URL must be a full URL, for example https://abcd.supabase.co.",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: requiredText("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function blankToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

/** One message naming each bad variable. Values are never included. */
export function describeEnvError(error: z.ZodError): string {
  const messages = error.issues.map((issue) => issue.message);
  return `Environment settings are incomplete:\n- ${messages.join("\n- ")}`;
}

export function readPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: blankToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: blankToUndefined(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  });

  if (!parsed.success) {
    throw new Error(describeEnvError(parsed.error));
  }

  return parsed.data;
}
