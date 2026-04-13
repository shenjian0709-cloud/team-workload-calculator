const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;
const db = new sqlite3.Database('./data/team.db');

app.use(express.json());

function sendApp(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.v2fixed.html'));
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
    INSERT INTO members (name, skill, pm, comm, incident, change, oncall, project)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [member.name, member.skill, member.pm, member.comm, member.incident, member.change, member.oncall, member.project],
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
    SET name = ?, skill = ?, pm = ?, comm = ?, incident = ?, change = ?, oncall = ?, project = ?
    WHERE id = ?
  `;

  db.run(
    sql,
    [member.name, member.skill, member.pm, member.comm, member.incident, member.change, member.oncall, member.project, req.params.id],
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
