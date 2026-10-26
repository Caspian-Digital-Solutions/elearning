import {
  Award,
  BarChart3,
  BookOpen,
  CalendarClock,
  CircleHelp,
  ClipboardCheck,
  FileText,
  FolderPen,
  GitBranch,
  Inbox,
  Library,
  Newspaper,
  Route,
  ScrollText,
  Settings,
  Shield,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const appRoles = [
  "learner",
  "champion",
  "manager",
  "trainer",
  "admin",
] as const;

export type AppRole = (typeof appRoles)[number];

export function isAppRole(value: string): value is AppRole {
  return (appRoles as readonly string[]).includes(value);
}

export const roleLabels: Record<AppRole, string> = {
  learner: "Learner",
  champion: "Champion",
  manager: "Manager",
  trainer: "Trainer",
  admin: "Admin",
};

export type Phase = 1 | 2 | 3;

export type NavGroup = "main" | "trainer" | "admin";

export type Section = {
  title: string;
  purpose: string;
  phase: Phase;
  builtInPrompt: string;
  emptyDetail: string;
};

export const sections = {
  myPath: {
    title: "My path",
    purpose: "Stream, this week, what is due, and what you may skip.",
    phase: 1,
    builtInPrompt: "08",
    emptyDetail: "Your plan appears here after a trainer confirms your stream.",
  },
  lessons: {
    title: "Lessons",
    purpose: "Lessons by module.",
    phase: 1,
    builtInPrompt: "06",
    emptyDetail: "Trainers add lessons here.",
  },
  assessments: {
    title: "Assessments",
    purpose: "Week 0 diagnostic, safety quiz, and module checks.",
    phase: 1,
    builtInPrompt: "07",
    emptyDetail: "Trainers add assessments here.",
  },
  assignments: {
    title: "Assignments",
    purpose: "Briefs, submit, and see feedback.",
    phase: 1,
    builtInPrompt: "09",
    emptyDetail: "Trainers add assignment briefs here.",
  },
  promptLibrary: {
    title: "Prompt library",
    purpose: "Tested prompts, filter by department and task.",
    phase: 2,
    builtInPrompt: "12",
    emptyDetail: "Trainers add tested prompts here.",
  },
  skills: {
    title: "Skills catalogue",
    purpose: "Skills catalogue.",
    phase: 2,
    builtInPrompt: "13",
    emptyDetail: "Trainers add catalogue entries here.",
  },
  whatChanged: {
    title: "What changed",
    purpose: "Weekly tool-change notes.",
    phase: 1,
    builtInPrompt: "05",
    emptyDetail: "Trainers publish weekly notes here.",
  },
  progress: {
    title: "Progress",
    purpose: "Raw counts, sortable and filterable.",
    phase: 1,
    builtInPrompt: "10",
    emptyDetail: "Counts appear here once people start learning.",
  },
  help: {
    title: "Rules and help",
    purpose: "Data rules, risk tiers, glossary, FAQ, and who to ask.",
    phase: 1,
    builtInPrompt: "05",
    emptyDetail: "Trainers write the rules and help pages here.",
  },
  certificates: {
    title: "Certificates",
    purpose: "Own certificates.",
    phase: 3,
    builtInPrompt: "15",
    emptyDetail: "A trainer issues a certificate after the requirements are met.",
  },
  marking: {
    title: "Marking queue",
    purpose: "Assignments waiting to be marked.",
    phase: 1,
    builtInPrompt: "09",
    emptyDetail: "Submitted assignments appear here for trainers to mark.",
  },
  content: {
    title: "Content",
    purpose: "Load and publish lessons, help pages, and notes.",
    phase: 1,
    builtInPrompt: "05–06",
    emptyDetail: "Trainers load lessons and pages here.",
  },
  users: {
    title: "Users",
    purpose: "Manage department, stream, and cohort.",
    phase: 1,
    builtInPrompt: "04",
    emptyDetail: "Trainers assign each person's department here.",
  },
  placements: {
    title: "Placements",
    purpose: "Confirm suggested streams.",
    phase: 1,
    builtInPrompt: "07",
    emptyDetail: "Trainers confirm a suggested stream here.",
  },
  roles: {
    title: "Roles",
    purpose: "Change who can do what.",
    phase: 1,
    builtInPrompt: "04",
    emptyDetail: "An admin changes roles here.",
  },
  people: {
    title: "People and data",
    purpose: "Leavers, retention, and personal data exports.",
    phase: 1,
    builtInPrompt: "11a",
    emptyDetail: "Admin people tools appear here.",
  },
  retention: {
    title: "Retention",
    purpose: "Review people past the retention period.",
    phase: 1,
    builtInPrompt: "11a",
    emptyDetail: "Retention reviews appear here.",
  },
  settings: {
    title: "Settings",
    purpose: "Edit rules that are still under approval.",
    phase: 1,
    builtInPrompt: "04",
    emptyDetail: "An admin edits settings here.",
  },
  audit: {
    title: "Audit log",
    purpose: "Who changed what, and when.",
    phase: 1,
    builtInPrompt: "04",
    emptyDetail: "Changes to roles, marks, and settings are listed here.",
  },
  system: {
    title: "System",
    purpose: "Environment, database ref, and migration head for cut-over checks.",
    phase: 1,
    builtInPrompt: "11b",
    emptyDetail: "Deployment facts appear here.",
  },
} as const satisfies Record<string, Section>;

export type SectionKey = keyof typeof sections;

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: readonly AppRole[];
  group: NavGroup;
  section: SectionKey;
};

