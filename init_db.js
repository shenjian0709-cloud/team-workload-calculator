const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DB_PATH || './data/team.db';
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function finalizeStatement(stmt) {
  return new Promise((resolve, reject) => {
    stmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function ensureSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      team_group TEXT DEFAULT 'INFR',
      capability_type TEXT DEFAULT 'tech_generalist_advanced',
      work_pattern TEXT DEFAULT 'routine_support',
      inc_count INTEGER DEFAULT 0,
      req_count INTEGER DEFAULT 0,
      chg_count INTEGER DEFAULT 0,
      prb_count INTEGER DEFAULT 0,
      active_projects INTEGER DEFAULT 0,
      planner_tasks INTEGER DEFAULT 0
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS member_weekly_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      week_key TEXT NOT NULL,
      name TEXT,
      team_group TEXT,
      capability_type TEXT,
      work_pattern TEXT,
      inc_count INTEGER DEFAULT 0,
      req_count INTEGER DEFAULT 0,
      chg_count INTEGER DEFAULT 0,
      prb_count INTEGER DEFAULT 0,
      active_projects INTEGER DEFAULT 0,
      planner_tasks INTEGER DEFAULT 0,
      ops_score REAL DEFAULT 0,
      project_score REAL DEFAULT 0,
      context_factor REAL DEFAULT 1,
      cfc_value REAL DEFAULT 1,
      cfc_label TEXT,
      base_workload REAL DEFAULT 0,
      final_load REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(member_id, week_key)
    )
  `);
}

async function seedDemoDataIfEmpty() {
  const row = await get('SELECT COUNT(1) AS count FROM members');
  if ((row?.count || 0) > 0) {
    console.log(`Database schema ensured at ${dbPath}`);
    return;
  }

  const stmt = db.prepare(
    'INSERT INTO members (name, team_group, capability_type, work_pattern, inc_count, req_count, chg_count, prb_count, active_projects, planner_tasks) VALUES (?,?,?,?,?,?,?,?,?,?)'
  );
  stmt.run('T1', 'INFR', 'tech_specialist', 'deep_technical', 5, 4, 2, 2, 1, 3);
  stmt.run('T2', 'APP', 'project_delivery', 'project_delivery', 2, 8, 3, 1, 2, 6);
  await finalizeStatement(stmt);

  console.log(`Database initialized successfully at ${dbPath}`);
}

async function main() {
  try {
    await ensureSchema();
    await seedDemoDataIfEmpty();
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
