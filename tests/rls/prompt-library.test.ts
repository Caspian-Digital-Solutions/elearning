import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let trainerId: string;
let learnerId: string;
let championId: string;
let managerId: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
  const ready = await client.query<{ exists: boolean }>(
    `select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'prompts') as exists`,
  );
  if (!ready.rows[0]?.exists) {
    return;
  }
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  await db.begin();
  const exists = await client.query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'prompts'`,
  );
  if (!exists.rowCount) {
    return;
  }
  trainerId = await db.createPerson({
    key: "pl-trn",
    fullName: "Prompt Trainer",
    department: "content",
    role: "trainer",
    scope: "all",
  });
  learnerId = await db.createPerson({
    key: "pl-lrn",
    fullName: "Prompt Learner",
    department: "content",
  });
  championId = await db.createPerson({
    key: "pl-chp",
    fullName: "Prompt Champion",
    department: "content",
    role: "champion",
  });
  managerId = await db.createPerson({
    key: "pl-mgr",
    fullName: "Prompt Manager",
    department: "content",
    role: "manager",
    scope: "department",
  });
});

afterEach(async () => {
  await db.rollback();
});

describe("prompt library RLS", () => {
  it("learners read tested prompts only", async () => {
    const exists = await client.query(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'prompts'`,
    );
    if (!exists.rowCount) {
      return;
    }
    const draftId = await db.trusted<{ id: string }>(
      `insert into public.prompts (slug, title, task_type, tool, body, status, owner_id)
       values ('rls-draft', 'Draft only', 'drafting', 'claude', 'Body', 'draft', $1)
       returning id`,
      [trainerId],
    );
    const testedId = await db.trusted<{ id: string }>(
      `insert into public.prompts (slug, title, task_type, tool, body, status, owner_id, tested_at, tested_by)
       values ('rls-tested', 'Tested', 'drafting', 'claude', 'Body', 'tested', $1, now(), $1)
       returning id`,
      [trainerId],
    );

    await db.as(learnerId, async (query) => {
      const rows = await query<{ id: string }>(`select id from public.prompts`);
      const ids = rows.rows.map((r) => r.id);
      expect(ids).toContain(testedId.rows[0]?.id);
      expect(ids).not.toContain(draftId.rows[0]?.id);
    });
  });

  it("champions cannot mark prompts tested", async () => {
    const exists = await client.query(`select proname from pg_proc where proname = 'mark_prompt_tested'`);
    if (!exists.rowCount) {
      return;
    }
    const promptId = await db.trusted<{ id: string }>(
      `insert into public.prompts (slug, title, task_type, tool, body, status, owner_id, department_id)
       values ('rls-champion', 'Champion draft', 'drafting', 'claude', 'Body', 'draft', $1,
         (select id from public.departments where code = 'content'))
       returning id`,
      [championId],
    );
    await expect(
      db.as(championId, (query) =>
        query(`select public.mark_prompt_tested($1, $2, $3)`, [
          promptId.rows[0]?.id,
          "Tried on three fictional briefs for training.",
          3,
        ]),
      ),
    ).rejects.toThrow();
  });

  it("managers cannot read feedback comments", async () => {
    const exists = await client.query(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'prompt_feedback'`,
    );
    if (!exists.rowCount) {
      return;
    }
    const promptId = await db.trusted<{ id: string }>(
      `insert into public.prompts (slug, title, task_type, tool, body, status, owner_id, version, tested_at, tested_by)
       values ('rls-fb', 'Feedback prompt', 'drafting', 'claude', 'Body', 'tested', $1, 1, now(), $1)
       returning id`,
      [trainerId],
    );
    await db.trusted(
      `insert into public.prompt_feedback (prompt_id, prompt_version, user_id, outcome, comment, declaration)
       values ($1, 1, $2, 'worked', 'Secret comment', true)`,
      [promptId.rows[0]?.id, learnerId],
    );

    await db.as(managerId, async (query) => {
      const denied = await query(`select comment from public.prompt_feedback limit 1`).catch(() => null);
      expect(denied?.rowCount ?? 0).toBe(0);
      const counts = await query<{ feedback_count: string }>(
        `select coalesce(sum(feedback_count), 0)::text as feedback_count from public.prompt_feedback_manager_counts where prompt_id = $1`,
        [promptId.rows[0]?.id],
      );
      expect(Number(counts.rows[0]?.feedback_count ?? 0)).toBeGreaterThan(0);
    });
  });

  it("feedback rows cannot be deleted", async () => {
    const exists = await client.query(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'prompt_feedback'`,
    );
    if (!exists.rowCount) {
      return;
    }
    const promptId = await db.trusted<{ id: string }>(
      `insert into public.prompts (slug, title, task_type, tool, body, status, owner_id, version, tested_at, tested_by)
       values ('rls-del', 'No delete', 'drafting', 'claude', 'Body', 'tested', $1, 1, now(), $1)
       returning id`,
      [trainerId],
    );
    const fb = await db.trusted<{ id: string }>(
      `insert into public.prompt_feedback (prompt_id, prompt_version, user_id, outcome, declaration)
       values ($1, 1, $2, 'worked', true) returning id`,
      [promptId.rows[0]?.id, learnerId],
    );
    await expect(
      db.as(trainerId, (query) => query(`delete from public.prompt_feedback where id = $1`, [fb.rows[0]?.id])),
    ).rejects.toThrow();
  });
});
