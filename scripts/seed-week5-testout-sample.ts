/**
 * Dev only: import and publish docs/content/samples/week5_testout_sample.json via the DB owner connection.
 */
import { Client } from "pg";
import {
  loadAssignmentSample,
  loadDbUrl,
  publishAssignmentSample,
} from "./seed-assignment-sample-shared";

async function main() {
  const file = loadAssignmentSample("docs/content/samples/week5_testout_sample.json");
  const client = new Client({ connectionString: loadDbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await publishAssignmentSample(client, file, 0);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
