import { isPreLaunchDatabase } from "@/lib/system/pre-launch";
import type { CurrentUser } from "@/lib/auth/types";

/** On the live URL before production cut-over: admins and trainers only. */
export function PreLaunchRibbon({ user }: { user: CurrentUser }) {
  if (!isPreLaunchDatabase()) {
    return null;
  }
  if (user.actualRole !== "admin" && user.actualRole !== "trainer") {
    return null;
  }
  return (
    <div
      className="shrink-0 border-b border-amber-700/40 bg-amber-500 px-3 py-1.5 text-center text-sm font-medium text-amber-950"
      role="status"
    >
      Pre-launch — development database
    </div>
  );
}
