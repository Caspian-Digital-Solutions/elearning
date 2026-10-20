import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, isRefused, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let learnerId: string;
let trainerId: string;
let pageId: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  await db.begin();
  learnerId = await db.createPerson({
    key: "learner-content-05",
    fullName: "Test Learner Content 05",
    department: "content",
  });
  trainerId = await db.createPerson({
    key: "trainer-content-05",
    fullName: "Test Trainer Content 05",
    department: "content",
    role: "trainer",
  });

  const page = await db.trusted<{ id: string }>(
    `insert into public.pages (slug, title, body_md, status, version)
     values ('rls-test-page-05', 'Published page', 'Live text', 'published', 1)
     returning id`,
  );
  pageId = page.rows[0].id;

  await db.trusted(
    `insert into public.content_drafts (content_type, content_id, title, body_md, metadata)
     values ('page', $1, 'Draft title', 'Secret draft text', '{}')`,
    [pageId],
  );
});

afterEach(async () => {
  await db.rollback();
});

describe("content editor access", () => {
  it("blocks learners from drafts and revisions", async () => {
    const drafts = await db.as(learnerId, (query) => query(`select 1 from public.content_drafts limit 1`));
    expect(drafts.rows).toHaveLength(0);
    const revisions = await db.as(learnerId, (query) =>
      query(`select 1 from public.content_revisions limit 1`),
    );
    expect(revisions.rows).toHaveLength(0);
  });

  it("shows learners the published body, not the draft", async () => {
    const { rows } = await db.as(learnerId, (query) =>
      query<{ body_md: string }>(`select body_md from public.pages where id = $1`, [pageId]),
    );
    expect(rows[0]?.body_md).toBe("Live text");
  });

  it("refuses publish_content for learners", async () => {
    const result = await isRefused(
      db.as(learnerId, (query) =>
        query(`select public.publish_content('page', $1::uuid, 'Should not work')`, [pageId]),
      ),
    );
    expect(result.refused).toBe(true);
  });

  it("hides archived pages from learners", async () => {
    await db.trusted(`update public.pages set status = 'archived' where id = $1`, [pageId]);
    const { rows } = await db.as(learnerId, (query) =>
      query(`select 1 from public.pages where id = $1`, [pageId]),
    );
    expect(rows).toHaveLength(0);
  });

  it("lets a learner confirm only for themselves", async () => {
    await db.as(learnerId, (query) =>
      query(
        `insert into public.page_acknowledgements (user_id, page_id, version) values ($1, $2, 1)`,
        [learnerId, pageId],
      ),
    );
    const other = await isRefused(
      db.as(learnerId, (query) =>
        query(
          `insert into public.page_acknowledgements (user_id, page_id, version) values ($1, $2, 1)`,
          [trainerId, pageId],
        ),
      ),
    );
    expect(other.refused).toBe(true);
    const deleteAttempt = await db.as(learnerId, (query) =>
      query(`delete from public.page_acknowledgements where user_id = $1`, [learnerId]),
    );
    expect(deleteAttempt.rowCount).toBe(0);
    const stillThere = await db.trusted<{ count: string }>(
      `select count(*)::text as count from public.page_acknowledgements where user_id = '${learnerId}'`,
    );
    expect(Number(stillThere.rows[0].count)).toBe(1);
  });
});
