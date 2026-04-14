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

    db.run("UPDATE members SET team_group = 'INFR' WHERE team_group IS NULL OR team_group = '' OR team_group = 'SYSTEM OPERATION'");
    db.run("UPDATE members SET capability_type = 'tech_generalist_advanced' WHERE capability_type IS NULL OR capability_type = ''");
    db.run("UPDATE members SET work_pattern = 'routine_support' WHERE work_pattern IS NULL OR work_pattern = ''");
  });
}

function sendApp(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.v3.html'));
}

app.get('/', sendApp);
app.get('/index.html', sendApp);

app.use(express.static('public'));

function normalizeMember(payload = {}) {
  const clampMetric = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(10, Math.round(parsed)));
  };

  return {
    name: String(payload.name || 'Unnamed member').trim() || 'Unnamed member',
    team_group: String(payload.team_group || 'INFR').trim() || 'INFR',
    capability_type: String(payload.capability_type || 'tech_generalist_advanced').trim() || 'tech_generalist_advanced',
    work_pattern: String(payload.work_pattern || 'routine_support').trim() || 'routine_support',
    skill: clampMetric(payload.skill),
    pm: clampMetric(payload.pm),
    comm: clampMetric(payload.comm),
    incident: clampMetric(payload.incident),
    change: clampMetric(payload.change),
    oncall: clampMetric(payload.oncall),
    project: clampMetric(payload.project)
  };
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

app.post('/api/members', (req, res) => {
  const member = normalizeMember(req.body);
  const sql = `
    INSERT INTO members (name, team_group, capability_type, work_pattern, skill, pm, comm, incident, change, oncall, project)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [member.name, member.team_group, member.capability_type, member.work_pattern, member.skill, member.pm, member.comm, member.incident, member.change, member.oncall, member.project],
    function onInsert(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ id: this.lastID, ...member });
    }
  );
});

app.put('/api/members/:id', (req, res) => {
  const member = normalizeMember(req.body);
  const sql = `
    UPDATE members
    SET name = ?, team_group = ?, capability_type = ?, work_pattern = ?, skill = ?, pm = ?, comm = ?, incident = ?, change = ?, oncall = ?, project = ?
    WHERE id = ?
  `;

  db.run(
    sql,
    [member.name, member.team_group, member.capability_type, member.work_pattern, member.skill, member.pm, member.comm, member.incident, member.change, member.oncall, member.project, req.params.id],
    function onUpdate(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      res.json({ id: Number(req.params.id), ...member });
    }
  );
});

ensureSchema();

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
