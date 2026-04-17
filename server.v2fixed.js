const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;
const db = new sqlite3.Database('./data/team.db');

app.use(express.json());

function ensureSchema() {
  db.all('PRAGMA table_info(members)', [], (err, rows) => {
    if (err) {
      console.error('Failed to inspect members schema:', err.message);
      return;
    }

    const columns = rows.map((row) => row.name);
    if (!columns.includes('team_group')) {
      db.run("ALTER TABLE members ADD COLUMN team_group TEXT DEFAULT 'INFR'", (alterErr) => {
        if (alterErr) {
          console.error('Failed to add team_group column:', alterErr.message);
        }
      });
    }

    if (!columns.includes('capability_type')) {
      db.run("ALTER TABLE members ADD COLUMN capability_type TEXT DEFAULT 'tech_generalist_advanced'", (alterErr) => {
        if (alterErr) {
          console.error('Failed to add capability_type column:', alterErr.message);
        }
      });
    }

    if (!columns.includes('work_pattern')) {
      db.run("ALTER TABLE members ADD COLUMN work_pattern TEXT DEFAULT 'routine_support'", (alterErr) => {
        if (alterErr) {
          console.error('Failed to add work_pattern column:', alterErr.message);
        }
      });
    }

    const countColumns = [
      'inc_count',
      'req_count',
      'chg_count',
      'prb_count',
      'active_projects',
      'planner_tasks'
    ];

    countColumns.forEach((column) => {
      if (!columns.includes(column)) {
        db.run(`ALTER TABLE members ADD COLUMN ${column} INTEGER DEFAULT 0`, (alterErr) => {
          if (alterErr) {
            console.error(`Failed to add ${column} column:`, alterErr.message);
          }
        });
      }
    });

    db.run("UPDATE members SET team_group = 'INFR' WHERE team_group IS NULL OR team_group = '' OR team_group = 'SYSTEM OPERATION'");
    db.run("UPDATE members SET capability_type = 'tech_generalist_advanced' WHERE capability_type IS NULL OR capability_type = ''");
    db.run("UPDATE members SET work_pattern = 'routine_support' WHERE work_pattern IS NULL OR work_pattern = ''");
    db.run("UPDATE members SET inc_count = COALESCE(inc_count, 0), req_count = COALESCE(req_count, 0), chg_count = COALESCE(chg_count, 0), prb_count = COALESCE(prb_count, 0), active_projects = COALESCE(active_projects, 0), planner_tasks = COALESCE(planner_tasks, 0)");
  });

  db.run(`
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

function sendApp(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.v3.html'));
}

app.get('/', sendApp);
app.get('/index.html', sendApp);

app.use(express.static('public'));

function normalizeMember(payload = {}) {
  const normalizeCount = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.round(parsed));
  };

  return {
    name: String(payload.name || 'Unnamed member').trim() || 'Unnamed member',
    team_group: String(payload.team_group || 'INFR').trim() || 'INFR',
    capability_type: String(payload.capability_type || 'tech_generalist_advanced').trim() || 'tech_generalist_advanced',
    work_pattern: String(payload.work_pattern || 'routine_support').trim() || 'routine_support',
    inc_count: normalizeCount(payload.inc_count),
    req_count: normalizeCount(payload.req_count),
    chg_count: normalizeCount(payload.chg_count),
    prb_count: normalizeCount(payload.prb_count),
    active_projects: normalizeCount(payload.active_projects),
    planner_tasks: normalizeCount(payload.planner_tasks)
  };
}

function getCurrentWeekKey() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const thursday = new Date(now);
  thursday.setDate(now.getDate() - day + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const diff = thursday - firstThursday;
  const week = 1 + Math.round(diff / 604800000);
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getCfcMeta(member) {
  const capabilityType = member.capability_type || 'tech_generalist_advanced';
  const workPattern = member.work_pattern || 'routine_support';
  const matrix = {
    tech_specialist: {
      deep_technical: { value: 0.9, label: '高度契合' },
      multi_system_integration: { value: 1.1, label: '轻度逆风' },
      project_delivery: { value: 1.25, label: '明显错配' },
      high_comms: { value: 1.4, label: '严重错配' },
      routine_support: { value: 1.0, label: '正常匹配' }
    },
    project_delivery: {
      deep_technical: { value: 1.3, label: '明显错配' },
      multi_system_integration: { value: 0.95, label: '较为契合' },
      project_delivery: { value: 0.9, label: '高度契合' },
      high_comms: { value: 1.0, label: '正常匹配' },
      routine_support: { value: 1.0, label: '正常匹配' }
    },
    comms_coordination: {
      deep_technical: { value: 1.4, label: '严重错配' },
      multi_system_integration: { value: 1.15, label: '轻度逆风' },
      project_delivery: { value: 0.95, label: '较为契合' },
      high_comms: { value: 0.9, label: '高度契合' },
      routine_support: { value: 1.0, label: '正常匹配' }
    },
    tech_generalist_junior: {
      deep_technical: { value: 1.2, label: '明显吃力' },
      multi_system_integration: { value: 1.0, label: '正常匹配' },
      project_delivery: { value: 1.05, label: '轻度逆风' },
      high_comms: { value: 1.05, label: '轻度逆风' },
      routine_support: { value: 0.95, label: '较为契合' }
    },
    tech_generalist_advanced: {
      deep_technical: { value: 0.95, label: '较为契合' },
      multi_system_integration: { value: 0.9, label: '高度契合' },
      project_delivery: { value: 0.95, label: '较为契合' },
      high_comms: { value: 1.05, label: '轻度逆风' },
      routine_support: { value: 0.95, label: '较为契合' }
    }
  };
  return (matrix[capabilityType] || matrix.tech_generalist_advanced)[workPattern] || { value: 1.0, label: '正常匹配' };
}

function buildSnapshot(member, weekKey) {
  const opsScore = member.inc_count * 2 + member.req_count * 1 + member.chg_count * 1.5 + member.prb_count * 2;
  const projectScore = member.active_projects * 5 + member.planner_tasks * 2;
  const activeOpsTypes = [member.inc_count, member.req_count, member.chg_count, member.prb_count].filter((count) => count > 0).length;
  const contextFactor = activeOpsTypes > 3 ? 1.1 : 1.0;
  const cfcMeta = getCfcMeta(member);
  const baseWorkload = opsScore * contextFactor + projectScore;
  const finalLoad = baseWorkload * cfcMeta.value;
  return {
    member_id: member.id,
    week_key: weekKey || getCurrentWeekKey(),
    name: member.name,
    team_group: member.team_group,
    capability_type: member.capability_type,
    work_pattern: member.work_pattern,
    inc_count: member.inc_count,
    req_count: member.req_count,
    chg_count: member.chg_count,
    prb_count: member.prb_count,
    active_projects: member.active_projects,
    planner_tasks: member.planner_tasks,
    ops_score: opsScore,
    project_score: projectScore,
    context_factor: contextFactor,
    cfc_value: cfcMeta.value,
    cfc_label: cfcMeta.label,
    base_workload: baseWorkload,
    final_load: finalLoad
  };
}

function upsertWeeklySnapshot(member, weekKey, callback = () => {}) {
  const snapshot = buildSnapshot(member, weekKey);
  const sql = `
    INSERT INTO member_weekly_snapshots (
      member_id, week_key, name, team_group, capability_type, work_pattern,
      inc_count, req_count, chg_count, prb_count, active_projects, planner_tasks,
      ops_score, project_score, context_factor, cfc_value, cfc_label, base_workload, final_load, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(member_id, week_key) DO UPDATE SET
      name = excluded.name,
      team_group = excluded.team_group,
      capability_type = excluded.capability_type,
      work_pattern = excluded.work_pattern,
      inc_count = excluded.inc_count,
      req_count = excluded.req_count,
      chg_count = excluded.chg_count,
      prb_count = excluded.prb_count,
      active_projects = excluded.active_projects,
      planner_tasks = excluded.planner_tasks,
      ops_score = excluded.ops_score,
      project_score = excluded.project_score,
      context_factor = excluded.context_factor,
      cfc_value = excluded.cfc_value,
      cfc_label = excluded.cfc_label,
      base_workload = excluded.base_workload,
      final_load = excluded.final_load,
      updated_at = CURRENT_TIMESTAMP
  `;
  db.run(
    sql,
    [
      snapshot.member_id, snapshot.week_key, snapshot.name, snapshot.team_group, snapshot.capability_type, snapshot.work_pattern,
      snapshot.inc_count, snapshot.req_count, snapshot.chg_count, snapshot.prb_count, snapshot.active_projects, snapshot.planner_tasks,
      snapshot.ops_score, snapshot.project_score, snapshot.context_factor, snapshot.cfc_value, snapshot.cfc_label, snapshot.base_workload, snapshot.final_load
    ],
    callback
  );
}

app.get('/api/members', (req, res) => {
  db.all('SELECT * FROM members ORDER BY id ASC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/members/:id/history', (req, res) => {
  db.all(
    'SELECT * FROM member_weekly_snapshots WHERE member_id = ? ORDER BY week_key DESC LIMIT 12',
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ snapshots: rows || [] });
    }
  );
});

app.post('/api/members', (req, res) => {
  const member = normalizeMember(req.body);
  const weekKey = String(req.body.week_key || getCurrentWeekKey());
  const sql = `
    INSERT INTO members (name, team_group, capability_type, work_pattern, inc_count, req_count, chg_count, prb_count, active_projects, planner_tasks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [member.name, member.team_group, member.capability_type, member.work_pattern, member.inc_count, member.req_count, member.chg_count, member.prb_count, member.active_projects, member.planner_tasks],
    function onInsert(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      const createdMember = { id: this.lastID, ...member };
      upsertWeeklySnapshot(createdMember, weekKey, (snapshotErr) => {
        if (snapshotErr) {
          res.status(500).json({ error: snapshotErr.message });
          return;
        }
        res.status(201).json(createdMember);
      });
    }
  );
});

app.put('/api/members/:id', (req, res) => {
  const member = normalizeMember(req.body);
  const weekKey = String(req.body.week_key || getCurrentWeekKey());
  const sql = `
    UPDATE members
    SET name = ?, team_group = ?, capability_type = ?, work_pattern = ?, inc_count = ?, req_count = ?, chg_count = ?, prb_count = ?, active_projects = ?, planner_tasks = ?
    WHERE id = ?
  `;

  db.run(
    sql,
    [member.name, member.team_group, member.capability_type, member.work_pattern, member.inc_count, member.req_count, member.chg_count, member.prb_count, member.active_projects, member.planner_tasks, req.params.id],
    function onUpdate(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      const savedMember = { id: Number(req.params.id), ...member };
      upsertWeeklySnapshot(savedMember, weekKey, (snapshotErr) => {
        if (snapshotErr) {
          res.status(500).json({ error: snapshotErr.message });
          return;
        }
        res.json(savedMember);
      });
    }
  );
});

ensureSchema();

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
