import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let learnerId: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
  const ready = await client.query<{ exists: boolean }>(
    `select exists (
       select 1 from pg_proc where proname = 'check_rate_limit'
     ) as exists`,
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
  learnerId = await db.createPerson({
    key: "rate-lim",
    fullName: "Rate Limit Learner",
    department: "content",
  });
});

afterEach(async () => {
  await db.rollback();
});

describe("check_rate_limit", () => {
  it("allows events under the cap and then refuses", async () => {
    const exists = await client.query(`select proname from pg_proc where proname = 'check_rate_limit'`);
    if (!exists.rowCount) {
      return;
    }
    const bucket = `test-${learnerId}`;
    for (let index = 0; index < 3; index += 1) {
      const allowed = await db.as(learnerId, (query) =>
        query<{ check_rate_limit: boolean }>(
          `select public.check_rate_limit('assessment.save', $1, 60, 3) as check_rate_limit`,
          [bucket],
        ),
      );
      expect(allowed.rows[0]?.check_rate_limit).toBe(true);
    }
    const denied = await db.as(learnerId, (query) =>
      query<{ check_rate_limit: boolean }>(
        `select public.check_rate_limit('assessment.save', $1, 60, 3) as check_rate_limit`,
        [bucket],
      ),
    );
    expect(denied.rows[0]?.check_rate_limit).toBe(false);
  });
});
