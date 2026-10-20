import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, isRefused, RlsSession, testEmailPattern } from "./helpers";

/**
 * Access rules from docs/ACCESS_RULES.md, checked against the dev database.
 * Every test runs in its own transaction and is rolled back.
 */

let client: Client;
let db: RlsSession;

type People = Record<
  | "learnerContent"
  | "learnerContentTwo"
  | "learnerCreative"
  | "learnerSeo"
  | "managerCreative"
  | "managerPerformance"
  | "trainer"
  | "admin"
  | "inactive",
  string
>;

let people: People;
let publishedLessonId: string;
let draftLessonId: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  await db.begin();
  people = {
    learnerContent: await db.createPerson({ key: "learner-content", fullName: "Test Learner Content", department: "content" }),
    learnerContentTwo: await db.createPerson({ key: "learner-content-2", fullName: "Test Learner Content Two", department: "content" }),
    learnerCreative: await db.createPerson({ key: "learner-creative", fullName: "Test Learner Creative", department: "creative" }),
    learnerSeo: await db.createPerson({ key: "learner-seo", fullName: "Test Learner SEO", department: "performance-seo" }),
    managerCreative: await db.createPerson({ key: "manager-creative", fullName: "Test Manager Creative", department: "creative", role: "manager", scope: "department" }),
    managerPerformance: await db.createPerson({ key: "manager-performance", fullName: "Test Manager Performance", department: "performance", role: "manager", scope: "department" }),
    trainer: await db.createPerson({ key: "trainer", fullName: "Test Trainer", department: "content", role: "trainer" }),
    admin: await db.createPerson({ key: "admin", fullName: "Test Admin", department: "senior-management", role: "admin", scope: "all" }),
    inactive: await db.createPerson({ key: "inactive", fullName: "Test Inactive Learner", department: "content", active: false }),
  };

  const lessons = await db.trusted<{ slug: string; id: string }>(
    `insert into public.lessons (module_id, slug, title, status)
     select m.id, v.slug, v.title, v.status::public.content_status
     from public.modules m,
       (values ('rls-test-published', 'Test published lesson', 'published'),
               ('rls-test-draft', 'Test draft lesson', 'draft')) as v (slug, title, status)
     where m.code = 'F1'
     returning slug, id`,
  );
  publishedLessonId = lessons.rows.find((l) => l.slug === "rls-test-published")!.id;
  draftLessonId = lessons.rows.find((l) => l.slug === "rls-test-draft")!.id;
});

afterEach(async () => {
  await db.rollback();
});

describe("sign-in locks", () => {
  it("creates a learner profile with no department for a new CDS account", async () => {
    const { rows } = await db.trusted<{ email: string; full_name: string; role: string; progress_scope: string; department_id: string | null }>(
      `with u as (
         insert into auth.users (id, email, aud, role, raw_user_meta_data)
         values (gen_random_uuid(), 'rls-test-new-' || substr(md5(random()::text), 1, 8) || '@caspiands.com',
                 'authenticated', 'authenticated', '{"full_name": "Test New Starter"}')
         returning id
       )
       select 1 from u`,
    );
    expect(rows).toHaveLength(1);
    const created = await db.trusted<{ full_name: string; role: string; progress_scope: string; department_id: string | null }>(
      `select full_name, role, progress_scope, department_id from public.profiles where full_name = 'Test New Starter'`,
    );
    expect(created.rows).toEqual([
      { full_name: "Test New Starter", role: "learner", progress_scope: "self", department_id: null },
    ]);
  });

  it("refuses to create an account for any other email domain", async () => {
    const result = await isRefused(
      db.trusted(
        `insert into auth.users (id, email, aud, role)
         values (gen_random_uuid(), 'rls-test-outsider@gmail.com', 'authenticated', 'authenticated')`,
      ),
    );
    expect(result.refused).toBe(true);
    expect(result.message).toBe("Please sign in with your CDS Google account.");
  });

  it("has a Before User Created hook that refuses other domains and allows CDS", async () => {
    const { rows } = await db.trusted<{ outsider: unknown; lookalike: unknown; cds: unknown }>(
      `select public.hook_before_user_created('{"user":{"email":"someone@gmail.com"}}') as outsider,
              public.hook_before_user_created('{"user":{"email":"x@caspiands.com.example.org"}}') as lookalike,
              public.hook_before_user_created('{"user":{"email":"Staff.Member@CaspianDS.com"}}') as cds`,
    );
    const refusal = { error: { http_code: 403, message: "Please sign in with your CDS Google account." } };
    expect(rows[0].outsider).toEqual(refusal);
    expect(rows[0].lookalike).toEqual(refusal);
    expect(rows[0].cds).toEqual({});
  });

  it("lets only Supabase Auth run the hook", async () => {
    const { rows } = await db.trusted<{ role: string; allowed: boolean }>(
      `select r as role, has_function_privilege(r, 'public.hook_before_user_created(jsonb)', 'execute') as allowed
       from unnest(array['supabase_auth_admin', 'authenticated', 'anon']) as r`,
    );
    expect(Object.fromEntries(rows.map((r) => [r.role, r.allowed]))).toEqual({
      supabase_auth_admin: true,
      authenticated: false,
      anon: false,
    });
  });
});

