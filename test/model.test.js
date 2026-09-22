const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../public/model");
test("ISO weeks handle year boundaries and reject nonexistent week 53", () => {
  assert.equal(M.weekKey(new Date("2021-01-01T12:00:00Z")), "2020-W53");
  assert.equal(M.weekKey(new Date("2026-09-22T00:00:00Z")), "2026-W39");
  assert.equal(M.shiftWeek("2020-W53", 1), "2021-W01");
  assert.throws(() => M.weekDate("2021-W53"));
  assert.throws(() => M.weekDate("not-a-week"));
});
test("workload and availability produce a transparent estimate", () => {
  const s = M.calculate({
    inc_count: 5,
    req_count: 4,
    chg_count: 2,
    prb_count: 2,
    active_projects: 1,
    task_count: 3,
    capability_type: "tech_specialist",
    work_pattern: "deep_technical",
    available_hours: 20,
  });
  assert.ok(Math.abs(s.load - 30.69) < 1e-9);
  assert.ok(Math.abs(s.utilization - 153.45) < 1e-9);
  assert.equal(s.remaining, 0);
  assert.equal(M.calculate({ available_hours: 0 }).utilization, null);
  assert.equal(M.status(null).label, "未填报");
  assert.equal(
    M.status(M.calculate({ available_hours: 0, inc_count: 1 })).tone,
    "danger",
  );
});
test("consecutive weeks stop at gaps and at the selected week", () => {
  const reports = ["2026-W39", "2026-W37", "2026-W36"].map((week_key) => ({
    week_key,
    score: { utilization: 90 },
  }));
  assert.equal(M.streak(reports, "2026-W39"), 1);
  assert.equal(M.streak(reports, "2026-W38"), 0);
  assert.equal(M.streak(reports, "2026-W37"), 2);
});
