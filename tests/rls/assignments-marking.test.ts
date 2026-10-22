import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, failure, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let migrationReady = false;
let learnerA: string;
let learnerB: string;
let trainerId: string;
let championId: string;
let managerId: string;
let assignmentId: string;
let rubricId: string;
let criterionId: string;
let submissionId: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
  const fn = await client.query<{ exists: boolean }>(
    `select exists (
       select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'submit_assignment'
     ) as exists`,
  );
  migrationReady = Boolean(fn.rows[0]?.exists);
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  if (!migrationReady) {
    return;
  }
  await db.begin();
  learnerA = await db.createPerson({ key: "asm-la", fullName: "Asm Learner A", department: "content" });
  learnerB = await db.createPerson({ key: "asm-lb", fullName: "Asm Learner B", department: "content" });
  trainerId = await db.createPerson({
    key: "asm-tr",
    fullName: "Asm Trainer",
    department: "content",
    role: "trainer",
  });
  championId = await db.createPerson({
    key: "asm-ch",
    fullName: "Asm Champion",
    department: "content",
    role: "champion",
  });
  managerId = await db.createPerson({
    key: "asm-mg",
    fullName: "Asm Manager",
    department: "content",
    role: "manager",
  });

  const moduleRow = await db.trusted<{ id: string }>(
    "select id from public.modules where lower(code) = 'f4' limit 1",
  );
  const rub = await db.trusted<{ id: string }>(
    `insert into public.rubrics (ref, title) values ('RLS-ASM-09', 'RLS rubric') returning id`,
  );
  rubricId = rub.rows[0].id;
  const crit = await db.trusted<{ id: string }>(
    `insert into public.rubric_criteria (rubric_id, name, max_score, sort_order)
     values ($1, 'Quality', 5, 0) returning id`,
    [rubricId],
  );
  criterionId = crit.rows[0].id;
  await db.trusted(
    `insert into public.rubric_levels (criterion_id, score, descriptor) values ($1, 0, 'Low'), ($1, 5, 'High')`,
    [criterionId],
  );

  const asm = await db.trusted<{ id: string }>(
    `insert into public.assignments (
       code, module_id, title, brief_md, rubric_id, submission_types, pass_mark_pct, status, version
     ) values ('rls-asm-09', $1, 'RLS assignment', 'Brief', $2, array['text']::text[], 60, 'published', 1)
     returning id`,
    [moduleRow.rows[0].id, rubricId],
  );
  assignmentId = asm.rows[0].id;

  await db.as(learnerA, (query) =>
    query(`select public.submit_assignment($1, null, null, 'Hello', true)`, [assignmentId]),
  );
  submissionId = (
    await db.trusted<{ id: string }>(
      `select id from public.submissions where assignment_id = $1 and user_id = $2 limit 1`,
      [assignmentId, learnerA],
    )
  ).rows[0].id;
});

afterEach(async () => {
  if (migrationReady) {
    await db.rollback();
  }
});

describe("assignments and marking access", () => {
  it("refuses cross-user submission reads", async () => {
    if (!migrationReady) {
      return;
    }
    const rows = await db.as(learnerB, (query) =>
      query(`select id from public.submissions where id = $1`, [submissionId]),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("hides reviews from learners before release", async () => {
    if (!migrationReady) {
      return;
    }
    await db.as(trainerId, (query) =>
      query(`select public.save_review($1, 'primary', jsonb_build_object($2::text, 5), 'Trainer note')`, [
        submissionId,
        criterionId,
      ]),
    );
    const reviews = await db.as(learnerA, (query) =>
      query(`select id from public.reviews where submission_id = $1`, [submissionId]),
    );
    expect(reviews.rows).toHaveLength(0);
  });

  it("blocks managers from submissions", async () => {
    if (!migrationReady) {
      return;
    }
    const rows = await db.as(managerId, (query) =>
      query(`select id from public.submissions where id = $1`, [submissionId]),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("blocks champion primary save_review", async () => {
    if (!migrationReady) {
      return;
    }
    const err = await failure(
      db.as(championId, (query) =>
        query(`select public.save_review($1, 'primary', '{}'::jsonb, null)`, [submissionId]),
      ),
    );
    expect(err?.code).toBe("42501");
  });

  it("rejects submit without declaration", async () => {
    if (!migrationReady) {
      return;
    }
    const err = await failure(
      db.as(learnerB, (query) =>
        query(`select public.submit_assignment($1, null, null, 'Hi', false)`, [assignmentId]),
      ),
    );
    expect(err?.code).toMatch(/22023|42501/);
  });

  it("rejects disallowed link host", async () => {
    if (!migrationReady) {
      return;
    }
    const linkAsm = await db.trusted<{ id: string }>(
      `insert into public.assignments (
         code, module_id, title, brief_md, rubric_id, submission_types, pass_mark_pct, status, version
       ) values ('rls-asm-link', $1, 'Link only', 'Brief', $2, array['link']::text[], 60, 'published', 1)
       returning id`,
      [
        (await db.trusted<{ id: string }>("select id from public.modules limit 1")).rows[0].id,
        rubricId,
      ],
    );
    const err = await failure(
      db.as(learnerB, (query) =>
        query(
          `select public.submit_assignment($1, 'https://example.com/x', null, null, true)`,
          [linkAsm.rows[0].id],
        ),
      ),
    );
    expect(err?.code).toMatch(/22023|42501/);
  });
});
