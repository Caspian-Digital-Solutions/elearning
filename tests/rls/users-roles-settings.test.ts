import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, failure, isRefused, RlsSession } from "./helpers";

/**
 * Prompt 04 rules: trainer and admin functions, the last-admin guard,
 * paused accounts, cohorts, settings and the audit reason.
 * Every test runs in its own transaction and is rolled back.
 */

let client: Client;
let db: RlsSession;

type People = Record<
  "learnerOne" | "learnerTwo" | "learnerCreative" | "manager" | "trainer" | "inactiveTrainer" | "admin",
  string
>;

let people: People;
let cohortId: string;
let archivedCohortId: string;
let contentDepartmentId: string;

const reason = "Test reason for the audit log";

beforeAll(async () => {
  client = await connect();
  db = new RlsSession(client);
});

afterAll(async () => {
  await client?.end();
});

beforeEach(async () => {
  await db.begin();
  people = {
    learnerOne: await db.createPerson({ key: "p4-learner-1", fullName: "Test Learner Pending One", department: null }),
    learnerTwo: await db.createPerson({ key: "p4-learner-2", fullName: "Test Learner Pending Two", department: null }),
    learnerCreative: await db.createPerson({ key: "p4-learner-creative", fullName: "Test Learner Creative", department: "creative" }),
    manager: await db.createPerson({ key: "p4-manager", fullName: "Test Manager Creative", department: "creative", role: "manager", scope: "department" }),
    trainer: await db.createPerson({ key: "p4-trainer", fullName: "Test Trainer", department: "content", role: "trainer", scope: "all" }),
    inactiveTrainer: await db.createPerson({ key: "p4-trainer-off", fullName: "Test Trainer Paused", department: "content", role: "trainer", scope: "all", active: false }),
    admin: await db.createPerson({ key: "p4-admin", fullName: "Test Admin", department: "senior-management", role: "admin", scope: "all" }),
  };
  const cohorts = await db.trusted<{ id: string; is_archived: boolean }>(
    `insert into public.cohorts (name, start_date, slot, is_archived)
     values ('rls-test-cohort-' || substr(md5(random()::text), 1, 8), '2026-11-02', 'Tuesdays 10:00', false),
            ('rls-test-cohort-old-' || substr(md5(random()::text), 1, 8), '2026-01-05', null, true)
     returning id, is_archived`,
  );
  cohortId = cohorts.rows.find((c) => !c.is_archived)!.id;
  archivedCohortId = cohorts.rows.find((c) => c.is_archived)!.id;
  const department = await db.trusted<{ id: string }>("select id from public.departments where code = 'content'");
  contentDepartmentId = department.rows[0].id;
});

afterEach(async () => {
  await db.rollback();
});

async function profileOf(id: string) {
  const { rows } = await db.trusted<{
    role: string;
    progress_scope: string;
    department_id: string | null;
    cohort_id: string | null;
    stream: string | null;
    is_active: boolean;
  }>("select role, progress_scope, department_id, cohort_id, stream, is_active from public.profiles where id = $1", [id]);
  return rows[0];
}

/** Pauses every other admin on the database inside this test's transaction, so the test admin is the only one. */
async function makeTestAdminTheOnlyAdmin() {
  await db.trusted("update public.profiles set is_active = false where role = 'admin' and is_active and id <> $1", [
    people.admin,
  ]);
}

