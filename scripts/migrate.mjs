import { migrateRegisteredPgSchemas } from "../src/persistence/pg-pool.ts";
import { createPostgresGrantStore } from "../src/acl/postgres-grant-store.ts";
import { createPostgresAdminGrantStore } from "../src/admin/postgres-admin-grant-store.ts";
import { createPostgresAuditLog } from "../src/admin/postgres-audit-log.ts";
import { createPostgresDirectoryStore } from "../src/directory/postgres-directory-store.ts";
import { createPostgresFileArtifactStore } from "../src/files/postgres-file-artifact-store.ts";
import { createPostgresFileUploadStore } from "../src/files/file-upload-store.ts";
import { createPostgresSessionStore } from "../src/sessions/postgres-session-store.ts";
import { createPostgresRunStore } from "../src/runs/postgres-run-store.ts";
import { createPostgresRunActivityStore } from "../src/runs/postgres-run-activity-store.ts";
import { createPostgresRunSignalStore } from "../src/runs/postgres-run-signal-store.ts";
import { createPostgresBrokerSessions } from "../src/auth/broker-sessions.ts";
import { createPostgresReplayDedupe } from "../src/auth/replay-dedupe.ts";
import { createPostgresEnvironmentStore } from "../src/environments/environment-store.ts";
import { createPostgresMapFactory } from "../src/persistence/durable-map.ts";
import { createPostgresErrorLog } from "../src/admin/postgres-error-log.ts";
import { createPostgresMetricsSink } from "../src/admin/postgres-metrics-sink.ts";
import pg from "pg";

const url =
  process.env.DATABASE_URL ||
  "postgres://postgres:qm-dev@127.0.0.1:55432/qm_dev_17c43fbe33e1";

createPostgresGrantStore(url);
createPostgresAdminGrantStore(url);
createPostgresAuditLog(url);
createPostgresDirectoryStore(url);
createPostgresFileArtifactStore(url);
createPostgresFileUploadStore(url);
createPostgresSessionStore(url);
createPostgresRunStore(url);
createPostgresRunActivityStore(url);
createPostgresRunSignalStore(url);
createPostgresBrokerSessions(url);
createPostgresReplayDedupe(url);
createPostgresEnvironmentStore(url);
const mapFactory = createPostgresMapFactory(url);
mapFactory.map("soul_configs");
mapFactory.map("soul_history");
mapFactory.map("command_policies");
mapFactory.map("security_postures");
mapFactory.map("sharing_postures");
mapFactory.map("egress_policies");
mapFactory.map("approval_grant_modes");
mapFactory.map("base_model_configs");
mapFactory.map("people_directory_urls");
mapFactory.map("browse_max_steps_configs");
mapFactory.map("browse_model_configs");
mapFactory.map("turn_wall_clock_configs");
mapFactory.map("deployment_identity");
createPostgresErrorLog(url);
createPostgresMetricsSink(url);

await migrateRegisteredPgSchemas(url);

const pool = new pg.Pool({ connectionString: url });
try {
  const { rows: mRows } = await pool.query(
    "SELECT count(*)::int as count FROM qm_schema_migrations",
  );
  const { rows: tRows } = await pool.query(
    "SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = 'public'",
  );
  console.log(
    `[qm:migrate] database migrations applied: ${mRows[0].count} migrations recorded, ${tRows[0].count} tables ready`,
  );
} finally {
  await pool.end();
}
