import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, failure, isRefused, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let learnerA: string;
let learnerB: string;
let trainerId: string;
let managerId: string;
let moduleF3Id: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  await db.begin();
  learnerA = await db.createPerson({
    key: "learner-plan-a",
    fullName: "Test Learner Plan A",
    department: "content",
  });
  learnerB = await db.createPerson({
    key: "learner-plan-b",
    fullName: "Test Learner Plan B",
    department: "creative",
  });
  trainerId = await db.createPerson({
    key: "trainer-plan",
    fullName: "Test Trainer Plan",
    department: "content",
    role: "trainer",
  });
  managerId = await db.createPerson({
    key: "manager-plan",
    fullName: "Test Manager Plan",
    department: "content",
    role: "manager",
    scope: "department",
  });

  await db.trusted(`update public.profiles set stream = 'practitioner' where id = $1`, [learnerA]);

  const mod = await db.trusted<{ id: string }>(
    `select id from public.modules where code = 'F3' limit 1`,
  );
  moduleF3Id = mod.rows[0]?.id;
});

afterEach(async () => {
  await db.rollback();
});

describe("learner plan access", () => {
  it("builds a plan when placement is confirmed", async () => {
    const asm = await db.trusted<{ id: string }>(
      `insert into public.assessments (code, title, type, status, version, instructions_md, show_review_after_submit)
       values ('rls-plan-week0', 'RLS Plan Week 0', 'placement', 'published', 1, 'Test', false)
       returning id`,
    );
    const assessmentId = asm.rows[0].id;

    const attempt = await db.trusted<{ id: string }>(
      `insert into public.attempts (user_id, assessment_id, status, submitted_at)
       values ($1, $2, 'marked', now()) returning id`,
      [learnerA, assessmentId],
    );

    await db.trusted(
      `insert into public.placement_results (attempt_id, user_id, section_scores, total, suggested_stream)
       values ($1, $2, '{"knowledge":5}'::jsonb, 5, 'practitioner')`,
      [attempt.rows[0].id, learnerA],
    );

    await db.as(trainerId, (query) =>
      query(`select public.confirm_placement($1::uuid, 'practitioner'::public.stream_type, null, false)`, [
        attempt.rows[0].id,
      ]),
    );

    const plan = await db.trusted<{ count: string }>(
      `select count(*)::text as count from public.learner_plan where user_id = $1`,
      [learnerA],
    );
    expect(Number(plan.rows[0].count)).toBeGreaterThan(0);
  });

  it("keeps manual overrides when the plan is regenerated", async () => {
    await db.trusted(
      `insert into public.learner_plan (user_id, module_id, status, reason, set_by, is_override, override_reason)
       select $1, m.id, 'optional', 'seed', $2, true, 'Trainer set optional for test'
       from public.modules m where m.code = 'F3' limit 1`,
      [learnerA, trainerId],
    );

    await db.as(trainerId, (query) => query(`select public.generate_learner_plan($1::uuid)`, [learnerA]));

    const row = await db.trusted<{ status: string; is_override: boolean }>(
      `select lp.status::text, lp.is_override
       from public.learner_plan lp
       join public.modules m on m.id = lp.module_id
       where lp.user_id = $1 and m.code = 'F3'`,
      [learnerA],
    );
    expect(row.rows[0]?.is_override).toBe(true);
    expect(row.rows[0]?.status).toBe("optional");
  });

  it("requires a reason for override_plan_item", async () => {
    const err = await failure(
      db.as(trainerId, (query) =>
        query(
          `select public.override_plan_item($1::uuid, $2::uuid, 'optional'::public.plan_status, 'short')`,
          [learnerA, moduleF3Id],
        ),
      ),
    );
    expect(err?.message).toMatch(/reason/i);
  });

  it("blocks learners from writing learner_plan directly", async () => {
    const err = await failure(
      db.as(learnerA, (query) =>
        query(
          `insert into public.learner_plan (user_id, module_id, status)
           values ($1, $2, 'required') returning id`,
          [learnerA, moduleF3Id],
        ),
      ),
    );
    expect(err?.message).toMatch(/row-level security|policy/i);
  });

  it("blocks learners from calling generate_learner_plan", async () => {
    const refused = await isRefused(
      db.as(learnerA, (query) => query(`select public.generate_learner_plan($1::uuid)`, [learnerA])),
    );
    expect(refused.refused).toBe(true);
  });

  it("lets managers read plan statuses only for people in their department", async () => {
    await db.trusted(
      `insert into public.learner_plan (user_id, module_id, status, reason, set_by)
       select $1, m.id, 'required', 'test', $2 from public.modules m where m.code = 'F3'`,
      [learnerA, trainerId],
    );
    await db.trusted(
      `insert into public.learner_plan (user_id, module_id, status, reason, set_by)
       select $1, m.id, 'required', 'test', $2 from public.modules m where m.code = 'F3'`,
      [learnerB, trainerId],
    );

    const inDept = await db.as(managerId, (query) =>
      query(`select status::text from public.learner_plan where user_id = $1`, [learnerA]),
    );
    expect(inDept.rows.length).toBeGreaterThan(0);

    const otherDept = await db.as(managerId, (query) =>
      query(`select status::text from public.learner_plan where user_id = $1`, [learnerB]),
    );
    expect(otherDept.rows).toHaveLength(0);
  });
});