describe("trainer_update_profiles", () => {
  it("a trainer bulk-sets department and cohort, and the reason is in the audit log", async () => {
    const result = await db.as(people.trainer, (q) =>
      q<{ changed: number }>(
        "select public.trainer_update_profiles(user_ids => $1, department_id => $2, cohort_id => $3, reason => $4) as changed",
        [[people.learnerOne, people.learnerTwo], contentDepartmentId, cohortId, reason],
      ),
    );
    expect(result.rows[0].changed).toBe(2);

    for (const id of [people.learnerOne, people.learnerTwo]) {
      const profile = await profileOf(id);
      expect(profile.department_id).toBe(contentDepartmentId);
      expect(profile.cohort_id).toBe(cohortId);
      expect(profile.role).toBe("learner");
      expect(profile.progress_scope).toBe("self");
    }

    const audit = await db.trusted<{ actor_id: string; reason: string }>(
      "select actor_id, reason from public.audit_log where table_name = 'profiles' and row_id = any($1) and reason is not null",
      [[people.learnerOne, people.learnerTwo]],
    );
    expect(audit.rows).toHaveLength(2);
    expect(audit.rows.every((r) => r.actor_id === people.trainer && r.reason === reason)).toBe(true);
  });

  it("leaves fields it was not given unchanged, and clears only the fields listed", async () => {
    await db.trusted("update public.profiles set stream = 'practitioner', cohort_id = $2 where id = $1", [
      people.learnerCreative,
      cohortId,
    ]);
    await db.as(people.trainer, (q) =>
      q("select public.trainer_update_profiles(user_ids => $1, clear_fields => array['cohort'])", [[people.learnerCreative]]),
    );
    const profile = await profileOf(people.learnerCreative);
    expect(profile.cohort_id).toBeNull();
    expect(profile.stream).toBe("practitioner");
  });

  it("cannot change role or progress scope", async () => {
    const clearRole = await failure(
      db.as(people.trainer, (q) =>
        q("select public.trainer_update_profiles(user_ids => $1, clear_fields => array['role'])", [[people.learnerOne]]),
      ),
    );
    expect(clearRole?.code).toBe("22023");

    const roleArgument = await failure(
      db.as(people.trainer, (q) =>
        q("select public.trainer_update_profiles(user_ids => $1, new_role => 'admin')", [[people.learnerOne]]),
      ),
    );
    expect(roleArgument).not.toBeNull();

    const profile = await profileOf(people.learnerOne);
    expect(profile.role).toBe("learner");
    expect(profile.progress_scope).toBe("self");
  });

  it("is refused for a learner, a manager and an inactive trainer", async () => {
    for (const actor of [people.learnerCreative, people.manager, people.inactiveTrainer]) {
      const refused = await isRefused(
        db.as(actor, (q) =>
          q("select public.trainer_update_profiles(user_ids => $1, department_id => $2)", [
            [people.learnerOne],
            contentDepartmentId,
          ]),
        ),
      );
      expect(refused.refused).toBe(true);
    }
    expect((await profileOf(people.learnerOne)).department_id).toBeNull();
  });

  it("refuses an archived cohort", async () => {
    const result = await failure(
      db.as(people.trainer, (q) =>
        q("select public.trainer_update_profiles(user_ids => $1, cohort_id => $2)", [[people.learnerOne], archivedCohortId]),
      ),
    );
    expect(result?.message).toBe("That cohort does not exist or is archived.");
  });

  it("is all or nothing when one person cannot be found", async () => {
    const result = await failure(
      db.as(people.trainer, (q) =>
        q("select public.trainer_update_profiles(user_ids => $1, department_id => $2)", [
          [people.learnerOne, "00000000-0000-0000-0000-000000000000"],
          contentDepartmentId,
        ]),
      ),
    );
    expect(result?.code).toBe("42501");
    expect((await profileOf(people.learnerOne)).department_id).toBeNull();
  });

  it("a trainer cannot pause their own access or an admin's", async () => {
    const self = await isRefused(
      db.as(people.trainer, (q) =>
        q("select public.trainer_update_profiles(user_ids => $1, is_active => false)", [[people.trainer]]),
      ),
    );
    expect(self.message).toBe("You cannot pause your own access.");

    const admin = await isRefused(
      db.as(people.trainer, (q) =>
        q("select public.trainer_update_profiles(user_ids => $1, is_active => false)", [[people.admin]]),
      ),
    );
    expect(admin.message).toBe("Only an admin can pause or restore an admin's access.");
  });
});

