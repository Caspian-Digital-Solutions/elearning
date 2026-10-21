import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { connect, isRefused, RlsSession } from "./helpers";

let client: Client;
let db: RlsSession;
let learnerId: string;
let trainerId: string;
let moduleId: string;
let lessonId: string;

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
    key: "learner-lessons-06",
    fullName: "Test Learner Lessons 06",
    department: "content",
  });
  trainerId = await db.createPerson({
    key: "trainer-lessons-06",
    fullName: "Test Trainer Lessons 06",
    department: "content",
    role: "trainer",
  });

  const mod = await db.trusted<{ id: string }>(
    `select id from public.modules where code = 'F1' limit 1`,
  );
  moduleId = mod.rows[0].id;

  const lesson = await db.trusted<{ id: string }>(
    `insert into public.lessons (module_id, slug, title, body_md, status, version, duration_min)
     values ($1, 'rls-lesson-06', 'Draft lesson', 'Secret', 'draft', 1, 10)
     returning id`,
    [moduleId],
  );
  lessonId = lesson.rows[0].id;

  await db.trusted(
    `insert into public.content_drafts (content_type, content_id, title, body_md, metadata)
     values ('lesson', $1, 'Draft title', 'Draft body', '{}')`,
    [lessonId],
  );
});

afterEach(async () => {
  await db.rollback();
});

describe("lessons and content-images access", () => {
  it("hides draft lessons and lesson drafts from learners", async () => {
    const lessons = await db.as(learnerId, (query) =>
      query(`select id from public.lessons where id = $1`, [lessonId]),
    );
    expect(lessons.rows).toHaveLength(0);

    const drafts = await db.as(learnerId, (query) =>
      query(`select 1 from public.content_drafts where content_type = 'lesson' limit 1`),
    );
    expect(drafts.rows).toHaveLength(0);
  });

  it("refuses lesson publish and module functions for learners", async () => {
    const publish = await isRefused(
      db.as(learnerId, (query) =>
        query(`select public.publish_content('lesson', $1::uuid, 'Should not work')`, [lessonId]),
      ),
    );
    expect(publish.refused).toBe(true);

    const reorder = await isRefused(
      db.as(learnerId, (query) =>
        query(`select public.reorder_lessons($1::uuid, array[$2::uuid])`, [moduleId, lessonId]),
      ),
    );
    expect(reorder.refused).toBe(true);

    const overview = await isRefused(
      db.as(learnerId, (query) =>
        query(`select public.update_module_overview($1::uuid, 'text', 'Should not work')`, [moduleId]),
      ),
    );
    expect(overview.refused).toBe(true);
  });

  it("stores lesson_version when a learner marks a published lesson complete", async () => {
    await db.trusted(
      `update public.lessons set status = 'published', version = 2, body_md = 'Live' where id = $1`,
      [lessonId],
    );

    const insert = await db.as(learnerId, (query) =>
      query(
        `insert into public.lesson_progress (lesson_id, user_id, completed_at)
         values ($1, $2, now()) returning lesson_version`,
        [lessonId, learnerId],
      ),
    );
    expect(insert.rows[0]?.lesson_version).toBe(2);

    await db.as(learnerId, (query) =>
      query(`delete from public.lesson_progress where lesson_id = $1 and user_id = $2`, [
        lessonId,
        learnerId,
      ]),
    );
  });

  it("blocks learners from uploading to content-images", async () => {
    const result = await isRefused(
      db.as(learnerId, (query) =>
        query(
          `insert into storage.objects (bucket_id, name, owner, metadata)
           values ('content-images', 'lessons/test/upload.png', $1, '{}')`,
          [learnerId],
        ),
      ),
    );
    expect(result.refused).toBe(true);
  });

  it("allows trainers to upload to content-images", async () => {
    const result = await db.as(trainerId, (query) =>
      query(
        `insert into storage.objects (bucket_id, name, owner, metadata)
         values ('content-images', 'lessons/test/trainer-upload.png', $1, '{}')`,
        [trainerId],
      ),
    );
    expect(result.rowCount).toBe(1);
  });
});
