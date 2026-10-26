import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { loadPendingAcknowledgementPages } from "@/lib/content/queries";

export async function AcknowledgementBanner() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const pending = await loadPendingAcknowledgementPages(user.id);
  if (!pending.length) {
    return null;
  }
  const names = pending.map((page) => page.title).join(", ");
  return (
    <div className="border-b border-amber-700/30 bg-amber-50 px-4 py-3 text-sm text-heading md:px-8">
      You need to read and confirm: {names}.{" "}
      <Link href="/help" className="font-medium text-accent-strong underline underline-offset-2">
        Open Help
      </Link>
    </div>
  );
}
