const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

if (!fs.existsSync('./data')) fs.mkdirSync('./data');

const db = new sqlite3.Database('./data/team.db');

db.serialize(() => {
  // 创建成员表
  db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    skill INTEGER,
    pm INTEGER,
    comm INTEGER,
    incident INTEGER,
    change INTEGER,
    oncall INTEGER,
    project INTEGER
  )`);

  // 插入初始演示数据
  const stmt = db.prepare("INSERT INTO members (name, skill, pm, comm, incident, change, oncall, project) VALUES (?,?,?,?,?,?,?,?)");
  stmt.run("T1", 8, 4, 3, 2, 1, 2, 7);
  stmt.run("T2", 6, 3, 8, 5, 4, 0, 4);
  stmt.finalize();

  console.log("Database initialized successfully at ./data/team.db");
});
db.close();