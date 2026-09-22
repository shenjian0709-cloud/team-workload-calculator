"use strict";
const M = window.Workload;
const $ = (id) => document.getElementById(id);
const state = {
  members: [],
  reports: [],
  week: "",
  currentWeek: "",
  group: "ALL",
  view: "overview",
  memberId: null,
  dirty: false,
  revision: 0,
  loading: false,
};
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (v) => Number(v || 0).toFixed(1);
const options = (values, selected) =>
  Object.entries(values)
    .map(
      ([value, label]) =>
        `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`,
    )
    .join("");
const groupOptions = (selected) =>
  '<option value="">请选择小组</option>' +
  options(Object.fromEntries(M.groups.map((g) => [g, g])), selected);
const badge = (s) =>
  `<span class="badge ${M.status(s).tone}">${M.status(s).label}</span>`;
const matches = (g) =>
  state.group === "ALL" ||
  (state.group === "UNASSIGNED" ? !M.groups.includes(g) : g === state.group);
const notice = (message, error = false) => {
  $("notice").hidden = !message;
  $("notice").textContent = message;
  $("notice").classList.toggle("error", error);
};
async function api(url, config = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    ...config,
    headers: { "Content-Type": "application/json", ...config.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      $("loginScreen").hidden = false;
      $("workspace").hidden = true;
    }
    throw new Error(data.error || "请求失败");
  }
  return data;
}
function safe(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      notice(e.message || "网络连接失败，请重试", true);
    }
  };
}
function mayLeave() {
  return !state.dirty || confirm("当前填报尚未保存。放弃修改并继续？");
}
function savedReport() {
  return state.reports.find(
    (r) => r.member_id === Number(state.memberId) && r.week_key === state.week,
  );
}
function activeMember() {
  return state.members.find((m) => m.id === Number(state.memberId));
}
function rowsForWeek(week = state.week) {
  const reports = state.reports.filter((r) => r.week_key === week);
  return state.members
    .filter((m) => !m.archived_at || reports.some((r) => r.member_id === m.id))
    .map((m) => {
      const report = reports.find((r) => r.member_id === m.id);
      return {
        member: m,
        report,
        group: report ? report.team_group : m.team_group,
      };
    })
    .filter((r) => matches(r.group));
}
async function reload() {
  if (state.loading) return;
  state.loading = true;
  $("workspace").inert = true;
  $("refresh").disabled = true;
  try {
    const [members, data] = await Promise.all([
      api("/api/members"),
      api(`/api/weeks/${state.week}`),
    ]);
    state.members = members;
    state.reports = data.reports;
    if (
      !state.members.some(
        (m) => m.id === Number(state.memberId) && !m.archived_at,
      )
    )
      state.memberId = members.find((m) => !m.archived_at)?.id || null;
    renderOverview();
    renderMembers();
    renderReport();
  } finally {
    state.loading = false;
    $("workspace").inert = false;
    $("refresh").disabled = false;
  }
}
function setView(view) {
  state.view = view;
  for (const v of ["overview", "weekly", "members"])
    $(v + "View").hidden = v !== view;
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  const titles = {
    overview: [
      "团队概览",
      "掌握团队的工作节奏",
      "从每周工作量出发，看见压力，也看见余量。",
    ],
    weekly: [
      "周度填报",
      "把一周的工作，记录清楚",
      "按周保存工作量与可用工时，让每一次判断都有依据。",
    ],
    members: [
      "成员管理",
      "让每位成员各有所长",
      "维护团队归属与能力画像，保留完整的工作历史。",
    ],
  };
  $("breadcrumb").textContent = titles[view][0];
  $("pageTitle").textContent = titles[view][1];
  $("pageDescription").textContent = titles[view][2];
}
function renderOverview() {
  const rows = rowsForWeek(),
    filled = rows.filter((r) => r.report),
    missing = rows.length - filled.length;
  const total = filled.reduce((n, r) => n + r.report.score.load, 0),
    capacity = filled.reduce((n, r) => n + r.report.score.capacity, 0);
  const high = filled.filter(
    (r) =>
      r.report.score.utilization >= 75 ||
      (r.report.score.capacity === 0 && r.report.score.load > 0),
  );
  const sustained = filled.filter(
    (r) =>
      M.streak(
        state.reports.filter((x) => x.member_id === r.member.id),
        state.week,
      ) >= 2,
  );
  const cards = [
    [
      "已填报总负荷",
      fmt(total),
      "分",
      `${filled.length} / ${rows.length} 人已填报`,
    ],
    [
      "估算容量占用",
      capacity ? fmt((total / capacity) * 100) : "—",
      "%",
      `已填报容量 ${fmt(capacity)} 分`,
    ],
    ["较高负荷", high.length, "人", `${sustained.length} 人连续 ≥2 周高负荷`],
    ["待填报", missing, "人", "未填报不计为空闲或零负荷"],
  ];
  $("kpis").innerHTML = cards
    .map(
      ([label, value, unit, foot]) =>
        `<article class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}<small>${unit}</small></div><div class="kpi-foot">${foot}</div></article>`,
    )
    .join("");
  $("loadRows").innerHTML = rows.length
    ? rows
        .sort(
          (a, b) =>
            (b.report?.score.utilization || 0) -
            (a.report?.score.utilization || 0),
        )
        .map(
          ({ member: m, report: r, group }) =>
            `<tr><td><div class="person"><span class="avatar">${escapeHtml(m.name.slice(0, 2))}</span><div>${escapeHtml(r?.name || m.name)}${m.archived_at ? " · 已归档" : ""}<small>${escapeHtml(group || "待分配")}</small></div></div></td><td>${r ? fmt(r.score.load) : "—"}</td><td>${r && r.score.utilization !== null ? fmt(r.score.utilization) + "%" : "—"}<div class="meter"><div class="meter-fill ${M.status(r?.score).tone}" data-width="${Math.min(100, r?.score.utilization || 0)}"></div></div></td><td>${badge(r?.score)}</td><td>${!m.archived_at ? `<button class="text-button" data-report="${m.id}">填报 ↗</button>` : ""}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="5" class="empty">暂无成员。点击“新增成员”开始建立团队。</td></tr>';
  $("loadRows")
    .querySelectorAll("[data-width]")
    .forEach((el) => (el.style.width = el.dataset.width + "%"));
  const insight = [];
  if (high.length)
    insight.push([
      "关注负荷集中",
      `${high.map((r) => r.member.name).join("、")} 接近或超过估算容量，建议核对优先级及实际耗时。`,
    ]);
  if (sustained.length)
    insight.push([
      "持续高负荷",
      `${sustained.map((r) => r.member.name).join("、")} 连续至少两周高负荷，建议安排工作转移或恢复时间。`,
    ]);
  if (missing)
    insight.push([
      "补齐周度数据",
      `还有 ${missing} 位成员未填报。当前容量判断尚不完整。`,
    ]);
  const unassigned = state.members.filter(
    (m) => !m.archived_at && !M.groups.includes(m.team_group),
  );
  if (unassigned.length)
    insight.push([
      "确认团队归属",
      `${unassigned.length} 位成员来自旧团队，请在成员管理中指定新小组。`,
    ]);
  if (!insight.length)
    insight.push([
      "保持工作节奏",
      "已填报成员暂无明显超载信号。分配新任务前，仍需确认技能和时间窗口。",
    ]);
  $("insights").innerHTML = insight
    .map(
      ([title, body]) =>
        `<div class="insight"><strong>${title}</strong><p>${escapeHtml(body)}</p></div>`,
    )
    .join("");
  const weeks = Array.from({ length: 12 }, (_, i) =>
    M.shiftWeek(state.week, i - 11),
  );
  const points = weeks.map((w) => {
    const reports = state.reports.filter(
      (r) => r.week_key === w && matches(r.team_group),
    );
    return {
      week: w,
      count: reports.length,
      value: reports.length
        ? reports.reduce((s, r) => s + r.score.load, 0) / reports.length
        : null,
    };
  });
  const max = Math.max(40, ...points.map((p) => p.value || 0));
  $("trend").innerHTML = points
    .map(
      (p) =>
        `<div class="trend-col" title="${p.week} · ${p.count} 人填报"><b>${p.value === null ? "—" : fmt(p.value)}</b><div class="trend-bar" data-height="${p.value === null ? 0 : Math.max(2, (p.value / max) * 105)}"></div><span>${p.week.slice(5)}</span></div>`,
    )
    .join("");
  $("trend")
    .querySelectorAll("[data-height]")
    .forEach((el) => {
      el.style.height = el.dataset.height + "px";
      if (el.dataset.height === "0") el.style.visibility = "hidden";
    });
  const groups =
    state.group === "ALL"
      ? M.groups
      : state.group === "UNASSIGNED"
        ? ["UNASSIGNED"]
        : [state.group];
  $("groupCards").innerHTML = groups
    .map((g) => {
      const gr = rows.filter((r) =>
          g === "UNASSIGNED" ? !M.groups.includes(r.group) : r.group === g,
        ),
        fr = gr.filter((r) => r.report);
      const remaining = fr.reduce((s, r) => s + r.report.score.remaining, 0),
        sum = fr.reduce((s, r) => s + r.report.score.load, 0),
        concentration = sum
          ? (Math.max(...fr.map((r) => r.report.score.load)) / sum) * 100
          : 0;
      return `<article class="group-card"><h3>${g === "UNASSIGNED" ? "待分配" : g}</h3><span class="muted">${fr.length} / ${gr.length} 人已填报</span><div class="group-value">${fmt(remaining)} <small>分</small></div><div class="muted">估算可用余量</div><div class="group-bottom"><span>负荷集中度 ${fmt(concentration)}%</span><span>${fr.filter((r) => r.report.score.utilization >= 75).length} 人高负荷</span></div></article>`;
    })
    .join("");
}
function renderMembers() {
  const members = state.members.filter(
    (m) =>
      matches(m.team_group) && ($("showArchived").checked || !m.archived_at),
  );
  $("memberRows").innerHTML = members.length
    ? members
        .map(
          (m) =>
            `<tr><td>${escapeHtml(m.name)}${m.archived_at ? ' <span class="badge">已归档</span>' : ""}</td><td>${escapeHtml(m.team_group || "待分配")}${m.legacy_group ? `<br><small class="muted">原 ${escapeHtml(m.legacy_group)}</small>` : ""}</td><td>${escapeHtml(M.capabilities[m.capability_type] || "待确认")}</td><td>${escapeHtml(M.patterns[m.work_pattern] || "待确认")}</td><td>${m.archived_at ? `<button data-restore="${m.id}">恢复</button>` : `<button class="text-button" data-edit="${m.id}">修改</button><button class="text-button error" data-delete="${m.id}">删除</button>`}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="5" class="empty">此筛选下暂无成员</td></tr>';
}
function renderReport() {
  const members = state.members.filter((m) => !m.archived_at);
  $("reportMember").innerHTML = members
    .map(
      (m) =>
        `<option value="${m.id}">${escapeHtml(m.name)} · ${escapeHtml(m.team_group || "待分配")}</option>`,
    )
    .join("");
  $("reportMember").value = state.memberId || "";
  const m = activeMember(),
    r = savedReport(),
    form = $("reportForm");
  form.hidden = !m;
  $("saveReport").disabled = !m;
  if (!m) {
    $("preview").innerHTML = '<p class="muted">请先新增成员</p>';
    $("memberHistory").innerHTML = '<p class="empty">暂无成员</p>';
    return;
  }
  const values = r || {
    ...m,
    available_hours: 40,
    note: "",
    ...Object.fromEntries(M.fields.map(([k]) => [k, 0])),
  };
  form.elements.team_group.innerHTML = groupOptions(values.team_group);
  form.elements.capability_type.innerHTML = options(
    M.capabilities,
    values.capability_type,
  );
  form.elements.work_pattern.innerHTML = options(
    M.patterns,
    values.work_pattern,
  );
  $("taskFields").innerHTML = M.fields
    .map(
      ([key, label, weight]) =>
        `<label>${label}<input name="${key}" type="number" min="0" max="100000" step="1" required value="${Number(values[key] || 0)}" aria-label="${label}"></label>`,
    )
    .join("");
  form.elements.available_hours.value = values.available_hours;
  form.elements.note.value = values.note;
  state.revision = r?.revision || 0;
  state.dirty = false;
  $("saveState").textContent = r
    ? `已保存 · 模型 ${r.model_version}`
    : "本周未填报";
  renderPreview();
  renderMemberHistory();
}
function readReport() {
  const f = $("reportForm");
  return {
    revision: state.revision,
    team_group: f.elements.team_group.value,
    capability_type: f.elements.capability_type.value,
    work_pattern: f.elements.work_pattern.value,
    available_hours: Number(f.elements.available_hours.value),
    note: f.elements.note.value,
    ...Object.fromEntries(
      M.fields.map(([k]) => [k, Number(f.elements[k].value)]),
    ),
  };
}
function renderPreview() {
  if (!activeMember()) return;
  const s = M.calculate(readReport());
  $("preview").innerHTML =
    `<div class="preview-score">${fmt(s.load)} <small>分</small></div>${badge(s)}<div class="preview-details"><div><span>容量占用</span><strong>${s.utilization === null ? "不可用" : fmt(s.utilization) + "%"}</strong></div><div><span>运维 / 项目及 Task</span><strong>${fmt(s.ops)} / ${fmt(s.project)}</strong></div><div><span>上下文 / 人岗匹配</span><strong>×${s.context.toFixed(2)} / ×${s.cfc.toFixed(2)}</strong></div><div><span>可用容量 / 剩余</span><strong>${fmt(s.capacity)} / ${fmt(s.remaining)} 分</strong></div></div><p class="hint">预览按 v2.0 计算，保存后才更新团队看板。${savedReport()?.model_version === "1.3" ? "此周为旧版记录，保存将按新模型重新计算。" : ""}</p>`;
}
function renderMemberHistory() {
  const history = state.reports.filter(
    (r) => r.member_id === Number(state.memberId),
  );
  $("memberHistory").innerHTML = history.length
    ? `<table><thead><tr><th>周</th><th>负荷</th><th>可用工时</th><th>容量占用</th><th>模型</th><th>操作</th></tr></thead><tbody>${history.map((r) => `<tr><td>${escapeHtml(r.week_key)}</td><td>${fmt(r.score.load)}</td><td>${fmt(r.available_hours)}h</td><td>${r.score.utilization === null ? "—" : fmt(r.score.utilization) + "%"}</td><td>${r.model_version === "1.3" ? "1.3 · 保留原值" : "2.0"}</td><td><button class="text-button" data-week="${escapeHtml(r.week_key)}">查看 / 修改</button></td></tr>`).join("")}</tbody></table>`
    : '<p class="empty">选中周及之前 11 周暂无记录。可切换顶部统计周查看更早数据。</p>';
}
function openMember(id) {
  const m = state.members.find((x) => x.id === Number(id));
  const form = $("memberForm");
  form.reset();
  form.elements.id.value = m?.id || "";
  form.elements.revision.value = m?.revision || 0;
  form.elements.name.value = m?.name || "";
  form.elements.team_group.innerHTML = groupOptions(m?.team_group || "INFR");
  form.elements.capability_type.innerHTML = options(
    M.capabilities,
    m?.capability_type || "tech_generalist_advanced",
  );
  form.elements.work_pattern.innerHTML = options(
    M.patterns,
    m?.work_pattern || "routine_support",
  );
  $("dialogTitle").textContent = m ? "修改成员信息" : "新增成员";
  $("dialogError").textContent = "";
  $("memberDialog").showModal();
}
async function changeWeek(week) {
  M.weekDate(week);
  if (!mayLeave()) {
    $("week").value = state.week;
    return;
  }
  const previous = state.week;
  state.week = week;
  $("week").value = week;
  try {
    await reload();
    notice("");
  } catch (e) {
    state.week = previous;
    $("week").value = previous;
    throw e;
  }
}
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ password: $("password").value }),
    });
    $("password").value = "";
    await boot();
  } catch (e) {
    $("loginError").textContent = e.message;
  } finally {
    button.disabled = false;
  }
});
$("logoutBtn").addEventListener(
  "click",
  safe(async () => {
    if (!mayLeave()) return;
    await api("/api/logout", { method: "POST" });
    state.dirty = false;
    location.reload();
  }),
);
document
  .querySelectorAll("[data-view]")
  .forEach((button) =>
    button.addEventListener("click", () => setView(button.dataset.view)),
  );
