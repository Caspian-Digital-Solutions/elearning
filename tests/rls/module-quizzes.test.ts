import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, failure, isRefused, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let learnerId: string;
let otherLearnerId: string;
let managerId: string;
let assessmentId: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  await db.begin();
  learnerId = await db.createPerson({ key: "quiz-learner", fullName: "Quiz Learner", department: "content" });
  otherLearnerId = await db.createPerson({
    key: "quiz-other",
    fullName: "Quiz Other",
    department: "content",
  });
  managerId = await db.createPerson({
    key: "quiz-manager",
    fullName: "Quiz Manager",
    department: "content",
    role: "manager",
  });

  const moduleRow = await db.trusted<{ id: string }>(
    "select id from public.modules where lower(code) = 'f1' limit 1",
  );
  const moduleId = moduleRow.rows[0]?.id;
  if (!moduleId) {
    throw new Error("F1 module missing from seed");
  }

  const asm = await db.trusted<{ id: string }>(
    `insert into public.assessments (
       code, title, type, status, version, instructions_md, module_id, pass_mark_pct, max_attempts, show_review_after_submit
     ) values ('rls-quiz-07b', 'RLS Quiz', 'quiz', 'published', 1, 'Test', $1, 80, 1, true)
     returning id`,
    [moduleId],
  );
  assessmentId = asm.rows[0].id;

  const section = await db.trusted<{ id: string }>(
    `insert into public.assessment_sections (assessment_id, code, title, max_score, counts_in_total, sort_order)
     values ($1, 'check', 'Check', 5, true, 0) returning id`,
    [assessmentId],
  );

  for (const ref of ["Q1", "Q2"]) {
    const item = await db.trusted<{ id: string }>(
      `insert into public.assessment_items (assessment_id, section_id, ref, type, prompt_md, points, options, difficulty)
       values ($1, $2, $3, 'choice', 'Pick', 1, '[{"id":"a","text":"A"},{"id":"b","text":"B"}]'::jsonb, 1)
       returning id`,
      [assessmentId, section.rows[0].id, ref],
    );
    await db.trusted(
      `insert into public.assessment_item_keys (item_id, option_points, explanation_md)
       values ($1, '{"a":0,"b":1}'::jsonb, 'Because B.')`,
      [item.rows[0].id],
    );
  }
});

afterEach(async () => {
  await db.rollback();
});

describe("module quiz access", () => {
  it("learner cannot read assessment_item_keys", async () => {
    const keys = await db.as(learnerId, (query) =>
      query(`select 1 from public.assessment_item_keys limit 1`),
    );
    expect(keys.rows).toHaveLength(0);
  });

  it("get_attempt_review refuses another user's attempt", async () => {
    const started = await db.as(learnerId, (query) =>
      query<{ id: string }>(`select (public.start_attempt($1)).id`, [assessmentId]),
    );
    const attemptId = started.rows[0]?.id;
    expect(attemptId).toBeTruthy();

    await db.as(learnerId, (query) =>
      query(`select public.submit_attempt($1, false)`, [attemptId]),
    );

    const denied = await isRefused(
      db.as(otherLearnerId, (query) =>
        query(`select * from public.get_attempt_review($1)`, [attemptId]),
      ),
    );
    expect(denied.refused).toBe(true);
  });

  it("max_attempts blocks a second start_attempt", async () => {
    const first = await db.as(learnerId, (query) =>
      query<{ id: string }>(`select (public.start_attempt($1)).id`, [assessmentId]),
    );
    const attemptId = first.rows[0]?.id;
    await db.as(learnerId, (query) =>
      query(`select public.submit_attempt($1, false)`, [attemptId]),
    );
    const second = await failure(
      db.as(learnerId, (query) => query(`select public.start_attempt($1)`, [assessmentId])),
    );
    expect(second?.message).toMatch(/attempt/i);
  });

  it("manager cannot read quiz attempts for others", async () => {
    const result = await db.as(managerId, (query) =>
      query(`select id from public.attempts where assessment_id = $1`, [assessmentId]),
    );
    expect(result.rows).toHaveLength(0);
  });
});