const everyone = appRoles;
const trainers = ["trainer", "admin"] as const satisfies readonly AppRole[];
const markingRoles = ["champion", "trainer", "admin"] as const satisfies readonly AppRole[];
const admins = ["admin"] as const satisfies readonly AppRole[];

export const navigation: readonly NavItem[] = [
  {
    label: "My path",
    href: "/my-path",
    icon: Route,
    roles: everyone,
    group: "main",
    section: "myPath",
  },
  {
    label: "Lessons",
    href: "/lessons",
    icon: BookOpen,
    roles: everyone,
    group: "main",
    section: "lessons",
  },
  {
    label: "Assessments",
    href: "/assessments",
    icon: ClipboardCheck,
    roles: everyone,
    group: "main",
    section: "assessments",
  },
  {
    label: "Assignments",
    href: "/assignments",
    icon: FileText,
    roles: everyone,
    group: "main",
    section: "assignments",
  },
  {
    label: "Prompt library",
    href: "/prompt-library",
    icon: Library,
    roles: everyone,
    group: "main",
    section: "promptLibrary",
  },
  {
    label: "Skills catalogue",
    href: "/skills",
    icon: Wrench,
    roles: everyone,
    group: "main",
    section: "skills",
  },
  {
    label: "What changed",
    href: "/what-changed",
    icon: Newspaper,
    roles: everyone,
    group: "main",
    section: "whatChanged",
  },
  {
    label: "Progress",
    href: "/progress",
    icon: BarChart3,
    roles: everyone,
    group: "main",
    section: "progress",
  },
  {
    label: "Rules and help",
    href: "/help",
    icon: CircleHelp,
    roles: everyone,
    group: "main",
    section: "help",
  },
  {
    label: "Certificates",
    href: "/certificates",
    icon: Award,
    roles: everyone,
    group: "main",
    section: "certificates",
  },
  {
    label: "Marking queue",
    href: "/trainer/marking",
    icon: Inbox,
    roles: markingRoles,
    group: "trainer",
    section: "marking",
  },
  {
    label: "Content",
    href: "/trainer/content",
    icon: FolderPen,
    roles: trainers,
    group: "trainer",
    section: "content",
  },
  {
    label: "Users",
    href: "/trainer/users",
    icon: Users,
    roles: trainers,
    group: "trainer",
    section: "users",
  },
  {
    label: "Placements",
    href: "/trainer/placements",
    icon: GitBranch,
    roles: trainers,
    group: "trainer",
    section: "placements",
  },
  {
    label: "Roles",
    href: "/admin/roles",
    icon: Shield,
    roles: admins,
    group: "admin",
    section: "roles",
  },
  {
    label: "People and data",
    href: "/admin/people",
    icon: Users,
    roles: admins,
    group: "admin",
    section: "people",
  },
  {
    label: "Retention",
    href: "/admin/retention",
    icon: CalendarClock,
    roles: admins,
    group: "admin",
    section: "retention",
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    roles: admins,
    group: "admin",
    section: "settings",
  },
  {
    label: "Audit log",
    href: "/admin/audit",
    icon: ScrollText,
    roles: admins,
    group: "admin",
    section: "audit",
  },
  {
    label: "System",
    href: "/admin/system",
    icon: Wrench,
    roles: admins,
    group: "admin",
    section: "system",
  },
];

export function filterNavigation(
  items: readonly NavItem[],
  role: AppRole,
): NavItem[] {
  return items.filter((item) => item.roles.includes(role));
}

export function emptyStateTitle(section: Pick<Section, "phase" | "builtInPrompt">): string {
  if (section.phase === 1) {
    return `Built in Prompt ${section.builtInPrompt}`;
  }
  return `Coming in Phase ${section.phase}`;
}

export function titleForPath(pathname: string): string {
  const matches = navigation.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  matches.sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.label ?? "CDS AI Academy";
}

export function displayParam(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  const clean = decoded.replace(/[\u0000-\u001F\u007F]/g, "").replace(/-/g, " ").trim().slice(0, 80);
  return clean || "Item";
}
