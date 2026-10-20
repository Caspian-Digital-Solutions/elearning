import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSeedSql,
  expectedCounts,
  parseCurriculum,
  sqlText,
} from "../scripts/seed/build-seed-sql";

const sourceFile = "docs/seed/curriculum_v1_1.json";
const raw = JSON.parse(readFileSync(resolve(sourceFile), "utf8"));
const curriculum = parseCurriculum(raw);

describe("curriculum seed", () => {
  it("produces the row counts Prompt 02 expects", () => {
    expect(expectedCounts(curriculum)).toEqual({
      departments: 10,
      competency_domains: 9,
      stages: 6,
      modules: 30,
      module_domains: 57,
      department_domain_requirements: 33,
      app_settings: 5,
      pages: 5,
    });
  });

  it("matches the committed supabase/seed.sql (run npm run db:seed:generate if this fails)", () => {
    const committed = readFileSync(resolve("supabase/seed.sql"), "utf8");
    expect(buildSeedSql(curriculum, sourceFile)).toBe(committed);
  });

  it("seeds Finance and Operations and Tech delivery as inactive, pending D3", () => {
    const inactive = curriculum.departments.filter((d) => !d.is_active);
    expect(inactive.map((d) => d.code).sort()).toEqual(["finance-ops", "tech-delivery"]);
    expect(inactive.every((d) => d.note === "Pending scope decision D3")).toBe(true);
  });

  it("keeps every module code exactly as F1-F9, P1-P10, L1-L3, S1-S8", () => {
    const codes = curriculum.modules.map((m) => m.code);
    const wanted = [
      ...Array.from({ length: 9 }, (_, i) => `F${i + 1}`),
      ...Array.from({ length: 10 }, (_, i) => `P${i + 1}`),
      ...Array.from({ length: 3 }, (_, i) => `L${i + 1}`),
      ...Array.from({ length: 8 }, (_, i) => `S${i + 1}`),
    ];
    expect([...codes].sort()).toEqual([...wanted].sort());
  });

  it("keeps the PROPOSED notes on placement settings", () => {
    const sql = buildSeedSql(curriculum, sourceFile);
    expect(sql).toContain("'PROPOSED DL-002'");
    expect(sql).toContain("'PROPOSED DL-003'");
    expect(sql).toContain("PROPOSED (DL-002 to DL-004)");
  });

  it("never overwrites edited settings or help pages on a re-run", () => {
    const sql = buildSeedSql(curriculum, sourceFile);
    expect(sql).toMatch(/insert into public\.app_settings[\s\S]*?on conflict \(key\) do nothing;/);
    expect(sql).toMatch(/insert into public\.pages[\s\S]*?on conflict \(slug\) do nothing;/);
  });

  it("does not seed certification Skills or department boundaries yet", () => {
    const sql = buildSeedSql(curriculum, sourceFile);
    const skillNames: string[] = raw.certification_skills.map((s: { name: string }) => s.name);
    expect(skillNames.length).toBeGreaterThan(0);
    for (const name of skillNames) {
      expect(sql).not.toContain(name);
    }
    expect(sql).not.toMatch(/boundar/i);
  });

  it("escapes single quotes in text", () => {
    expect(sqlText("Bharg's note")).toBe("'Bharg''s note'");
    expect(sqlText(null)).toBe("null");
  });

  it("rejects a module that points at an unknown domain", () => {
    const broken = structuredClone(raw);
    broken.modules[0].domains = ["C99"];
    expect(() => parseCurriculum(broken)).toThrow(/unknown domain C99/);
  });
});
