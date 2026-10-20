import type { AppRole } from "@/config/navigation";
import type { Database } from "@/lib/types/database";

type Enums = Database["public"]["Enums"];

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  /** Role used for menus and page checks. Differs from actualRole only in a development preview. */
  role: AppRole;
  /** Role stored in the database. Row-level security always uses this one. */
  actualRole: AppRole;
  isPreviewingRole: boolean;
  progressScope: Enums["progress_scope_type"];
  departmentId: string | null;
  departmentName: string | null;
  stream: Enums["stream_type"] | null;
  lastSeenAt: string | null;
};
