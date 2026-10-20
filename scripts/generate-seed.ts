import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSeedSql, parseCurriculum } from "./seed/build-seed-sql";

const sourceFile = "docs/seed/curriculum_v1_1.json";
const outputFile = "supabase/seed.sql";

const curriculum = parseCurriculum(JSON.parse(readFileSync(resolve(sourceFile), "utf8")));
writeFileSync(resolve(outputFile), buildSeedSql(curriculum, sourceFile));

console.log(`Wrote ${outputFile} from ${sourceFile}.`);
