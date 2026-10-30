import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let ready = false;
let learnerA: string;
let learnerB: string;
let managerOther: string;
let taskContent: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
  const { rows } = await client.query<{ exists: boolean }>(
    `select exists (
       select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'time_logs'
     ) as exists`,
  );
  ready = Boolean(rows[0]?.exists);
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  if (!ready) {
    return;
  }
  await db.begin();
  learnerA = await db.createPerson({ key: "tl-la", fullName: "Time Learner A", department: "content" });
  learnerB = await db.createPerson({ key: "tl-lb", fullName: "Time Learner B", department: "creative" });
  managerOther = await db.createPerson({
    key: "tl-mg",
    fullName: "Time Manager Creative",
    department: "creative",
    role: "manager",
    scope: "department",
  });
  const task = await db.trusted<{ id: string }>(
    `select id from public.baseline_tasks where code = 'content-blog-draft' limit 1`,
  );
  taskContent = task.rows[0]?.id ?? "";
});

afterEach(async () => {
  if (ready) {
    await db.rollback();
  }
});

describe("time logs access", () => {
  it("a learner cannot read another learner's baselines or logs", async () => {
    if (!ready || !taskContent) {
      return;
    }
    await db.trusted(
      `insert into public.baselines (user_id, task_id, minutes_without_ai, basis)
       values ($1, $2, 45, 'estimate')`,
      [learnerB, taskContent],
    );
    const baselines = await db.as(learnerA, (q) =>
      q(`select user_id from public.baselines where user_id = $1`, [learnerB]),
    );
    expect(baselines.rows).toHaveLength(0);
    await db.trusted(
      `insert into public.time_logs (user_id, task_id, logged_on, minutes_with_ai, outcome, tools, declaration)
       values ($1, $2, current_date, 20, 'kept', array['claude']::public.time_log_tool_type[], true)`,
      [learnerB, taskContent],
    );
    const logs = await db.as(learnerA, (q) =>
      q(`select user_id from public.time_logs where user_id = $1`, [learnerB]),
    );
    expect(logs.rows).toHaveLength(0);
  });

  it("a manager cannot read individual time log rows", async () => {
    if (!ready || !taskContent) {
      return;
    }
    await db.trusted(
      `insert into public.time_logs (user_id, task_id, logged_on, minutes_with_ai, outcome, tools, declaration)
       values ($1, $2, current_date, 20, 'kept', array['claude']::public.time_log_tool_type[], true)`,
      [learnerB, taskContent],
    );
    const logs = await db.as(managerOther, (q) => q(`select id from public.time_log_trainer_rows limit 5`));
    expect(logs.rows).toHaveLength(0);
  });

  it("save_baseline refuses when locked for learner", async () => {
    if (!ready || !taskContent) {
      return;
    }
    await db.trusted(
      `insert into public.baselines (user_id, task_id, minutes_without_ai, basis, locked_at)
       values ($1, $2, 30, 'estimate', now())`,
      [learnerA, taskContent],
    );
    await expect(
      db.as(learnerA, (q) =>
        q(`select public.save_baseline($1::uuid, 40, 'estimate')`, [taskContent]),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