describe("admin_set_role", () => {
  it("a trainer calling it is refused", async () => {
    const result = await isRefused(
      db.as(people.trainer, (q) =>
        q("select public.admin_set_role($1, 'trainer', 'all', $2)", [people.learnerOne, reason]),
      ),
    );
    expect(result.refused).toBe(true);
    expect((await profileOf(people.learnerOne)).role).toBe("learner");
  });

  it("is refused without a reason of at least 10 characters", async () => {
    for (const shortReason of [null, "", "   ", "too short"]) {
      const result = await failure(
        db.as(people.admin, (q) =>
          q("select public.admin_set_role($1, 'trainer', 'all', $2)", [people.learnerOne, shortReason]),
        ),
      );
      expect(result?.message).toBe("Give a reason of at least 10 characters.");
    }
    expect((await profileOf(people.learnerOne)).role).toBe("learner");
  });

  it("with a reason, it succeeds and the reason is in the audit log", async () => {
    await db.as(people.admin, (q) =>
      q("select public.admin_set_role($1, 'trainer', 'all', $2)", [people.learnerOne, reason]),
    );
    const profile = await profileOf(people.learnerOne);
    expect(profile.role).toBe("trainer");
    expect(profile.progress_scope).toBe("all");

    const audit = await db.as(people.admin, (q) =>
      q<{ actor_id: string; reason: string; before_role: string; after_role: string }>(
        `select actor_id, reason, before ->> 'role' as before_role, after ->> 'role' as after_role
         from public.audit_log
         where table_name = 'profiles' and action = 'update' and row_id = $1
           and before ->> 'role' is distinct from after ->> 'role'`,
        [people.learnerOne],
      ),
    );
    expect(audit.rows).toEqual([
      { actor_id: people.admin, reason, before_role: "learner", after_role: "trainer" },
    ]);
  });

  it("the last active admin cannot remove their own admin role", async () => {
    await makeTestAdminTheOnlyAdmin();
    const result = await isRefused(
      db.as(people.admin, (q) => q("select public.admin_set_role($1, 'trainer', 'all', $2)", [people.admin, reason])),
    );
    expect(result.message).toBe(
      "You are the only active admin. Make someone else an admin before you change your own role.",
    );
    expect((await profileOf(people.admin)).role).toBe("admin");
  });

  it("the last active admin cannot be demoted or paused by any route, the SQL editor included", async () => {
    await makeTestAdminTheOnlyAdmin();
    const demote = await isRefused(db.trusted("update public.profiles set role = 'trainer' where id = $1", [people.admin]));
    expect(demote.message).toBe("This would leave no active admin. Make someone else an admin first.");

    const pause = await isRefused(db.trusted("update public.profiles set is_active = false where id = $1", [people.admin]));
    expect(pause.refused).toBe(true);

    const selfPause = await isRefused(
      db.as(people.admin, (q) => q("update public.profiles set is_active = false where id = $1", [people.admin])),
    );
    expect(selfPause.refused).toBe(true);
    expect((await profileOf(people.admin)).is_active).toBe(true);
  });

  it("with a second admin, the first can step down", async () => {
    await makeTestAdminTheOnlyAdmin();
    await db.as(people.admin, (q) =>
      q("select public.admin_set_role($1, 'admin', 'all', $2)", [people.trainer, reason]),
    );
    await db.as(people.admin, (q) => q("select public.admin_set_role($1, 'trainer', 'all', $2)", [people.admin, reason]));
    expect((await profileOf(people.admin)).role).toBe("trainer");
  });
});

describe("paused accounts", () => {
  it("an inactive trainer cannot read other profiles, or their own", async () => {
    const seen = await db.as(people.inactiveTrainer, (q) => q<{ id: string }>("select id from public.profiles"));
    expect(seen.rows).toHaveLength(0);
  });

  it("an inactive person learns only that their access is paused", async () => {
    const status = await db.as(people.inactiveTrainer, (q) =>
      q<{ status: string }>("select public.my_access_status() as status"),
    );
    expect(status.rows[0].status).toBe("paused");

    const active = await db.as(people.trainer, (q) => q<{ status: string }>("select public.my_access_status() as status"));
    expect(active.rows[0].status).toBe("active");
  });

  it("an inactive person cannot rename themselves", async () => {
    const renamed = await db.as(people.inactiveTrainer, (q) =>
      q("update public.profiles set full_name = 'Changed' where id = $1", [people.inactiveTrainer]),
    );
    expect(renamed.rowCount).toBe(0);
  });
});

