import "server-only";

export { getCurrentUser, requireRole, requireUser } from "@/lib/auth/current-user";
export type { CurrentUser } from "@/lib/auth/types";
