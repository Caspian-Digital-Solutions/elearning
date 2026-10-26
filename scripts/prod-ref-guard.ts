import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { projectRefFromSupabaseUrl } from "../src/lib/supabase/project-ref";

export function readProdProjectRefFromEnv(): string {
  const fromEnv = process.env.SUPABASE_PROD_PROJECT_REF?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  console.error(
    "SUPABASE_PROD_PROJECT_REF is missing. Add it to .env.local when the production project exists (see .env.example).",
  );
  process.exit(1);
}

export function assertProdUrlMatchesRef(url: string, expectedRef: string): void {
  const ref = projectRefFromSupabaseUrl(url);
  if (!ref || ref !== expectedRef) {
    console.error(
      `Production URL ref is ${ref ?? "unknown"}, but SUPABASE_PROD_PROJECT_REF is ${expectedRef}.`,
    );
    process.exit(1);
  }
}

/** Prints the ref and requires an exact typed match before continuing. */
export async function confirmProductionRef(expectedRef: string): Promise<void> {
  console.log(`\nAbout to run on PRODUCTION Supabase ref: ${expectedRef}`);
  console.log("Type that ref exactly to continue (or Ctrl+C to abort):\n");
  const rl = createInterface({ input, output });
  const typed = (await rl.question("> ")).trim();
  rl.close();
  if (typed !== expectedRef) {
    console.error("Ref did not match. Aborted.");
    process.exit(1);
  }
}

export async function confirmYesPhrase(phrase: string): Promise<void> {
  const rl = createInterface({ input, output });
  const typed = (await rl.question(`Type "${phrase}" to continue:\n> `)).trim();
  rl.close();
  if (typed !== phrase) {
    console.error("Confirmation did not match. Aborted.");
    process.exit(1);
  }
}
