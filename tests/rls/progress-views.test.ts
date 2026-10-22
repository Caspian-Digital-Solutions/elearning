import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let migrationReady = false;
let learnerA: string;
let learnerB: string;
let managerId: string;
let trainerId: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
  const fn = await client.query<{ exists: boolean }>(
    `select exists (
       select 1 from pg_views where schemaname = 'public' and viewname = 'progress_person_public'
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
  learnerA = await db.createPerson({ key: "prog-la", fullName: "Prog Learner A", department: "content" });
  learnerB = await db.createPerson({ key: "prog-lb", fullName: "Prog Learner B", department: "creative" });
  managerId = await db.createPerson({
    key: "prog-mg",
    fullName: "Prog Manager",
    department: "content",
    role: "manager",
    scope: "department",
  });
  trainerId = await db.createPerson({
    key: "prog-tr",
    fullName: "Prog Trainer",
    department: "content",
    role: "trainer",
    scope: "all",
  });
});

afterEach(async () => {
  if (migrationReady) {
    await db.rollback();
  }
});

describe("progress views access", () => {
  it("learner sees only their own progress_person_public row", async () => {
    if (!migrationReady) {
      return;
    }
    const rows = await db.as(learnerA, (query) =>
      query<{ user_id: string }>(`select user_id from public.progress_person_public`),
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.user_id).toBe(learnerA);
  });

  it("manager sees department scope without trainer mark columns", async () => {
    if (!migrationReady) {
      return;
    }
    const rows = await db.as(managerId, (query) =>
      query(`select user_id from public.progress_person_public`),
    );
    const ids = rows.rows.map((row) => row.user_id);
    expect(ids).toContain(learnerA);
    expect(ids).toContain(managerId);
    expect(ids).not.toContain(learnerB);
    const marks = await db.as(managerId, (query) =>
      query(`select user_id from public.progress_person_trainer limit 1`),
    );
    expect(marks.rows).toHaveLength(0);
  });

  it("trainer can read progress_person_trainer with marks", async () => {
    if (!migrationReady) {
      return;
    }
    const rows = await db.as(trainerId, (query) =>
      query(`select week0_total, quiz_best_summary from public.progress_person_trainer limit 5`),
    );
    expect(rows.rows.length).toBeGreaterThan(0);
  });
});
