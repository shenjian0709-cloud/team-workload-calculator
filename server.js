const express = require("express");
const path = require("node:path");
const crypto = require("node:crypto");
const { openDatabase, scoreReport } = require("./lib/database");
const model = require("./public/model");
const version = require("./package.json").version;
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const validateWeek = (value) => {
  try {
    return model.weekDate(value);
  } catch (e) {
    throw fail(e.message);
  }
};
const shanghaiWeek = () =>
  model.weekKey(
    new Date(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()) + "T00:00:00Z",
    ),
  );
const integer = (v, label, max = 100000) => {
  if (!Number.isInteger(v) || v < 0 || v > max)
    throw fail(`${label} 必须为 0–${max} 的整数`);
  return v;
};
const text = (v, label, max) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw fail(`${label}不能为空且不能超过 ${max} 字符`);
  return v.trim();
};
function profile(body) {
  if (!model.groups.includes(body.team_group))
    throw fail("请选择 INFR / ADI / SMO / TO");
  if (
    !Object.hasOwn(model.capabilities, body.capability_type) ||
    !Object.hasOwn(model.patterns, body.work_pattern)
  )
    throw fail("请选择有效的能力和任务类型");
  return {
    name: text(body.name, "姓名", 80),
    team_group: body.team_group,
    capability_type: body.capability_type,
    work_pattern: body.work_pattern,
  };
}
async function createApp(options = {}) {
  const password = options.password ?? process.env.ADMIN_PASSWORD ?? "";
  if (process.env.NODE_ENV === "production" && password.length < 12)
    throw new Error("生产环境必须设置至少 12 字符的 ADMIN_PASSWORD");
  const db = await openDatabase(
    options.dbPath || process.env.DB_PATH || "./data/team.db",
  );
  const app = express();
  const sessions = new Map();
  const attempts = new Map();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.get("/healthz", async (req, res) => {
    try {
      await db.exclusive(() => db.get("SELECT 1"));
      res.json({ status: "ok", version });
    } catch {
      res.status(503).json({ status: "error" });
    }
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.get("origin");
      if (origin && new URL(origin).host !== req.get("host"))
        return res.status(403).json({ error: "不允许跨站写入" });
    }
    next();
  });
  app.get("/api/session", (req, res) =>
    res.json({
      required: !!password,
      authenticated: !password || validSession(req),
      version,
      current_week: shanghaiWeek(),
    }),
  );
  function validSession(req) {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("workload_session="))
      ?.slice(17);
    const expiry = sessions.get(token);
    if (!expiry) return false;
    if (expiry < Date.now()) {
      sessions.delete(token);
      return false;
    }
    return true;
  }
  app.post("/api/login", (req, res) => {
    const now = Date.now();
    for (const [key, value] of attempts)
      if (now - value.start > 900000) attempts.delete(key);
    const attempt = attempts.get(req.ip) || { start: now, count: 0 };
    if (attempt.count >= 10)
      return res.status(429).json({ error: "尝试过多，请 15 分钟后重试" });
    const supplied = crypto
      .createHash("sha256")
      .update(String(req.body.password || ""))
      .digest();
    const expected = crypto.createHash("sha256").update(password).digest();
    if (password && !crypto.timingSafeEqual(supplied, expected)) {
      attempt.count++;
      attempts.set(req.ip, attempt);
      return res.status(401).json({ error: "访问密码不正确" });
    }
    attempts.delete(req.ip);
    for (const [key, value] of sessions) if (value < now) sessions.delete(key);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, now + 8 * 3600000);
    res.cookie("workload_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 8 * 3600000,
    });
    res.json({ ok: true });
  });
  app.post("/api/logout", (req, res) => {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("workload_session="))
      ?.slice(17);
    sessions.delete(token);
    res.clearCookie("workload_session");
    res.json({ ok: true });
  });
  app.use("/api", (req, res, next) =>
    password && !validSession(req)
      ? res.status(401).json({ error: "请先登录" })
      : next(),
  );
  const route = (fn) => (req, res, next) =>
    db.exclusive(() => fn(req, res)).catch(next);
  const member = async (id) => {
    const m = await db.get("SELECT * FROM members WHERE id=?", [id]);
    if (!m) throw fail("成员不存在", 404);
    return m;
  };
  app.get(
    "/api/members",
    route(async (req, res) =>
      res.json(
        await db.all(
          "SELECT id,name,team_group,capability_type,work_pattern,legacy_group,archived_at,revision FROM members ORDER BY archived_at IS NOT NULL,name",
        ),
      ),
    ),
  );
  app.post(
    "/api/members",
    route(async (req, res) => {
      const p = profile(req.body);
      const r = await db.run(
        "INSERT INTO members(name,team_group,capability_type,work_pattern) VALUES(?,?,?,?)",
        Object.values(p),
      );
      res.status(201).json(await member(r.id));
    }),
  );
  app.put(
    "/api/members/:id",
    route(async (req, res) => {
      const p = profile(req.body);
      integer(req.body.revision, "版本");
      const m = await member(req.params.id);
      if (m.archived_at) throw fail("请先恢复成员", 409);
      const r = await db.run(
        "UPDATE members SET name=?,team_group=?,capability_type=?,work_pattern=?,legacy_group=NULL,revision=revision+1 WHERE id=? AND revision=?",
        [...Object.values(p), m.id, req.body.revision],
      );
      if (!r.changes) throw fail("成员已被其他人修改，请刷新后重试", 409);
      res.json(await member(m.id));
    }),
  );
  app.delete(
    "/api/members/:id",
    route(async (req, res) => {
      const m = await member(req.params.id);
      integer(req.body.revision, "版本");
      const r = await db.run(
        "UPDATE members SET archived_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=? AND revision=? AND archived_at IS NULL",
        [m.id, req.body.revision],
      );
      if (!r.changes) throw fail("成员状态已变更，请刷新", 409);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/members/:id/restore",
    route(async (req, res) => {
      const m = await member(req.params.id);
      await db.run(
        "UPDATE members SET archived_at=NULL,revision=revision+1 WHERE id=?",
        [m.id],
      );
      res.json(await member(m.id));
    }),
  );
  app.get(
    "/api/weeks/:week",
    route(async (req, res) => {
      validateWeek(req.params.week);
      const from = model.shiftWeek(req.params.week, -11);
      const reports = await db.all(
        "SELECT * FROM weekly_reports WHERE week_key BETWEEN ? AND ? ORDER BY week_key DESC",
        [from, req.params.week],
      );
      res.json({ week: req.params.week, reports: reports.map(scoreReport) });
    }),
  );
  app.get(
    "/api/members/:id/history",
    route(async (req, res) => {
      await member(req.params.id);
      res.json({
        snapshots: (
          await db.all(
            "SELECT * FROM weekly_reports WHERE member_id=? ORDER BY week_key DESC",
            [req.params.id],
          )
        ).map(scoreReport),
      });
    }),
  );
  app.put(
    "/api/members/:id/weeks/:week",
    route(async (req, res) => {
      validateWeek(req.params.week);
      const m = await member(req.params.id);
      if (m.archived_at) throw fail("归档成员不能填报", 409);
      const b = req.body;
      integer(b.revision, "版本");
      if (
        !model.groups.includes(b.team_group) ||
        !Object.hasOwn(model.capabilities, b.capability_type) ||
        !Object.hasOwn(model.patterns, b.work_pattern)
      )
        throw fail("请先确定小组、能力与任务类型");
      for (const [key, label] of model.fields) integer(b[key], label);
      if (
        typeof b.available_hours !== "number" ||
        !Number.isFinite(b.available_hours) ||
        b.available_hours < 0 ||
        b.available_hours > 168
      )
        throw fail("可用工时应为 0–168 小时");
      if (typeof b.note !== "string" || b.note.length > 1000)
        throw fail("备注不能超过 1000 字符");
      await db.run("BEGIN IMMEDIATE");
      try {
        const existing = await db.get(
          "SELECT revision FROM weekly_reports WHERE member_id=? AND week_key=?",
          [m.id, req.params.week],
        );
        if ((existing?.revision || 0) !== b.revision)
          throw fail("该周数据已被其他人修改，请刷新后重试", 409);
        await db.run(
          `INSERT INTO weekly_reports(member_id,week_key,name,team_group,capability_type,work_pattern,inc_count,req_count,chg_count,prb_count,active_projects,task_count,available_hours,note)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(member_id,week_key) DO UPDATE SET
        name=excluded.name,team_group=excluded.team_group,capability_type=excluded.capability_type,work_pattern=excluded.work_pattern,
        inc_count=excluded.inc_count,req_count=excluded.req_count,chg_count=excluded.chg_count,prb_count=excluded.prb_count,
        active_projects=excluded.active_projects,task_count=excluded.task_count,available_hours=excluded.available_hours,note=excluded.note,
        model_version='2.0',legacy_load=NULL,revision=weekly_reports.revision+1,updated_at=CURRENT_TIMESTAMP`,
          [
            m.id,
            req.params.week,
            m.name,
            b.team_group,
            b.capability_type,
            b.work_pattern,
            ...model.fields.map(([k]) => b[k]),
            b.available_hours,
            b.note,
          ],
        );
        await db.run("COMMIT");
      } catch (e) {
        await db.run("ROLLBACK");
        throw e;
      }
      res.json(
        scoreReport(
          await db.get(
            "SELECT * FROM weekly_reports WHERE member_id=? AND week_key=?",
            [m.id, req.params.week],
          ),
        ),
      );
    }),
  );
  app.get(
    "/api/export",
    route(async (req, res) => {
      res.attachment(`workload-${model.weekKey()}.json`);
      res.json({
        version,
        exported_at: new Date().toISOString(),
        members: await db.all("SELECT * FROM members"),
        reports: (
          await db.all(
            "SELECT * FROM weekly_reports ORDER BY week_key,member_id",
          )
        ).map(scoreReport),
      });
    }),
  );
  app.use("/api", (req, res) => res.status(404).json({ error: "接口不存在" }));
  app.get(["/index.v3.html", "/index.v2fixed.html"], (req, res) =>
    res.redirect("/"),
  );
  app.use(
    express.static(path.join(__dirname, "public"), { index: "index.html" }),
  );
  app.use((err, req, res, next) => {
    if (!err.status) console.error(err.message);
    res
      .status(err.status || 500)
      .json({
        error: err.status ? err.message : "服务处理失败，请重试或联系管理员",
      });
  });
  return { app, db };
}
if (require.main === module)
  createApp()
    .then(({ app, db }) => {
      const server = app.listen(Number(process.env.PORT) || 3000, () =>
        console.log(`Team Capacity v${version} ready`),
      );
      let stopping = false;
      const stop = () => {
        if (stopping) return;
        stopping = true;
        server.close(() => db.close().then(() => process.exit(0)));
        setTimeout(() => process.exit(1), 10000).unref();
      };
      process.on("SIGTERM", stop);
      process.on("SIGINT", stop);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
module.exports = { createApp };
