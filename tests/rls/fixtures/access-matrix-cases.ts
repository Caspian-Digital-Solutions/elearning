export type MatrixPersona =
  | "signed_out"
  | "inactive"
  | "learner"
  | "champion"
  | "manager"
  | "trainer"
  | "admin";

export type MatrixCase = {
  persona: MatrixPersona;
  operation: string;
  target: string;
  sql: string;
  params?: unknown[];
  expect: "allow" | "deny";
  role?: "learner" | "champion" | "manager" | "trainer" | "admin";
  scope?: "self" | "department" | "all";
  department?: string | null;
  active?: boolean;
};

/** Representative sweep aligned with docs/ACCESS_RULES.md; extended over time. */
export const accessMatrixCases: MatrixCase[] = [
  {
    persona: "signed_out",
    operation: "insert",
    target: "lesson_progress",
    sql: "insert into public.lesson_progress (user_id, lesson_id) values (gen_random_uuid(), gen_random_uuid())",
    expect: "deny",
  },
  {
    persona: "inactive",
    operation: "select",
    target: "lessons",
    sql: "select id from public.lessons limit 1",
    expect: "deny",
    role: "learner",
  },
  {
    persona: "learner",
    operation: "select",
    target: "profiles",
    sql: "select id from public.profiles where id = auth.uid()",
    expect: "allow",
    role: "learner",
    department: "content",
  },
  {
    persona: "learner",
    operation: "select",
    target: "audit_log",
    sql: "select id from public.audit_log limit 1",
    expect: "deny",
    role: "learner",
    department: "content",
  },
  {
    persona: "manager",
    operation: "select",
    target: "attempts",
    sql: "select id from public.attempts limit 1",
    expect: "deny",
    role: "manager",
    scope: "department",
    department: "content",
  },
  {
    persona: "trainer",
    operation: "select",
    target: "audit_log",
    sql: "select id from public.audit_log limit 1",
    expect: "deny",
    role: "trainer",
    scope: "all",
    department: "content",
  },
  {
    persona: "admin",
    operation: "select",
    target: "audit_log",
    sql: "select id from public.audit_log limit 1",
    expect: "allow",
    role: "admin",
    scope: "all",
    department: "content",
  },
  {
    persona: "learner",
    operation: "select",
    target: "assessment_item_keys",
    sql: "select id from public.assessment_item_keys limit 1",
    expect: "deny",
    role: "learner",
    department: "content",
  },
  {
    persona: "trainer",
    operation: "select",
    target: "assessment_item_keys",
    sql: "select id from public.assessment_item_keys limit 1",
    expect: "allow",
    role: "trainer",
    scope: "all",
    department: "content",
  },
  {
    persona: "learner",
    operation: "insert",
    target: "lesson_progress",
    sql: `insert into public.lesson_progress (user_id, lesson_id)
          select auth.uid(), l.id from public.lessons l where l.status = 'published' limit 1`,
    expect: "allow",
    role: "learner",
    department: "content",
  },
];
