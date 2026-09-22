(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Workload = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const groups = ["INFR", "ADI", "SMO", "TO"];
  const capabilities = {
    tech_specialist: "技术专长型",
    project_delivery: "项目交付型",
    comms_coordination: "沟通协调型",
    tech_generalist_junior: "技术全能型（初级）",
    tech_generalist_advanced: "技术全能型（进阶）",
  };
  const patterns = {
    deep_technical: "深度技术",
    multi_system_integration: "系统集成",
    project_delivery: "项目交付",
    high_comms: "沟通协调",
    routine_support: "综合支撑",
  };
  const matrix = {
    tech_specialist: [0.9, 1.1, 1.25, 1.4, 1],
    project_delivery: [1.3, 0.95, 0.9, 1, 1],
    comms_coordination: [1.4, 1.15, 0.95, 0.9, 1],
    tech_generalist_junior: [1.2, 1, 1.05, 1.05, 0.95],
    tech_generalist_advanced: [0.95, 0.9, 0.95, 1.05, 0.95],
  };
  const fields = [
    ["inc_count", "INC · 事故", 2],
    ["req_count", "REQ · 请求", 1],
    ["chg_count", "CHG · 变更", 1.5],
    ["prb_count", "PRB · 问题", 2],
    ["active_projects", "活跃项目", 5],
    ["task_count", "Task · 独立任务", 2],
  ];
  function weekKey(date = new Date()) {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const year = d.getUTCFullYear();
    return `${year}-W${String(Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
  }
  function weekDate(key) {
    if (!/^\d{4}-W\d{2}$/.test(key)) throw new Error("周格式应为 YYYY-Www");
    const [y, w] = key.split("-W").map(Number);
    const d = new Date(Date.UTC(y, 0, 4));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + (w - 1) * 7);
    if (weekKey(d) !== key || y < 2000 || y > 2100)
      throw new Error("无效的日历周");
    return d;
  }
  function shiftWeek(key, offset) {
    const d = weekDate(key);
    d.setUTCDate(d.getUTCDate() + offset * 7);
    return weekKey(d);
  }
  function calculate(report) {
    const ops = fields
      .slice(0, 4)
      .reduce((s, [k, , w]) => s + Number(report[k] || 0) * w, 0);
    const project =
      Number(report.active_projects || 0) * 5 +
      Number(report.task_count || 0) * 2;
    const kinds = fields
      .slice(0, 4)
      .filter(([k]) => Number(report[k]) > 0).length;
    const context = 1 + Math.max(0, kinds - 2) * 0.05;
    const cfc =
      (matrix[report.capability_type] || matrix.tech_generalist_advanced)[
        Object.keys(patterns).indexOf(report.work_pattern)
      ] || 1;
    const base = ops * context + project;
    const load = base * cfc;
    const capacity = Number(report.available_hours ?? 40);
    return {
      ops,
      project,
      context,
      cfc,
      base,
      load,
      capacity,
      utilization: capacity > 0 ? (load / capacity) * 100 : null,
      remaining: Math.max(0, capacity - load),
    };
  }
  function status(score) {
    if (!score) return { label: "未填报", tone: "muted" };
    if (score.capacity === 0)
      return {
        label: score.load > 0 ? "无可用工时但有任务" : "本周不可用",
        tone: score.load > 0 ? "danger" : "muted",
      };
    if (score.utilization >= 100) return { label: "超出容量", tone: "danger" };
    if (score.utilization >= 75) return { label: "较高负荷", tone: "warning" };
    if (score.utilization >= 50) return { label: "负荷适中", tone: "normal" };
    return { label: "有余量", tone: "good" };
  }
  function streak(reports, week) {
    const byWeek = new Map(reports.map((r) => [r.week_key, r]));
    let count = 0;
    for (let w = week; byWeek.has(w); w = shiftWeek(w, -1)) {
      const r = byWeek.get(w);
      const s = r.score || calculate(r);
      if (s.utilization === null || s.utilization < 75) break;
      count++;
    }
    return count;
  }
  return {
    groups,
    capabilities,
    patterns,
    fields,
    weekKey,
    weekDate,
    shiftWeek,
    calculate,
    status,
    streak,
  };
});
