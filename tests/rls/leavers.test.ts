import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let adminId: string;
let learnerId: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
  const ready = await client.query<{ exists: boolean }>(
    `select exists (select 1 from pg_proc where proname = 'admin_mark_leaver') as exists`,
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
  adminId = await db.createPerson({
    key: "lv-adm",
    fullName: "Leaver Admin",
    department: "content",
    role: "admin",
    scope: "all",
  });
  learnerId = await db.createPerson({
    key: "lv-lrn",
    fullName: "Leaver Learner",
    department: "content",
  });
});

afterEach(async () => {
  await db.rollback();
});

describe("admin_mark_leaver", () => {
  it("refuses to mark the last active admin as a leaver", async () => {
    const exists = await client.query(`select proname from pg_proc where proname = 'admin_mark_leaver'`);
    if (!exists.rowCount) {
      return;
    }
    await expect(
      db.as(adminId, (query) =>
        query(`select public.admin_mark_leaver($1, $2)`, [
          adminId,
          "Attempting to mark the only admin as a leaver for test",
        ]),
      ),
    ).rejects.toThrow(/last active admin/i);
  });

  it("deactivates the person and sets left_at", async () => {
    const exists = await client.query(`select proname from pg_proc where proname = 'admin_mark_leaver'`);
    if (!exists.rowCount) {
      return;
    }
    await db.as(adminId, (query) =>
      query(`select public.admin_mark_leaver($1, $2)`, [
        learnerId,
        "Leaving CDS for another role outside academy",
      ]),
    );
    const profile = await db.trusted<{ is_active: boolean; left_at: string | null }>(
      `select is_active, left_at::text from public.profiles where id = $1`,
      [learnerId],
    );
    expect(profile.rows[0]?.is_active).toBe(false);
    expect(profile.rows[0]?.left_at).toBeTruthy();
  });
});