describe("last seen", () => {
  it("record_last_seen sets the time at most once an hour and writes no audit row", async () => {
    const before = await db.trusted<{ count: string }>("select count(*) from public.audit_log");
    await db.as(people.learnerCreative, (q) => q("select public.record_last_seen()"));
    const first = await db.trusted<{ last_seen_at: Date }>("select last_seen_at from public.profiles where id = $1", [
      people.learnerCreative,
    ]);
    expect(first.rows[0].last_seen_at).not.toBeNull();

    await db.as(people.learnerCreative, (q) => q("select public.record_last_seen()"));
    const second = await db.trusted<{ last_seen_at: Date }>("select last_seen_at from public.profiles where id = $1", [
      people.learnerCreative,
    ]);
    expect(second.rows[0].last_seen_at).toEqual(first.rows[0].last_seen_at);

    const after = await db.trusted<{ count: string }>("select count(*) from public.audit_log");
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  it("nobody sets last_seen_at, email or created_at directly", async () => {
    for (const column of ["last_seen_at = now()", "email = 'x@caspiands.com'", "created_at = now()"]) {
      const result = await isRefused(
        db.as(people.admin, (q) => q(`update public.profiles set ${column} where id = $1`, [people.learnerOne])),
      );
      expect(result.refused).toBe(true);
    }
  });
});

describe("cohorts", () => {
  it("a trainer creates and archives a cohort; a learner cannot create one", async () => {
    const created = await db.as(people.trainer, (q) =>
      q<{ id: string }>(
        "insert into public.cohorts (name, slot, notes) values ('rls-test-new-cohort', 'Thursdays 14:00', 'Test notes') returning id",
      ),
    );
    const archived = await db.as(people.trainer, (q) =>
      q("update public.cohorts set is_archived = true where id = $1", [created.rows[0].id]),
    );
    expect(archived.rowCount).toBe(1);

    const byLearner = await isRefused(
      db.as(people.learnerCreative, (q) => q("insert into public.cohorts (name) values ('rls-test-learner-cohort')")),
    );
    expect(byLearner.refused).toBe(true);
  });

  it("a cohort anyone is in cannot be deleted", async () => {
    await db.trusted("update public.profiles set cohort_id = $2 where id = $1", [people.learnerCreative, cohortId]);
    const result = await failure(
      db.as(people.trainer, (q) => q("delete from public.cohorts where id = $1", [cohortId])),
    );
    expect(result?.code).toBe("23503");
  });

  it("cohort changes are in the audit log", async () => {
    await db.as(people.trainer, (q) => q("update public.cohorts set slot = 'Fridays 09:00' where id = $1", [cohortId]));
    const audit = await db.trusted<{ actor_id: string }>(
      "select actor_id from public.audit_log where table_name = 'cohorts' and row_id = $1 and action = 'update'",
      [cohortId],
    );
    expect(audit.rows.map((r) => r.actor_id)).toEqual([people.trainer]);
  });
});

describe("settings and audit log", () => {
  it("only an admin changes a setting through admin_update_setting, with a reason", async () => {
    const newValue = JSON.stringify({ safety_min_else_foundation: 10, prompting_min_for_practitioner: 15, note: "PROPOSED DL-002" });

    for (const actor of [people.trainer, people.manager, people.learnerCreative]) {
      const refused = await isRefused(
        db.as(actor, (q) => q("select public.admin_update_setting('placement.gates', $1::jsonb, $2)", [newValue, reason])),
      );
      expect(refused.refused).toBe(true);
    }

    const noReason = await failure(
      db.as(people.admin, (q) => q("select public.admin_update_setting('placement.gates', $1::jsonb, '')", [newValue])),
    );
    expect(noReason?.message).toBe("Give a reason of at least 10 characters.");

    await db.as(people.admin, (q) =>
      q("select public.admin_update_setting('placement.gates', $1::jsonb, $2)", [newValue, reason]),
    );
    const audit = await db.as(people.admin, (q) =>
      q<{ actor_id: string; reason: string; safety: string }>(
        `select a.actor_id, a.reason, a.after -> 'value' ->> 'safety_min_else_foundation' as safety
         from public.audit_log a
         join public.app_settings s on s.id = a.row_id
         where a.table_name = 'app_settings' and s.key = 'placement.gates' and a.actor_id = $1`,
        [people.admin],
      ),
    );
    expect(audit.rows).toEqual([{ actor_id: people.admin, reason, safety: "10" }]);
  });

  it("refuses an unknown setting key", async () => {
    const result = await failure(
      db.as(people.admin, (q) => q("select public.admin_update_setting('no.such.key', '{}'::jsonb, $1)", [reason])),
    );
    expect(result?.message).toBe("That setting does not exist.");
  });

  it("only an admin reads the audit log", async () => {
    for (const actor of [people.trainer, people.manager, people.learnerCreative, people.inactiveTrainer]) {
      const seen = await db.as(actor, (q) => q("select id from public.audit_log limit 1"));
      expect(seen.rows).toHaveLength(0);
    }
    const byAdmin = await db.as(people.admin, (q) => q("select id from public.audit_log limit 1"));
    expect(byAdmin.rows).toHaveLength(1);
  });
});
