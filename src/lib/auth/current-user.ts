import "server-only";

import type { AppRole } from "@/config/navigation";
import { readDevPreviewRole } from "@/lib/env";
import type { CurrentUser } from "@/lib/auth/types";

/**
 * TEMPORARY — replaced in Prompt 03.
 *
 * Returns a fixed demo user so the empty shell can be clicked through
 * before Google sign-in exists. In development, set DEV_PREVIEW_ROLE
 * in .env.local to learner, champion, manager, trainer, or admin.
 * Production builds always return a learner.
 */

const demoUsers: Record<AppRole, CurrentUser> = {
  learner: {
    id: "demo-learner",
    fullName: "Test Learner Content",
    email: "learner@example.com",
    role: "learner",
  },
  champion: {
    id: "demo-champion",
    fullName: "Test Champion Content",
    email: "champion@example.com",
    role: "champion",
  },
  manager: {
    id: "demo-manager",
    fullName: "Test Manager Content",
    email: "manager@example.com",
    role: "manager",
  },
  trainer: {
    id: "demo-trainer",
    fullName: "Test Trainer Content",
    email: "trainer@example.com",
    role: "trainer",
  },
  admin: {
    id: "demo-admin",
    fullName: "Test Admin Content",
    email: "admin@example.com",
    role: "admin",
  },
};

function resolveRole(): AppRole {
  if (process.env.NODE_ENV === "production") {
    return "learner";
  }
  return readDevPreviewRole() ?? "learner";
}

export function getCurrentUser(): CurrentUser {
  return demoUsers[resolveRole()];
}