describe("profiles", () => {
  it("a learner reads their own profile, not another learner's", async () => {
    const seen = await db.as(people.learnerContent, (q) =>
      q<{ id: string }>("select id from public.profiles"),
    );
    expect(seen.rows.map((r) => r.id)).toEqual([people.learnerContent]);
  });

  it("a learner cannot change their own role or progress scope", async () => {
    const role = await isRefused(
      db.as(people.learnerContent, (q) =>
        q("update public.profiles set role = 'admin' where id = $1", [people.learnerContent]),
      ),
    );
    expect(role.refused).toBe(true);
    expect(role.message).toBe("Only an admin can change a role or progress scope.");

    const scope = await isRefused(
      db.as(people.learnerContent, (q) =>
        q("update public.profiles set progress_scope = 'all' where id = $1", [people.learnerContent]),
      ),
    );
    expect(scope.refused).toBe(true);
  });

  it("a learner can change their own name only", async () => {
    const own = await db.as(people.learnerContent, (q) =>
      q("update public.profiles set full_name = 'Test Learner Content Renamed' where id = $1", [people.learnerContent]),
    );
    expect(own.rowCount).toBe(1);

    const other = await db.as(people.learnerContent, (q) =>
      q("update public.profiles set full_name = 'Changed' where id = $1", [people.learnerContentTwo]),
    );
    expect(other.rowCount).toBe(0);
  });

  it("a trainer can change a learner's department but not their role", async () => {
    const moved = await db.as(people.trainer, (q) =>
      q(
        "update public.profiles set department_id = (select id from public.departments where code = 'creative') where id = $1",
        [people.learnerContent],
      ),
    );
    expect(moved.rowCount).toBe(1);

    const promoted = await isRefused(
      db.as(people.trainer, (q) =>
        q("update public.profiles set role = 'champion' where id = $1", [people.learnerContent]),
      ),
    );
    expect(promoted.refused).toBe(true);
  });

  it("only an admin can change a role, and the change is in the audit log", async () => {
    for (const actor of [people.managerCreative, people.trainer]) {
      // A manager matches no rows (no update rights); a trainer is stopped by the privilege trigger.
      await isRefused(
        db.as(actor, (q) =>
          q("update public.profiles set role = 'champion' where id = $1", [people.learnerCreative]),
        ),
      );
      const unchanged = await db.trusted<{ role: string }>("select role from public.profiles where id = $1", [
        people.learnerCreative,
      ]);
      expect(unchanged.rows[0].role).toBe("learner");
    }

    const changed = await db.as(people.admin, (q) =>
      q("update public.profiles set role = 'champion' where id = $1", [people.learnerCreative]),
    );
    expect(changed.rowCount).toBe(1);

    const audit = await db.as(people.admin, (q) =>
      q<{ actor_id: string; before_role: string; after_role: string }>(
        `select actor_id, before ->> 'role' as before_role, after ->> 'role' as after_role
         from public.audit_log
         where table_name = 'profiles' and action = 'update' and row_id = $1
           and before ->> 'role' is distinct from after ->> 'role'`,
        [people.learnerCreative],
      ),
    );
    expect(audit.rows).toEqual([
      { actor_id: people.admin, before_role: "learner", after_role: "champion" },
    ]);
  });

  it("a manager with department scope sees their department, not another", async () => {
    const seen = await db.as(people.managerCreative, (q) =>
      q<{ id: string }>("select id from public.profiles"),
    );
    const ids = seen.rows.map((r) => r.id);
    expect(ids).toContain(people.learnerCreative);
    expect(ids).toContain(people.managerCreative);
    expect(ids).not.toContain(people.learnerContent);
    expect(ids).not.toContain(people.learnerSeo);
  });

  it("a Performance manager also sees the child departments (SEO)", async () => {
    const seen = await db.as(people.managerPerformance, (q) =>
      q<{ id: string }>("select id from public.profiles where id = any($1)", [
        [people.learnerSeo, people.learnerContent],
      ]),
    );
    expect(seen.rows.map((r) => r.id)).toEqual([people.learnerSeo]);
  });

  it("nobody removes a profile through the API, not even an admin", async () => {
    const removed = await isRefused(
      db.as(people.admin, (q) => q("delete from public.profiles where id = $1", [people.learnerContent])),
    );
    expect(removed.refused).toBe(true);
  });
});

