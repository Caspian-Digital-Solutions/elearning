import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, failure, isRefused, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let learnerA: string;
let learnerB: string;
let trainerId: string;
let managerId: string;
let assessmentId: string;
let itemId: string;
let attemptId: string;
let responseId: string;

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
    key: "learner-a-07",
    fullName: "Test Learner A 07",
    department: "content",
  });
  learnerB = await db.createPerson({
    key: "learner-b-07",
    fullName: "Test Learner B 07",
    department: "content",
  });
  trainerId = await db.createPerson({
    key: "trainer-07",
    fullName: "Test Trainer 07",
    department: "content",
    role: "trainer",
  });
  managerId = await db.createPerson({
    key: "manager-07",
    fullName: "Test Manager 07",
    department: "content",
    role: "manager",
  });

  const asm = await db.trusted<{ id: string }>(
    `insert into public.assessments (code, title, type, status, version, instructions_md, show_review_after_submit)
     values ('rls-week0-07', 'RLS Week 0', 'placement', 'published', 1, 'Test', false)
     returning id`,
  );
  assessmentId = asm.rows[0].id;

  const section = await db.trusted<{ id: string }>(
    `insert into public.assessment_sections (assessment_id, code, title, max_score, counts_in_total, sort_order)
     values ($1, 'knowledge', 'Knowledge', 5, true, 0) returning id`,
    [assessmentId],
  );
  const sectionId = section.rows[0].id;

  const item = await db.trusted<{ id: string }>(
    `insert into public.assessment_items (assessment_id, section_id, ref, type, prompt_md, points, options)
     values ($1, $2, 'K1', 'choice', 'Pick one', 5, '[{"id":"a","text":"A"},{"id":"b","text":"B"}]'::jsonb)
     returning id`,
    [assessmentId, sectionId],
  );
  itemId = item.rows[0].id;

  await db.trusted(
    `insert into public.assessment_item_keys (item_id, option_points)
     values ($1, '{"a":5,"b":0}'::jsonb)`,
    [itemId],
  );

  const attempt = await db.trusted<{ id: string }>(
    `insert into public.attempts (user_id, assessment_id, status)
     values ($1, $2, 'in_progress') returning id`,
    [learnerA, assessmentId],
  );
  attemptId = attempt.rows[0].id;

  const response = await db.trusted<{ id: string }>(
    `insert into public.responses (attempt_id, item_id, answer)
     values ($1, $2, '{"option_id":"a"}'::jsonb) returning id`,
    [attemptId, itemId],
  );
  responseId = response.rows[0].id;
});

afterEach(async () => {
  await db.rollback();
});

describe("assessment and placement access", () => {
  it("hides item keys from learners", async () => {
    const keys = await db.as(learnerA, (query) =>
      query(`select 1 from public.assessment_item_keys where item_id = $1`, [itemId]),
    );
    expect(keys.rows).toHaveLength(0);
  });

  it("hides another learner's attempt and responses", async () => {
    const attempts = await db.as(learnerB, (query) =>
      query(`select id from public.attempts where id = $1`, [attemptId]),
    );
    expect(attempts.rows).toHaveLength(0);

    const responses = await db.as(learnerB, (query) =>
      query(`select id from public.responses where id = $1`, [responseId]),
    );
    expect(responses.rows).toHaveLength(0);
  });

  it("blocks response updates after submit", async () => {
    await db.trusted(
      `update public.attempts set status = 'marking', submitted_at = now() where id = $1`,
      [attemptId],
    );
    const update = await db.as(learnerA, (query) =>
      query(`update public.responses set answer = '{"option_id":"b"}'::jsonb where id = $1 returning id`, [
        responseId,
      ]),
    );
    expect(update.rows).toHaveLength(0);
  });

  it("refuses learner placement trainer functions", async () => {
    const calc = await isRefused(
      db.as(learnerA, (query) =>
        query(`select public.calculate_placement($1::uuid)`, [attemptId]),
      ),
    );
    expect(calc.refused).toBe(true);
  });

  it("hides placement results and scores from managers", async () => {
    await db.trusted(
      `insert into public.placement_results (attempt_id, user_id, section_scores, total, confirmed_at, confirmed_stream)
       values ($1, $2, '{}'::jsonb, 0, now(), 'foundation')`,
      [attemptId, learnerA],
    );
    const placement = await db.as(managerId, (query) =>
      query(`select 1 from public.placement_results where attempt_id = $1`, [attemptId]),
    );
    expect(placement.rows).toHaveLength(0);

    const scores = await db.as(managerId, (query) =>
      query(`select 1 from public.response_scores limit 1`),
    );
    expect(scores.rows).toHaveLength(0);
  });

  it("requires override reason on confirm_placement", async () => {
    await db.trusted(
      `update public.attempts set status = 'marked', submitted_at = now() where id = $1`,
      [attemptId],
    );
    await db.trusted(
      `insert into public.placement_results (attempt_id, user_id, section_scores, total, suggested_stream)
       values ($1, $2, '{"knowledge":5}'::jsonb, 5, 'foundation')`,
      [attemptId, learnerA],
    );
    const err = await failure(
      db.as(trainerId, (query) =>
        query(
          `select public.confirm_placement($1::uuid, 'practitioner'::public.stream_type, null, false)`,
          [attemptId],
        ),
      ),
    );
    expect(err?.message).toMatch(/reason/i);
  });

  it("requires portfolio review for champion confirm", async () => {
    await db.trusted(
      `update public.attempts set status = 'marked', submitted_at = now() where id = $1`,
      [attemptId],
    );
    await db.trusted(
      `insert into public.placement_results (attempt_id, user_id, section_scores, total, suggested_stream)
       values ($1, $2, '{"knowledge":5}'::jsonb, 5, 'champion')`,
      [attemptId, learnerA],
    );
    const err = await failure(
      db.as(trainerId, (query) =>
        query(
          `select public.confirm_placement($1::uuid, 'champion'::public.stream_type, 'Portfolio check', false)`,
          [attemptId],
        ),
      ),
    );
    expect(err?.message).toMatch(/portfolio/i);
  });
});
