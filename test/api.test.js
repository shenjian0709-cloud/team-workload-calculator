const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createApp } = require("../server");
const { openDatabase } = require("../lib/database");
const person = {
  name: "测试成员",
  team_group: "ADI",
  capability_type: "tech_specialist",
  work_pattern: "deep_technical",
};
const report = {
  revision: 0,
  ...person,
  inc_count: 5,
  req_count: 4,
  chg_count: 2,
  prb_count: 2,
  active_projects: 1,
  task_count: 3,
  available_hours: 40,
  note: "",
};
async function fixture(t, password = "") {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capacity-test-"));
  const { app, db } = await createApp({
    dbPath: path.join(dir, "team.db"),
    password,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const call = async (url, method = "GET", body, headers = {}) => {
    const r = await fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  };
  return { call, db };
}
test("member CRUD archives history, restores, and enforces group validation", async (t) => {
  const { call } = await fixture(t);
  assert.equal(
    (await call("/api/members", "POST", { ...person, team_group: "APP" }))
      .status,
    400,
  );
  const created = await call("/api/members", "POST", person);
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal(
    (await call(`/api/members/${id}/weeks/2026-W39`, "PUT", report)).status,
    200,
  );
  assert.equal(
    (
      await call(`/api/members/${id}`, "PUT", {
        ...person,
        name: "新姓名",
        team_group: "TO",
        revision: 0,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(`/api/members/${id}`, "PUT", { ...person, revision: 0 }))
      .status,
    409,
  );
  const history = (await call(`/api/members/${id}/history`)).data.snapshots;
  assert.equal(history[0].name, person.name);
  assert.equal(history[0].team_group, "ADI");
  assert.equal(
    (await call(`/api/members/${id}`, "DELETE", { revision: 1 })).status,
    200,
  );
  assert.equal(
    (await call(`/api/members/${id}/weeks/2026-W40`, "PUT", report)).status,
    409,
  );
  assert.equal(
    (await call(`/api/members/${id}/history`)).data.snapshots.length,
    1,
  );
  assert.equal(
    (await call(`/api/members/${id}/restore`, "POST", {})).status,
    200,
  );
});
test("weekly reports validate values and isolate weeks; concurrent writes reject stale revision", async (t) => {
  const { call } = await fixture(t);
  const id = (await call("/api/members", "POST", person)).data.id;
  assert.equal(
    (await call(`/api/members/${id}/weeks/2021-W53`, "PUT", report)).status,
    400,
  );
  for (const invalid of [
    { inc_count: -1 },
    { task_count: 1.5 },
    { available_hours: 169 },
  ])
    assert.equal(
      (
        await call(`/api/members/${id}/weeks/2026-W39`, "PUT", {
          ...report,
          ...invalid,
        })
      ).status,
      400,
    );
  const results = await Promise.all([
    call(`/api/members/${id}/weeks/2026-W39`, "PUT", report),
    call(`/api/members/${id}/weeks/2026-W39`, "PUT", report),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const weeks = (await call("/api/weeks/2026-W40")).data.reports;
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].week_key, "2026-W39");
  assert.equal(weeks[0].revision, 1);
  assert.equal((await call("/api/weeks/2026-W38")).data.reports.length, 0);
});
test("failed report write rolls back; zero availability remains explicit", async (t) => {
  const { call, db } = await fixture(t);
  const id = (await call("/api/members", "POST", person)).data.id;
  await db.run(
    "CREATE TRIGGER fail_report BEFORE INSERT ON weekly_reports BEGIN SELECT RAISE(ABORT,'simulated failure'); END",
  );
  assert.equal(
    (await call(`/api/members/${id}/weeks/2026-W39`, "PUT", report)).status,
    500,
  );
  assert.equal((await db.get("SELECT count(*) AS n FROM weekly_reports")).n, 0);
  await db.run("DROP TRIGGER fail_report");
  const saved = await call(`/api/members/${id}/weeks/2026-W39`, "PUT", {
    ...report,
    available_hours: 0,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.score.utilization, null);
});
test("login protects data, rejects cross-site writes and logout revokes session", async (t) => {
  const { call } = await fixture(t, "test-password-1234");
  assert.equal((await call("/healthz")).data.status, "ok");
  assert.equal((await call("/api/members")).status, 401);
  assert.equal(
    (await call("/api/login", "POST", { password: "wrong" })).status,
    401,
  );
  const login = await call("/api/login", "POST", {
    password: "test-password-1234",
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await call("/api/members", "GET", undefined, { Cookie: cookie })).status,
    200,
  );
  assert.equal(
    (
      await call("/api/members", "POST", person, {
        Cookie: cookie,
        Origin: "http://evil.example",
      })
    ).status,
    403,
  );
  await call("/api/logout", "POST", {}, { Cookie: cookie });
  assert.equal(
    (await call("/api/members", "GET", undefined, { Cookie: cookie })).status,
    401,
  );
});
test("v1.3 migration retains original tables and scores, maps tasks once, flags legacy groups", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "capacity-migration-"));
  const filename = path.join(dir, "team.db");
  const old = new DatabaseSync(filename);
  const run = async (sql) => old.exec(sql);
  await run(
    "CREATE TABLE members(id INTEGER PRIMARY KEY,name TEXT,team_group TEXT,capability_type TEXT,work_pattern TEXT,planner_tasks INTEGER)",
  );
  await run(
    "INSERT INTO members VALUES(1,'旧成员','APP','tech_specialist','deep_technical',7)",
  );
  await run(
    "CREATE TABLE member_weekly_snapshots(member_id INTEGER,week_key TEXT,name TEXT,team_group TEXT,capability_type TEXT,work_pattern TEXT,inc_count INTEGER,req_count INTEGER,chg_count INTEGER,prb_count INTEGER,active_projects INTEGER,planner_tasks INTEGER,final_load REAL)",
  );
  await run(
    "INSERT INTO member_weekly_snapshots VALUES(1,'2026-W15','旧成员','APP','tech_specialist','deep_technical',2,0,0,0,1,7,23.7)",
  );
  old.close();
  let db = await openDatabase(filename);
  const m = await db.get("SELECT * FROM members");
  assert.equal(m.team_group, null);
  assert.equal(m.legacy_group, "APP");
  assert.equal(m.planner_tasks, 7);
  const r = await db.get("SELECT * FROM weekly_reports");
  assert.equal(r.task_count, 7);
  assert.equal(r.legacy_load, 23.7);
  assert.equal(r.model_version, "1.3");
  assert.equal(r.team_group, "APP");
  assert.equal(
    (await db.get("SELECT count(*) AS n FROM member_weekly_snapshots")).n,
    1,
  );
  await db.close();
  db = await openDatabase(filename);
  assert.equal((await db.get("SELECT count(*) AS n FROM weekly_reports")).n, 1);
  await db.close();
  await fs.rm(dir, { recursive: true, force: true });
});