describe("content", () => {
  it("a signed-in user reads modules and published lessons, not draft lessons", async () => {
    const modules = await db.as(people.learnerContent, (q) =>
      q<{ count: string }>("select count(*) from public.modules"),
    );
    expect(Number(modules.rows[0].count)).toBe(30);

    const lessons = await db.as(people.learnerContent, (q) =>
      q<{ id: string }>("select id from public.lessons where id = any($1)", [[publishedLessonId, draftLessonId]]),
    );
    expect(lessons.rows.map((r) => r.id)).toEqual([publishedLessonId]);
  });

  it("a trainer reads draft lessons", async () => {
    const lessons = await db.as(people.trainer, (q) =>
      q<{ id: string }>("select id from public.lessons where id = $1", [draftLessonId]),
    );
    expect(lessons.rows).toHaveLength(1);
  });

  it("a signed-out visitor reads nothing", async () => {
    const result = await isRefused(db.as(null, (q) => q("select id from public.modules")));
    expect(result.refused).toBe(true);
  });

  it("an inactive person reads no reference data", async () => {
    const modules = await db.as(people.inactive, (q) => q("select id from public.modules"));
    expect(modules.rows).toHaveLength(0);
  });

  it("a learner cannot add a department", async () => {
    const changed = await isRefused(
      db.as(people.learnerContent, (q) => q("insert into public.departments (code, name) values ('rls-test', 'Test')")),
    );
    expect(changed.refused).toBe(true);
  });
});

describe("lesson progress", () => {
  it("a learner marks and un-marks their own progress", async () => {
    await db.as(people.learnerContent, (q) =>
      q("insert into public.lesson_progress (user_id, lesson_id) values ($1, $2)", [
        people.learnerContent,
        publishedLessonId,
      ]),
    );
    const removed = await db.as(people.learnerContent, (q) =>
      q("delete from public.lesson_progress where user_id = $1 and lesson_id = $2", [
        people.learnerContent,
        publishedLessonId,
      ]),
    );
    expect(removed.rowCount).toBe(1);
  });

  it("a learner cannot mark progress for someone else", async () => {
    const result = await isRefused(
      db.as(people.learnerContent, (q) =>
        q("insert into public.lesson_progress (user_id, lesson_id) values ($1, $2)", [
          people.learnerContentTwo,
          publishedLessonId,
        ]),
      ),
    );
    expect(result.refused).toBe(true);
  });

  it("a learner cannot un-mark someone else's progress", async () => {
    await db.as(people.learnerContentTwo, (q) =>
      q("insert into public.lesson_progress (user_id, lesson_id) values ($1, $2)", [
        people.learnerContentTwo,
        publishedLessonId,
      ]),
    );
    const removed = await db.as(people.learnerContent, (q) =>
      q("delete from public.lesson_progress where user_id = $1", [people.learnerContentTwo]),
    );
    expect(removed.rowCount).toBe(0);

    const stillThere = await db.trusted<{ count: string }>(
      "select count(*) from public.lesson_progress where user_id = $1",
      [people.learnerContentTwo],
    );
    expect(Number(stillThere.rows[0].count)).toBe(1);
  });

  it("a learner cannot mark a draft lesson complete", async () => {
    const result = await isRefused(
      db.as(people.learnerContent, (q) =>
        q("insert into public.lesson_progress (user_id, lesson_id) values ($1, $2)", [
          people.learnerContent,
          draftLessonId,
        ]),
      ),
    );
    expect(result.refused).toBe(true);
  });

  it("a learner does not see another learner's progress; their manager does", async () => {
    await db.as(people.learnerCreative, (q) =>
      q("insert into public.lesson_progress (user_id, lesson_id) values ($1, $2)", [
        people.learnerCreative,
        publishedLessonId,
      ]),
    );
    const byLearner = await db.as(people.learnerContent, (q) => q("select id from public.lesson_progress"));
    expect(byLearner.rows).toHaveLength(0);
    const byManager = await db.as(people.managerCreative, (q) =>
      q("select id from public.lesson_progress where user_id = $1", [people.learnerCreative]),
    );
    expect(byManager.rows).toHaveLength(1);
  });
});

describe("settings and audit log", () => {
  it("only an admin changes a setting", async () => {
    const byTrainer = await db.as(people.trainer, (q) =>
      q("update public.app_settings set note = 'Changed' where key = 'placement.gates'"),
    );
    expect(byTrainer.rowCount).toBe(0);

    const byAdmin = await db.as(people.admin, (q) =>
      q("update public.app_settings set note = 'Test note' where key = 'placement.gates'"),
    );
    expect(byAdmin.rowCount).toBe(1);
  });

  it("only an admin reads the audit log, and nobody can change it", async () => {
    const byTrainer = await db.as(people.trainer, (q) => q("select id from public.audit_log limit 1"));
    expect(byTrainer.rows).toHaveLength(0);

    const edit = await isRefused(
      db.as(people.admin, (q) => q("update public.audit_log set action = 'insert'")),
    );
    expect(edit.refused).toBe(true);

    const wipe = await isRefused(db.trusted("delete from public.audit_log"));
    expect(wipe.refused).toBe(true);
  });
});

describe("clean-up", () => {
  it("leaves no test users behind from earlier runs", async () => {
    const other = await connect();
    try {
      const { rows } = await other.query<{ count: string }>(
        "select count(*) from auth.users where email like $1",
        [testEmailPattern],
      );
      expect(Number(rows[0].count)).toBe(0);
    } finally {
      await other.end();
    }
  });
});
