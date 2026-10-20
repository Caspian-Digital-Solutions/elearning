import "server-only";

export { authorise, getCurrentUser, noteLastSeen, requireRole, requireUser } from "@/lib/auth/current-user";
export type { CurrentUser } from "@/lib/auth/types";
