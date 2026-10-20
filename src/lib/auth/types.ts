import type { AppRole } from "@/config/navigation";

export type CurrentUser = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
};
