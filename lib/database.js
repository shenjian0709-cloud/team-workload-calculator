const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const model = require("../public/model");

async function openDatabase(filename) {
  fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  const run = async (sql, params = []) => {
    const result = db.prepare(sql).run(...params);
    return {
      id: Number(result.lastInsertRowid),
      changes: Number(result.changes),
    };
  };
  const all = async (sql, params = []) => db.prepare(sql).all(...params);
  const get = async (sql, params = []) => (await all(sql, params))[0];
  const close = async () => db.close();
  await run("PRAGMA foreign_keys=ON");
  await run("PRAGMA busy_timeout=5000");
  await run("PRAGMA journal_mode=WAL");
  await run(
    "CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)",
  );
  await run(
    `CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, team_group TEXT, capability_type TEXT, work_pattern TEXT)`,
  );
  const columns = (await all("PRAGMA table_info(members)")).map((x) => x.name);
  for (const [name, type] of Object.entries({
    team_group: "TEXT",
    capability_type: "TEXT",
    work_pattern: "TEXT",
    archived_at: "TEXT",
    legacy_group: "TEXT",
    revision: "INTEGER NOT NULL DEFAULT 0",
  })) {
    if (!columns.includes(name))
      await run(`ALTER TABLE members ADD COLUMN ${name} ${type}`);
  }
  await run(`CREATE TABLE IF NOT EXISTS weekly_reports (
    member_id INTEGER NOT NULL REFERENCES members(id), week_key TEXT NOT NULL,
    name TEXT NOT NULL, team_group TEXT, capability_type TEXT NOT NULL, work_pattern TEXT NOT NULL,
    inc_count INTEGER NOT NULL DEFAULT 0, req_count INTEGER NOT NULL DEFAULT 0,
    chg_count INTEGER NOT NULL DEFAULT 0, prb_count INTEGER NOT NULL DEFAULT 0,
    active_projects INTEGER NOT NULL DEFAULT 0, task_count INTEGER NOT NULL DEFAULT 0,
    available_hours REAL NOT NULL DEFAULT 40, note TEXT NOT NULL DEFAULT '',
    model_version TEXT NOT NULL DEFAULT '2.0', legacy_load REAL,
    revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(member_id,week_key))`);
  if (!(await get("SELECT version FROM schema_versions WHERE version=2"))) {
    await run("BEGIN IMMEDIATE");
    try {
      await run(
        "UPDATE members SET legacy_group=team_group, team_group=NULL WHERE team_group IS NULL OR team_group NOT IN ('INFR','ADI','SMO','TO')",
      );
      await run(
        "UPDATE members SET capability_type=COALESCE(capability_type,'tech_generalist_advanced'), work_pattern=COALESCE(work_pattern,'routine_support')",
      );
      const hasHistory = await get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='member_weekly_snapshots'",
      );
      if (hasHistory) {
        const snapshots = await all(
          "SELECT s.* FROM member_weekly_snapshots s JOIN members m ON m.id=s.member_id",
        );
        for (const s of snapshots) {
          try {
            model.weekDate(s.week_key);
          } catch {
            continue;
          } // Original table remains intact for review.
          await run(
            `INSERT OR IGNORE INTO weekly_reports
            (member_id,week_key,name,team_group,capability_type,work_pattern,inc_count,req_count,chg_count,prb_count,active_projects,task_count,model_version,legacy_load,note)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              s.member_id,
              s.week_key,
              s.name || "未命名成员",
              s.team_group,
              s.capability_type || "tech_generalist_advanced",
              s.work_pattern || "routine_support",
              s.inc_count || 0,
              s.req_count || 0,
              s.chg_count || 0,
              s.prb_count || 0,
              s.active_projects || 0,
              s.planner_tasks || 0,
              "1.3",
              s.final_load || 0,
              "旧版快照；可用工时未记录，按 40h 基准展示。",
            ],
          );
        }
      }
      await run("INSERT INTO schema_versions(version) VALUES (2)");
      await run("COMMIT");
    } catch (e) {
      await run("ROLLBACK");
      throw e;
    }
  }
  let queue = Promise.resolve();
  // Serialize complete API operations, including reads, so none observes an uncommitted write.
  const exclusive = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  return { run, all, get, close, exclusive };
}
function scoreReport(report) {
  const score = model.calculate(report);
  if (report.model_version === "1.3") {
    score.load = report.legacy_load;
    score.utilization =
      score.capacity > 0 ? (score.load / score.capacity) * 100 : null;
    score.remaining = Math.max(0, score.capacity - score.load);
  }
  return { ...report, score };
}
module.exports = { openDatabase, scoreReport };
