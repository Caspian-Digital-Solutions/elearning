import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { needsAcknowledgementBanner } from "@/lib/content/queries";

export async function AcknowledgementBanner() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const show = await needsAcknowledgementBanner(user.id);
  if (!show) {
    return null;
  }
  return (
    <div className="border-b border-amber-700/30 bg-amber-50 px-4 py-3 text-sm text-heading md:px-8">
      You need to read and confirm an updated help page (for example data rules or the privacy notice).{" "}
      <Link href="/help" className="font-medium text-accent-strong underline underline-offset-2">
        Open Help
      </Link>
    </div>
  );
}
