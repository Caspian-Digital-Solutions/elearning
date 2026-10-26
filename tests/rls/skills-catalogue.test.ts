import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let trainerId: string;
let learnerId: string;
let championId: string;
let managerId: string;
let managerOtherId: string;
let contentDeptId: string;

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  await db.begin();
  const exists = await client.query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'skills'`,
  );
  if (!exists.rowCount) {
    return;
  }
  contentDeptId = (
    await client.query<{ id: string }>(`select id from public.departments where code = 'content'`)
  ).rows[0]?.id as string;
  trainerId = await db.createPerson({
    key: "sk-trn",
    fullName: "Skill Trainer",
    department: "content",
    role: "trainer",
    scope: "all",
  });
  learnerId = await db.createPerson({
    key: "sk-lrn",
    fullName: "Skill Learner",
    department: "content",
  });
  championId = await db.createPerson({
    key: "sk-chp",
    fullName: "Skill Champion",
    department: "content",
    role: "champion",
  });
  managerId = await db.createPerson({
    key: "sk-mgr",
    fullName: "Skill Manager",
    department: "content",
    role: "manager",
    scope: "department",
  });
  managerOtherId = await db.createPerson({
    key: "sk-mgr2",
    fullName: "Other Manager",
    department: "creative",
    role: "manager",
    scope: "department",
  });
});

afterEach(async () => {
  await db.rollback();
});

describe("skills catalogue RLS", () => {
  it("learners cannot see draft Skills", async () => {
    const exists = await client.query(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'skills'`,
    );
    if (!exists.rowCount) {
      return;
    }
    const draftId = await db.trusted<{ id: string }>(
      `insert into public.skills (name, display_name, department_id, status, description)
       values ('rls-draft-skill', 'Draft skill', $1, 'draft', 'Draft')
       returning id`,
      [contentDeptId],
    );
    await db.as(learnerId, async (query) => {
      const rows = await query<{ id: string }>(`select id from public.skills where id = $1`, [draftId.rows[0]?.id]);
      expect(rows.rowCount).toBe(0);
    });
  });

  it("champions cannot approve Skills", async () => {
    const fn = await client.query(`select proname from pg_proc where proname = 'decide_skill_approval'`);
    if (!fn.rowCount) {
      return;
    }
    const skillId = await db.trusted<{ id: string }>(
      `insert into public.skills (name, display_name, department_id, status, description, owner_id)
       values ('rls-approve-skill', 'Approve skill', $1, 'in_review', 'Test', $2)
       returning id`,
      [contentDeptId, championId],
    );
    const versionId = await db.trusted<{ id: string }>(
      `insert into public.skill_versions (skill_id, version, skill_md_text, test_cases_count, test_cases_passed, created_by)
       values ($1, '1.0', 'body', 8, 8, $2)
       returning id`,
      [skillId.rows[0]?.id, championId],
    );
    await db.trusted(`update public.skills set review_version_id = $1 where id = $2`, [
      versionId.rows[0]?.id,
      skillId.rows[0]?.id,
    ]);
    await expect(
      db.as(championId, (query) =>
        query(`select public.decide_skill_approval($1, 'approved'::public.skill_approval_decision, $2)`, [
          versionId.rows[0]?.id,
          "Looks good for our department workflow.",
        ]),
      ),
    ).rejects.toThrow();
  });

  it("managers of another department cannot approve", async () => {
    const fn = await client.query(`select proname from pg_proc where proname = 'decide_skill_approval'`);
    if (!fn.rowCount) {
      return;
    }
    const skillId = await db.trusted<{ id: string }>(
      `insert into public.skills (name, display_name, department_id, status, description, owner_id)
       values ('rls-mgr-skill', 'Mgr skill', $1, 'in_review', 'Test', $2)
       returning id`,
      [contentDeptId, trainerId],
    );
    const versionId = await db.trusted<{ id: string }>(
      `insert into public.skill_versions (skill_id, version, skill_md_text, test_cases_count, test_cases_passed, created_by)
       values ($1, '1.0', 'body', 8, 8, $2)
       returning id`,
      [skillId.rows[0]?.id, trainerId],
    );
    await db.trusted(`update public.skills set review_version_id = $1 where id = $2`, [
      versionId.rows[0]?.id,
      skillId.rows[0]?.id,
    ]);
    await expect(
      db.as(managerOtherId, (query) =>
        query(`select public.decide_skill_approval($1, 'approved'::public.skill_approval_decision, $2)`, [
          versionId.rows[0]?.id,
          "Approved from the wrong department.",
        ]),
      ),
    ).rejects.toThrow();
  });

  it("submit for review refuses fewer than min test cases", async () => {
    const fn = await client.query(`select proname from pg_proc where proname = 'submit_skill_for_review'`);
    if (!fn.rowCount) {
      return;
    }
    const skillId = await db.trusted<{ id: string }>(
      `insert into public.skills (name, display_name, department_id, status, description, owner_id)
       values ('rls-min-tests', 'Min tests', $1, 'draft', 'Test', $2)
       returning id`,
      [contentDeptId, championId],
    );
    const versionId = await db.trusted<{ id: string }>(
      `insert into public.skill_versions (skill_id, version, skill_md_text, test_cases_count, test_cases_passed, created_by)
       values ($1, '1.0', 'body', 7, 7, $2)
       returning id`,
      [skillId.rows[0]?.id, championId],
    );
    await expect(
      db.as(championId, (query) =>
        query(`select public.submit_skill_for_review($1)`, [versionId.rows[0]?.id]),
      ),
    ).rejects.toThrow();
  });

  it("managers outside the Skill department cannot read usage log rows", async () => {
    const exists = await client.query(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'skill_usage_logs'`,
    );
    if (!exists.rowCount) {
      return;
    }
    const setup = await client.query<{ skill_id: string }>(
      `with s as (
         insert into public.skills (name, display_name, department_id, status, description, current_version, live_since)
         values ('rls-usage-' || gen_random_uuid()::text, 'Usage skill', $1, 'live', 'Test', '1.0', current_date)
         returning id
       )
       insert into public.skill_usage_logs (skill_id, skill_version, user_id, task, outcome, declaration)
       select s.id, '1.0', $2, 'Drafted outline', 'kept'::public.skill_usage_outcome, true from s
       returning skill_id`,
      [contentDeptId, learnerId],
    );
    const skillId = setup.rows[0]?.skill_id;
    await db.as(managerOtherId, async (query) => {
      const denied = await query(`select task from public.skill_usage_logs where skill_id = $1`, [skillId]);
      expect(denied.rowCount).toBe(0);
    });
  });
});
