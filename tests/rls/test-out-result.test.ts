import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, failure, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let learnerId: string;
let migrationReady = false;
let assessmentId: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
  const fn = await client.query<{ exists: boolean }>(
    `select exists (
       select 1 from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'apply_test_out_result'
     ) as exists`,
  );
  migrationReady = Boolean(fn.rows[0]?.exists);
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  await db.begin();
  learnerId = await db.createPerson({
    key: "test-out-learner",
    fullName: "Test Out Learner",
    department: "content",
  });
  await db.trusted(`update public.profiles set stream = 'practitioner' where id = $1`, [learnerId]);

  const moduleRow = await db.trusted<{ id: string }>(
    "select id from public.modules where lower(code) = 'f1' limit 1",
  );
  const moduleId = moduleRow.rows[0]?.id;
  if (!moduleId) {
    throw new Error("F1 module missing from seed");
  }

  const asm = await db.trusted<{ id: string }>(
    `insert into public.assessments (
       code, title, type, status, version, instructions_md, module_id, pass_mark_pct, max_attempts,
       show_review_after_submit, is_sample
     ) values ('week1-testout-rls', 'RLS Week 1 test-out', 'quiz', 'published', 1, 'Test', $1, 80, 1, true, true)
     returning id`,
    [moduleId],
  );
  assessmentId = asm.rows[0].id;

  const section = await db.trusted<{ id: string }>(
    `insert into public.assessment_sections (assessment_id, code, title, max_score, counts_in_total, sort_order)
     values ($1, 'check', 'Check', 1, true, 0) returning id`,
    [assessmentId],
  );

  const item = await db.trusted<{ id: string }>(
    `insert into public.assessment_items (assessment_id, section_id, ref, type, prompt_md, points, options, difficulty)
     values ($1, $2, 'Q1', 'choice', 'Pick', 1, '[{"id":"a","text":"A"},{"id":"b","text":"B"}]'::jsonb, 1)
     returning id`,
    [assessmentId, section.rows[0].id],
  );
  await db.trusted(
    `insert into public.assessment_item_keys (item_id, option_points, explanation_md)
     values ($1, '{"a":0,"b":1}'::jsonb, 'Because B.')`,
    [item.rows[0].id],
  );

  await db.trusted(
    `update public.app_settings
     set value = jsonb_set(
       value,
       '{streams,practitioner,test_outs,0,source_code}',
       to_jsonb('week1-testout-rls'::text),
       false
     )
     where key = 'plan.stream_rules'`,
  );
});

afterEach(async () => {
  await db.rollback();
});

describe("apply_test_out_result access", () => {
  it("blocks learners from calling apply_test_out_result directly", async ({ skip }) => {
    if (!migrationReady) {
      skip();
    }
    const err = await failure(
      db.as(learnerId, (query) =>
        query(`select public.apply_test_out_result($1::uuid, $2::text)`, [learnerId, "week1"]),
      ),
    );
    expect(err?.message).toMatch(/permission|denied|42501|privilege/i);
  });

  it("applies week1 test-out when the learner submits the linked quiz", async ({ skip }) => {
    if (!migrationReady) {
      skip();
    }

    const mod = await db.trusted<{ id: string }>(
      `select id from public.modules where code = 'F1' limit 1`,
    );

    await db.trusted(
      `insert into public.learner_plan (user_id, module_id, status, reason, due_week)
       values ($1, $2, 'test_out_pending', 'Practitioner stream: pass test-out to skip', 1)
       on conflict (user_id, module_id) do update set status = excluded.status`,
      [learnerId, mod.rows[0].id],
    );

    const started = await db.as(learnerId, (query) =>
      query<{ id: string }>(`select (public.start_attempt($1)).id`, [assessmentId]),
    );
    const attemptId = started.rows[0]?.id;
    expect(attemptId).toBeTruthy();

    const items = await db.trusted<{ id: string }>(
      `select id from public.assessment_items where assessment_id = $1`,
      [assessmentId],
    );
    for (const row of items.rows) {
      await db.trusted(
        `insert into public.responses (attempt_id, item_id, answer) values ($1, $2, '{"option_id":"b"}'::jsonb)`,
        [attemptId, row.id],
      );
    }

    await db.as(learnerId, (query) => query(`select public.submit_attempt($1, false)`, [attemptId]));

    const planRow = await db.trusted<{ status: string; reason: string }>(
      `select status::text, reason from public.learner_plan where user_id = $1 and module_id = $2`,
      [learnerId, mod.rows[0].id],
    );
    expect(planRow.rows[0]?.status).toBe("tested_out");
    expect(planRow.rows[0]?.reason).toMatch(/Passed Week 1 test-out/);
  });
});