$("prevWeek").addEventListener(
  "click",
  safe(() => changeWeek(M.shiftWeek(state.week, -1))),
);
$("nextWeek").addEventListener(
  "click",
  safe(() => changeWeek(M.shiftWeek(state.week, 1))),
);
$("thisWeek").addEventListener(
  "click",
  safe(() => changeWeek(state.currentWeek)),
);
$("week").addEventListener(
  "change",
  safe(() => changeWeek($("week").value)),
);
$("group").addEventListener("change", () => {
  state.group = $("group").value;
  renderOverview();
  renderMembers();
});
$("refresh").addEventListener(
  "click",
  safe(async () => {
    if (mayLeave()) await reload();
  }),
);
$("addMember").addEventListener("click", () => {
  if (mayLeave()) {
    state.dirty = false;
    renderReport();
    openMember();
  }
});
$("closeDialog").addEventListener("click", () => $("memberDialog").close());
$("cancelDialog").addEventListener("click", () => $("memberDialog").close());
$("showArchived").addEventListener("change", renderMembers);
$("reportMember").addEventListener("change", () => {
  if (!mayLeave()) {
    $("reportMember").value = state.memberId;
    return;
  }
  state.memberId = Number($("reportMember").value);
  renderReport();
});
$("reportForm").addEventListener("input", () => {
  state.dirty = true;
  $("saveState").textContent = "有未保存修改";
  renderPreview();
});
$("discard").addEventListener("click", () => {
  if (mayLeave()) renderReport();
});
$("reportForm").addEventListener(
  "submit",
  safe(async (e) => {
    e.preventDefault();
    if (
      savedReport()?.model_version === "1.3" &&
      !confirm("此周为旧版快照。保存后会按 v2.0 模型重新计算，继续？")
    )
      return;
    const button = $("saveReport");
    button.disabled = true;
    $("workspace").inert = true;
    try {
      const r = await api(
        `/api/members/${state.memberId}/weeks/${state.week}`,
        { method: "PUT", body: JSON.stringify(readReport()) },
      );
      state.reports = state.reports.filter(
        (x) => !(x.member_id === r.member_id && x.week_key === r.week_key),
      );
      state.reports.unshift(r);
      state.reports.sort((a, b) => b.week_key.localeCompare(a.week_key));
      state.dirty = false;
      renderReport();
      renderOverview();
      notice(`${state.week} 填报已保存。`);
    } finally {
      button.disabled = false;
      $("workspace").inert = false;
    }
  }),
);
$("memberForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget,
    button = f.querySelector("[type=submit]");
  button.disabled = true;
  try {
    const body = Object.fromEntries(new FormData(f));
    body.revision = Number(body.revision);
    const id = body.id;
    delete body.id;
    const m = await api(id ? `/api/members/${id}` : "/api/members", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    state.memberId = m.id;
    $("memberDialog").close();
    await reload();
    notice(
      id
        ? "成员信息已更新，历史快照保持不变。"
        : "成员已新增，可以开始周度填报。",
    );
  } catch (e) {
    $("dialogError").textContent = e.message;
  } finally {
    button.disabled = false;
  }
});
document.addEventListener(
  "click",
  safe(async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.report) {
      if (!mayLeave()) return;
      state.memberId = Number(b.dataset.report);
      renderReport();
      setView("weekly");
    }
    if (b.dataset.edit) {
      if (!mayLeave()) return;
      renderReport();
      openMember(b.dataset.edit);
    }
    if (b.dataset.delete) {
      const m = state.members.find((x) => x.id === Number(b.dataset.delete));
      if (
        !mayLeave() ||
        !confirm(
          `删除“${m.name}”？成员将归档，周历史会保留，可在“显示已归档”中恢复。`,
        )
      )
        return;
      await api(`/api/members/${m.id}`, {
        method: "DELETE",
        body: JSON.stringify({ revision: m.revision }),
      });
      state.dirty = false;
      await reload();
      notice("成员已归档，历史记录已保留。");
    }
    if (b.dataset.restore) {
      if (!mayLeave()) return;
      await api(`/api/members/${b.dataset.restore}/restore`, {
        method: "POST",
      });
      state.dirty = false;
      await reload();
      notice("成员已恢复。");
    }
    if (b.dataset.week) await changeWeek(b.dataset.week);
  }),
);
$("exportBtn").addEventListener(
  "click",
  safe(async () => {
    const data = await api("/api/export");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-capacity-${state.week}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }),
);
window.addEventListener("beforeunload", (e) => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
async function boot() {
  const session = await api("/api/session");
  state.currentWeek = session.current_week;
  state.week = state.week || session.current_week;
  $("week").value = state.week;
  $("loginScreen").hidden = session.authenticated;
  $("workspace").hidden = !session.authenticated;
  $("logoutBtn").hidden = !session.required;
  if (session.authenticated) await reload();
}
safe(boot)();
