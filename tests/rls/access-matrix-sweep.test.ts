import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, failure, RlsSession } from "./helpers";
import { accessMatrixCases } from "./fixtures/access-matrix-cases";

let client: Client;
let db: RlsSession;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  await db.begin();
});

afterEach(async () => {
  await db.rollback();
});

describe("access matrix sweep", () => {
  for (const caseRow of accessMatrixCases) {
    it(`${caseRow.persona} ${caseRow.operation} on ${caseRow.target}`, async () => {
      const userId = caseRow.persona === "signed_out"
        ? null
        : await db.createPerson({
            key: `mx-${caseRow.persona}`,
            fullName: `Matrix ${caseRow.persona}`,
            department: caseRow.department ?? "content",
            role: caseRow.role ?? "learner",
            scope: caseRow.scope ?? "self",
            active: caseRow.active ?? true,
          });

      if (caseRow.persona === "inactive" && userId) {
        await db.trusted(`update public.profiles set is_active = false where id = $1`, [userId]);
      }

      if (caseRow.expect === "deny" && caseRow.operation === "select") {
        const rows = await db.as(userId, (query) =>
          query<{ n: number }>(caseRow.sql, caseRow.params ?? []).then((result) => result.rows),
        );
        expect(rows.length).toBe(0);
        return;
      }

      if (caseRow.expect === "allow") {
        const err = await db.as(userId, (query) => failure(query(caseRow.sql, caseRow.params ?? [])));
        expect(err).toBeNull();
        return;
      }

      await expect(
        db.as(userId, (query) => query(caseRow.sql, caseRow.params ?? [])),
      ).rejects.toMatchObject({ code: "42501" });
    });
  }
});
