const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

if (!fs.existsSync('./data')) fs.mkdirSync('./data');

const db = new sqlite3.Database('./data/team.db');

db.serialize(() => {
  // 创建成员表
  db.run(`CREATE TABLE IF NOT EXISTS members (
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
  )`);

  // 插入初始演示数据
  const stmt = db.prepare("INSERT INTO members (name, team_group, capability_type, work_pattern, inc_count, req_count, chg_count, prb_count, active_projects, planner_tasks) VALUES (?,?,?,?,?,?,?,?,?,?)");
  stmt.run("T1", "INFR", "tech_specialist", "deep_technical", 5, 4, 2, 2, 1, 3);
  stmt.run("T2", "APP", "project_delivery", "project_delivery", 2, 8, 3, 1, 2, 6);
  stmt.finalize();

  console.log("Database initialized successfully at ./data/team.db");
});
db.close();
