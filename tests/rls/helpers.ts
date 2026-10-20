import { resolve } from "node:path";
import { Client, DatabaseError, type QueryResultRow } from "pg";

/**
 * Access-rule test helper. Each test runs inside one transaction on the dev
 * database and is rolled back, so no test users or rows are left behind.
 * Synthetic people use caspiands.com addresses (the sign-in trigger refuses
 * any other domain) with an "rls-test-" prefix and names like "Test Learner Content".
 */

export const testEmailPattern = "rls-test-%@caspiands.com";

type Role = "learner" | "champion" | "manager" | "trainer" | "admin";
type Scope = "self" | "department" | "all";

export type PersonSpec = {
  key: string;
  fullName: string;
  department: string | null;
  role?: Role;
  scope?: Scope;
  active?: boolean;
};

export function databaseUrl(): string {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // The variable may already be set in the shell.
  }
  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url) {
    throw new Error(
      "SUPABASE_DB_URL is missing. Add the dev database Session pooler connection string to .env.local (see .env.example).",
    );
  }
  return url;
}

export async function connect(): Promise<Client> {
  const url = new URL(databaseUrl());
  const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  // pg treats sslmode in the URL as full certificate verification, which overrides `ssl` below.
  url.searchParams.delete("sslmode");
  const client = new Client({
    connectionString: url.toString(),
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

export class RlsSession {
  private savepoint = 0;
  private readonly suffix = Math.random().toString(36).slice(2, 10);

  constructor(private readonly client: Client) {}

  async begin() {
    await this.client.query("begin");
  }

  async rollback() {
    await this.client.query("rollback");
  }

  /** Runs as the trusted database owner (no signed-in user), like the SQL editor. */
  async trusted<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
    const name = `trusted_${++this.savepoint}`;
    await this.client.query(`savepoint ${name}`);
    try {
      const result = await this.client.query<T>(text, values);
      await this.client.query(`release savepoint ${name}`);
      return result;
    } catch (error) {
      await this.client.query(`rollback to savepoint ${name}`);
      throw error;
    }
  }

  async createPerson(spec: PersonSpec): Promise<string> {
    const email = `rls-test-${spec.key}-${this.suffix}@caspiands.com`;
    const { rows } = await this.client.query<{ id: string }>(
      `insert into auth.users (id, email, aud, role, raw_user_meta_data)
       values (gen_random_uuid(), $1, 'authenticated', 'authenticated', jsonb_build_object('full_name', $2::text))
       returning id`,
      [email, spec.fullName],
    );
    const id = rows[0].id;
    await this.client.query(
      `update public.profiles
       set department_id = (select d.id from public.departments d where d.code = $2),
           role = $3::public.app_role,
           progress_scope = $4::public.progress_scope_type,
           is_active = $5
       where id = $1`,
      [id, spec.department, spec.role ?? "learner", spec.scope ?? "self", spec.active ?? true],
    );
    return id;
  }

  /**
   * Runs `work` as a signed-in person (or as a signed-out visitor when userId is null),
   * the way the API does: database role `authenticated`/`anon` plus JWT claims.
   * A failure is rolled back to a savepoint so the test can carry on.
   */
  async as<T>(userId: string | null, work: (query: Query) => Promise<T>): Promise<T> {
    const name = `as_${++this.savepoint}`;
    await this.client.query(`savepoint ${name}`);
    try {
      if (userId) {
        await this.client.query(
          `select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
          [userId],
        );
        await this.client.query("set local role authenticated");
      } else {
        await this.client.query("set local role anon");
      }
      const result = await work((text, values) => this.client.query(text, values ?? []));
      await this.client.query("reset role");
      await this.client.query(`select set_config('request.jwt.claims', '', true)`);
      await this.client.query(`release savepoint ${name}`);
      return result;
    } catch (error) {
      await this.client.query(`rollback to savepoint ${name}`);
      await this.client.query("reset role");
      throw error;
    }
  }
}

export type Query = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
) => Promise<{ rows: T[]; rowCount: number | null }>;

/** The database error code and message, or null when the statement succeeded. */
export async function failure(promise: Promise<unknown>): Promise<{ code: string; message: string } | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (error instanceof DatabaseError) {
      return { code: error.code ?? "", message: error.message };
    }
    throw error;
  }
}

/** True when the database refused the statement for lack of rights (RLS, grants or the privilege trigger). */
export async function isRefused(promise: Promise<unknown>): Promise<{ refused: boolean; message: string }> {
  try {
    await promise;
    return { refused: false, message: "" };
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "42501") {
      return { refused: true, message: error.message };
    }
    throw error;
  }
}
