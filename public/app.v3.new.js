const GROUPS = ['INFR', 'IND', 'APP', 'SM', 'NET', 'DIGI', 'GUIYANG'];
const FILTER_ALL = 'ALL';

const CAPABILITY_TYPES = [
  { value: 'tech_specialist', label: '技术专长型' },
  { value: 'project_delivery', label: '项目/交付型' },
  { value: 'comms_coordination', label: '沟通/协调型' },
  { value: 'tech_generalist_junior', label: '技术全能（初级）' },
  { value: 'tech_generalist_advanced', label: '技术全能（进阶）' }
];

const WORK_PATTERNS = [
  { value: 'deep_technical', label: '深度技术攻坚' },
  { value: 'multi_system_integration', label: '多系统技术整合' },
  { value: 'project_delivery', label: '项目推进交付' },
  { value: 'high_comms', label: '高频沟通协调' },
  { value: 'routine_support', label: '常规综合支撑' }
];

const CFC_MATRIX = {
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

const TASK_FIELDS = [
  { key: 'inc_count', label: 'INC（事故）', weight: 2.0, weightText: 'x2.0', defaultValue: 0, kind: 'ops', help: '生产环境事故或紧急故障单，处理压力最大。' },
  { key: 'req_count', label: 'REQ（请求）', weight: 1.0, weightText: 'x1.0', defaultValue: 0, kind: 'ops', help: '标准化服务请求，例如权限申请、软件安装。' },
  { key: 'chg_count', label: 'CHG（变更）', weight: 1.5, weightText: 'x1.5', defaultValue: 0, kind: 'ops', help: '涉及生产系统风险的变更，例如扩容、升级与切换。' },
  { key: 'prb_count', label: 'PRB（问题）', weight: 2.0, weightText: 'x2.0', defaultValue: 0, kind: 'ops', help: '问题管理与 RCA，通常需要长时间深挖。' },
  { key: 'active_projects', label: '活跃项目数', weight: 5.0, weightText: 'x5 /个', defaultValue: 0, kind: 'project', help: '当周同时负责推进的大型项目数量。' },
  { key: 'planner_tasks', label: 'Planner 任务数', weight: 2.0, weightText: 'x2 /个', defaultValue: 0, kind: 'project', help: '计划内已经拆解并进入执行的原子任务数量。' }
];

const THRESHOLDS = {
  idle: 10,
  healthy: 20,
  medium: 30,
  high: 40
};

const HIGH_LOAD_THRESHOLD = THRESHOLDS.medium;

const state = {
  members: [],
  activeId: null,
  lineChart: null,
  barChart: null,
  memberHistoryChart: null,
  viewMode: 'editor',
  groupFilter: FILTER_ALL,
  historyByMember: {},
  selectedHistoryWeek: '',
  dirty: false,
  saving: false,
  saveError: '',
  addModalOpen: false
};

const dom = {
  layout: document.getElementById('layout'),
  editorPanel: document.getElementById('editorPanel'),
  editorViewBtn: document.getElementById('editorViewBtn'),
  dashboardViewBtn: document.getElementById('dashboardViewBtn'),
  groupDashboardBtn: document.getElementById('groupDashboardBtn'),
  overviewGroupSelect: document.getElementById('overviewGroupSelect'),
  teamOverviewCard: document.getElementById('teamOverviewCard'),
  memberBoardCard: document.getElementById('memberBoardCard'),
  historyCard: document.getElementById('historyCard'),
  chartOverviewCard: document.getElementById('chartOverviewCard'),
  groupDashboardSection: document.getElementById('groupDashboardSection'),
  memberSelect: document.getElementById('memberSelect'),
  memberNameValue: document.getElementById('memberNameValue'),
  teamGroupValue: document.getElementById('teamGroupValue'),
  capabilityTypeValue: document.getElementById('capabilityTypeValue'),
  workPatternValue: document.getElementById('workPatternValue'),
  metricsContainer: document.getElementById('metricsContainer'),
  resultPanel: document.getElementById('resultPanel'),
  currentWorkload: document.getElementById('currentWorkload'),
  currentStatus: document.getElementById('currentStatus'),
  baseWorkload: document.getElementById('baseWorkload'),
  scoreBreakdown: document.getElementById('scoreBreakdown'),
  contextFactorLabel: document.getElementById('contextFactorLabel'),
  currentCfc: document.getElementById('currentCfc'),
  currentMatchLabel: document.getElementById('currentMatchLabel'),
  memberTips: document.getElementById('memberTips'),
  saveMemberBtn: document.getElementById('saveMemberBtn'),
  saveStatus: document.getElementById('saveStatus'),
  avg: document.getElementById('avg'),
  fullLoadCount: document.getElementById('fullLoadCount'),
  idleCount: document.getElementById('idleCount'),
  groupFilterLabel: document.getElementById('groupFilterLabel'),
  memberGrid: document.getElementById('memberGrid'),
  groupFilterSelect: document.getElementById('groupFilterSelect'),
  groupGrid: document.getElementById('groupGrid'),
  historyWeekSelect: document.getElementById('historyWeekSelect'),
  historyCurrentWeek: document.getElementById('historyCurrentWeek'),
  historyPreviousWeek: document.getElementById('historyPreviousWeek'),
  historyFourWeekAvg: document.getElementById('historyFourWeekAvg'),
  historySelectedWeekValue: document.getElementById('historySelectedWeekValue'),
  consecutiveHighWeeks: document.getElementById('consecutiveHighWeeks'),
  historyRiskPill: document.getElementById('historyRiskPill'),
  historyMemberLabel: document.getElementById('historyMemberLabel'),
  memberHistoryChart: document.getElementById('memberHistoryChart'),
  riskBadges: document.getElementById('riskBadges'),
  actionSuggestions: document.getElementById('actionSuggestions'),
  addMemberBtn: document.getElementById('addMemberBtn'),
  editMemberInfoBtn: document.getElementById('editMemberInfoBtn'),
  addMemberModal: document.getElementById('addMemberModal'),
  closeMemberModalBtn: document.getElementById('closeMemberModalBtn'),
  cancelMemberModalBtn: document.getElementById('cancelMemberModalBtn'),
  confirmAddMemberBtn: document.getElementById('confirmAddMemberBtn'),
  modalMemberName: document.getElementById('modalMemberName'),
  modalTeamGroup: document.getElementById('modalTeamGroup'),
  modalCapabilityType: document.getElementById('modalCapabilityType'),
  modalWorkPattern: document.getElementById('modalWorkPattern'),
  editMemberModal: document.getElementById('editMemberModal'),
  closeEditMemberModalBtn: document.getElementById('closeEditMemberModalBtn'),
  cancelEditMemberModalBtn: document.getElementById('cancelEditMemberModalBtn'),
  confirmEditMemberBtn: document.getElementById('confirmEditMemberBtn'),
  editMemberName: document.getElementById('editMemberName'),
  editTeamGroup: document.getElementById('editTeamGroup'),
  editCapabilityType: document.getElementById('editCapabilityType'),
  editWorkPattern: document.getElementById('editWorkPattern')
};

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

function normalizeCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function sanitizeNameForSave(name) {
  const normalized = String(name || '').trim();
  return normalized || '未命名成员';
}

function displayName(member) {
  return sanitizeNameForSave(member?.name);
}

function getCapabilityLabel(value) {
  return CAPABILITY_TYPES.find((item) => item.value === value)?.label || '技术全能（进阶）';
}

function getWorkPatternLabel(value) {
  return WORK_PATTERNS.find((item) => item.value === value)?.label || '常规综合支撑';
}

function getCfcMeta(member) {
  const capabilityType = member.capability_type || 'tech_generalist_advanced';
  const workPattern = member.work_pattern || 'routine_support';
  const capabilityMatrix = CFC_MATRIX[capabilityType] || CFC_MATRIX.tech_generalist_advanced;
  return capabilityMatrix[workPattern] || { value: 1.0, label: '正常匹配' };
}

function createDraftMember(overrides = {}) {
  const draft = {
    id: null,
    name: `新成员 ${state.members.length + 1}`,
    team_group: GROUPS[0],
    capability_type: 'tech_generalist_advanced',
    work_pattern: 'routine_support'
  };
  TASK_FIELDS.forEach((metric) => {
    draft[metric.key] = metric.defaultValue;
  });
  return { ...draft, ...overrides };
}

function fillSelect(select, items) {
  select.innerHTML = items.map((item) => `<option value="${item.value}">${item.label}</option>`).join('');
}

function buildSelectOptions() {
  fillSelect(dom.modalCapabilityType, CAPABILITY_TYPES);
  fillSelect(dom.modalWorkPattern, WORK_PATTERNS);
  fillSelect(dom.modalTeamGroup, GROUPS.map((group) => ({ value: group, label: group })));
  fillSelect(dom.editCapabilityType, CAPABILITY_TYPES);
  fillSelect(dom.editWorkPattern, WORK_PATTERNS);
  fillSelect(dom.editTeamGroup, GROUPS.map((group) => ({ value: group, label: group })));
  dom.groupFilterSelect.innerHTML = [FILTER_ALL].concat(GROUPS)
    .map((item) => `<option value="${item}">${item === FILTER_ALL ? '全部小组' : item}</option>`)
    .join('');
}

function buildMetricInputs() {
  dom.metricsContainer.innerHTML = `
    <div class="metrics-grid">
      ${TASK_FIELDS.map((metric) => `
        <div class="metric">
          <div class="metric-head">
            <div class="metric-title">
              <label for="${metric.key}">${metric.label}</label>
              <span class="metric-weight">${metric.weightText}</span>
            </div>
            <span class="metric-value" id="${metric.key}Value">0</span>
          </div>
          <input id="${metric.key}" type="number" min="0" step="1" inputmode="numeric" aria-label="${metric.label}">
          <p class="metric-help">${metric.help}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function getActiveMember() {
  return state.members.find((member) => String(member.id) === String(state.activeId)) || null;
}

function calcOpsScore(member) {
  return TASK_FIELDS.filter((metric) => metric.kind === 'ops')
    .reduce((sum, metric) => sum + normalizeCount(member[metric.key]) * metric.weight, 0);
}

function calcProjectScore(member) {
  return TASK_FIELDS.filter((metric) => metric.kind === 'project')
    .reduce((sum, metric) => sum + normalizeCount(member[metric.key]) * metric.weight, 0);
}

function calcContextFactor(member) {
  const activeOpsTypes = TASK_FIELDS.filter((metric) => metric.kind === 'ops' && normalizeCount(member[metric.key]) > 0).length;
  return activeOpsTypes > 3 ? 1.1 : 1.0;
}

function calcBaseWorkload(member) {
  return calcOpsScore(member) * calcContextFactor(member) + calcProjectScore(member);
}

function calcWorkload(member) {
  return calcBaseWorkload(member) * getCfcMeta(member).value;
}

function getStatus(workload) {
  if (workload < THRESHOLDS.idle) return { text: '状态：极度空闲', shortText: '极度空闲', pillClass: 'pill-blue', color: '#0284c7' };
  if (workload < THRESHOLDS.healthy) return { text: '状态：健康有余力', shortText: '健康有余力', pillClass: 'pill-green', color: '#16a34a' };
  if (workload < THRESHOLDS.medium) return { text: '状态：中等负荷', shortText: '中等负荷', pillClass: 'pill-yellow', color: '#ca8a04' };
  if (workload < THRESHOLDS.high) return { text: '状态：较高负荷', shortText: '较高负荷', pillClass: 'pill-orange', color: '#ea580c' };
  return { text: '状态：负荷满载', shortText: '负荷满载', pillClass: 'pill-red', color: '#dc2626' };
}

function getMemberHistory(memberId) {
  return state.historyByMember[String(memberId)] || [];
}

function calculateConsecutiveHighWeeks(history) {
  let count = 0;
  for (const snapshot of history) {
    if (Number(snapshot.final_load) >= HIGH_LOAD_THRESHOLD) count += 1;
    else break;
  }
  return count;
}

function buildRiskMeta(member) {
  const opsScore = calcOpsScore(member);
  const projectScore = calcProjectScore(member);
  const contextFactor = calcContextFactor(member);
  const cfcMeta = getCfcMeta(member);
  const finalLoad = calcWorkload(member);
  const consecutiveHigh = calculateConsecutiveHighWeeks(getMemberHistory(member.id));
  const risks = [];
  const actions = [];

  if (finalLoad >= THRESHOLDS.high) risks.push({ label: '短期高压', level: 'high' });
  if (consecutiveHigh >= 2) risks.push({ label: '持续高压', level: 'high' });
  if (contextFactor > 1 && opsScore >= 12) risks.push({ label: '高打断型', level: 'medium' });
  if (projectScore >= 16) risks.push({ label: '项目堆积型', level: 'medium' });
  if (cfcMeta.value >= 1.25) risks.push({ label: '错配型高负荷', level: 'high' });

  if (normalizeCount(member.inc_count) + normalizeCount(member.prb_count) >= 6) {
    actions.push('INC/PRB 偏高，建议安排二线支持或对问题池做拆分。');
  }
  if (normalizeCount(member.active_projects) > 2) {
    actions.push('活跃项目超过 2 个，建议削减并行项目或明确阶段主次。');
  }
  if (contextFactor === 1.1 && opsScore >= 10) {
    actions.push('运维类型分散且打断较多，建议集中排班，减少单人跨类处理。');
  }
  if (cfcMeta.value >= 1.25) {
    actions.push('CFC 较高，建议重新分派任务，或增加 pairing 支持。');
  }
  if (consecutiveHigh >= 3) {
    actions.push('已连续多周高负荷，建议在周例会上优先安排减载或临时资源倾斜。');
  }
  if (!actions.length) {
    actions.push('当前没有明显的强制干预项，可继续观察趋势变化并保留缓冲。');
  }

  return { opsScore, projectScore, contextFactor, cfcMeta, finalLoad, risks, actions };
}

function setDirty(isDirty, error = '') {
  state.dirty = isDirty;
  state.saveError = error;
  renderSaveStatus();
}

function renderSaveStatus() {
  dom.saveMemberBtn.disabled = state.saving || !state.activeId;
  dom.saveMemberBtn.classList.toggle('is-dirty', state.dirty && !state.saving);
  if (state.saving) {
    dom.saveMemberBtn.textContent = '保存中...';
    dom.saveStatus.textContent = '正在保存';
    dom.saveStatus.className = 'status-chip saving';
    return;
  }
  dom.saveMemberBtn.textContent = state.dirty ? '保存本周变更' : '保存当前成员';
  if (state.saveError) {
    dom.saveStatus.textContent = state.saveError;
    dom.saveStatus.className = 'status-chip error';
    return;
  }
  dom.saveStatus.textContent = state.dirty ? '有未保存修改' : '已同步';
  dom.saveStatus.className = 'status-chip';
}

function renderMemberSelect() {
  dom.memberSelect.innerHTML = state.members.map((member) => `<option value="${member.id}">${displayName(member)}</option>`).join('');
  dom.memberSelect.value = state.activeId;
}

function renderCurrentResult() {
  const member = getActiveMember();
  if (!member) return;
  const riskMeta = buildRiskMeta(member);
  const baseWorkload = calcBaseWorkload(member);
  const status = getStatus(riskMeta.finalLoad);
  dom.currentWorkload.textContent = riskMeta.finalLoad.toFixed(1);
  dom.currentStatus.textContent = status.text;
  dom.baseWorkload.textContent = baseWorkload.toFixed(1);
  dom.scoreBreakdown.textContent = `${riskMeta.opsScore.toFixed(1)} / ${riskMeta.projectScore.toFixed(1)}`;
  dom.contextFactorLabel.textContent = `上下文系数 x${riskMeta.contextFactor.toFixed(1)}`;
  dom.currentCfc.textContent = riskMeta.cfcMeta.value.toFixed(2);
  dom.currentMatchLabel.textContent = `（${riskMeta.cfcMeta.label}）`;
  dom.resultPanel.style.background = status.color;

  const topMetric = TASK_FIELDS
    .map((metric) => ({ ...metric, contribution: normalizeCount(member[metric.key]) * metric.weight, value: normalizeCount(member[metric.key]) }))
    .sort((a, b) => b.contribution - a.contribution)[0];

  const tips = [];
  if (riskMeta.finalLoad >= THRESHOLDS.high) tips.push('当前已经接近上限，建议立刻做任务收敛与资源重分配。');
  else if (riskMeta.finalLoad >= THRESHOLDS.medium) tips.push('当前负荷偏高，建议优先保障关键事项，减少临时插入工作。');
  else if (riskMeta.finalLoad >= THRESHOLDS.healthy) tips.push('当前处于中等负荷区，可以推进，但需要观察是否继续上升。');
  else if (riskMeta.finalLoad < THRESHOLDS.idle) tips.push('当前明显偏空闲，可以补充优化类、预研类或支持性任务。');
  else tips.push('当前仍有健康余量，可以承接少量增量任务并保留缓冲。');
  if (topMetric?.value > 0) tips.push(`当前主要压力来源是“${topMetric.label}”，优先对这一项做减压最有效。`);
  tips.push(`所属小组：${member.team_group || GROUPS[0]}。`);
  tips.push(`核心能力：${getCapabilityLabel(member.capability_type)}；当前任务类型：${getWorkPatternLabel(member.work_pattern)}。`);
  tips.push(`运维得分 ${riskMeta.opsScore.toFixed(1)}，项目得分 ${riskMeta.projectScore.toFixed(1)}，上下文系数 ${riskMeta.contextFactor.toFixed(1)}。`);
  tips.push(`基础负荷 ${baseWorkload.toFixed(1)} × CFC ${riskMeta.cfcMeta.value.toFixed(2)} = 最终负荷 ${riskMeta.finalLoad.toFixed(1)}。`);
  dom.memberTips.innerHTML = tips.map((tip) => `<li>${tip}</li>`).join('');

  dom.riskBadges.innerHTML = (riskMeta.risks.length ? riskMeta.risks : [{ label: '暂无显著风险', level: 'low' }])
    .map((risk) => `<div class="risk-badge ${risk.level === 'high' ? 'high' : risk.level === 'medium' ? 'medium' : ''}">${risk.label}</div>`)
    .join('');
  dom.actionSuggestions.innerHTML = riskMeta.actions.map((action) => `<li>${action}</li>`).join('');
}

function renderEditor() {
  const member = getActiveMember();
  if (!member) return;
  dom.memberNameValue.textContent = displayName(member);
  dom.teamGroupValue.textContent = member.team_group || GROUPS[0];
  dom.capabilityTypeValue.textContent = getCapabilityLabel(member.capability_type);
  dom.workPatternValue.textContent = getWorkPatternLabel(member.work_pattern);
  TASK_FIELDS.forEach((metric) => {
    const value = normalizeCount(member[metric.key]);
    document.getElementById(metric.key).value = value;
    document.getElementById(`${metric.key}Value`).textContent = value;
  });
  renderCurrentResult();
  renderHistoryPanel();
  renderSaveStatus();
}

function renderHistoryPanel() {
  const member = getHistoryTargetMember();
  if (!member) {
    dom.historyMemberLabel.textContent = '当前展示成员：暂无可展示成员';
    return;
  }
  const history = getMemberHistory(member.id);
  const currentWeek = getCurrentWeekKey();
  const selectedWeek = state.selectedHistoryWeek && history.some((item) => item.week_key === state.selectedHistoryWeek)
    ? state.selectedHistoryWeek
    : (history[0]?.week_key || currentWeek);
  state.selectedHistoryWeek = selectedWeek;

  dom.historyWeekSelect.innerHTML = history.length
    ? history.map((item) => `<option value="${item.week_key}">${item.week_key}</option>`).join('')
    : `<option value="${currentWeek}">${currentWeek}</option>`;
  dom.historyWeekSelect.value = selectedWeek;

  const current = history[0]?.final_load ?? calcWorkload(member);
  const previous = history[1]?.final_load ?? 0;
  const avgList = history.slice(0, 4);
  const avg = avgList.length ? avgList.reduce((sum, item) => sum + Number(item.final_load || 0), 0) / avgList.length : current;
  const selected = history.find((item) => item.week_key === selectedWeek);
  const consecutive = calculateConsecutiveHighWeeks(history);

  dom.historyCurrentWeek.textContent = Number(current).toFixed(1);
  dom.historyPreviousWeek.textContent = Number(previous).toFixed(1);
  dom.historyFourWeekAvg.textContent = Number(avg).toFixed(1);
  dom.historySelectedWeekValue.textContent = Number(selected?.final_load ?? current).toFixed(1);
  dom.consecutiveHighWeeks.textContent = String(consecutive);
  dom.historyRiskPill.textContent = consecutive >= 3 ? '持续高压' : Number(current) >= THRESHOLDS.high ? '短期高压' : Number(current) >= THRESHOLDS.medium ? '重点关注' : '暂无风险';

  dom.historyMemberLabel.textContent = `当前展示成员：${displayName(member)} · ${(member.team_group || GROUPS[0])}`;
  dom.historyMemberLabel.textContent = `当前展示成员：${displayName(member)} · ${(member.team_group || GROUPS[0])}`;
  dom.historyMemberLabel.textContent = `\u5f53\u524d\u5c55\u793a\u6210\u5458\uff1a${displayName(member)} \u00b7 ${(member.team_group || GROUPS[0])}`;
  const labels = history.slice().reverse().map((item) => item.week_key);
  const values = history.slice().reverse().map((item) => Number(item.final_load || 0).toFixed(1));
  if (!state.memberHistoryChart) {
    state.memberHistoryChart = new Chart(dom.memberHistoryChart, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '成员周负荷趋势',
          data: values,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.16)',
          fill: true,
          tension: 0.3
        }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  } else {
    state.memberHistoryChart.data.labels = labels;
    state.memberHistoryChart.data.datasets[0].data = values;
    state.memberHistoryChart.update();
  }
}

function renderMemberBoard() {
  dom.memberGrid.innerHTML = getFilteredMembers().map((member) => {
    const workload = calcWorkload(member);
    const baseWorkload = calcBaseWorkload(member);
    const cfcMeta = getCfcMeta(member);
    const status = getStatus(workload);
    const activeClass = String(member.id) === String(state.activeId) ? 'active' : '';
    const risk = buildRiskMeta(member).risks[0];
    return `
      <div class="member-card ${activeClass}" data-member-id="${member.id}">
        <h4>${displayName(member)}</h4>
        <div class="subtle">小组：${member.team_group || GROUPS[0]}</div>
        <div class="subtle">最终负荷：${workload.toFixed(1)}</div>
        <div class="subtle">基础负荷 ${baseWorkload.toFixed(1)} | CFC ${cfcMeta.value.toFixed(2)}</div>
        <div class="pill-row">
          <span class="pill ${status.pillClass}">${status.shortText}</span>
          ${risk ? `<span class="trend-pill">${risk.label}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
  dom.memberGrid.querySelectorAll('.member-card').forEach((card) => {
    card.addEventListener('click', async () => {
      state.activeId = card.dataset.memberId;
      state.selectedHistoryWeek = '';
      setDirty(false);
      renderAll();
      await loadMemberHistory(state.activeId);
    });
  });
}

function getFilteredMembers() {
  return state.groupFilter === FILTER_ALL
    ? state.members
    : state.members.filter((member) => (member.team_group || GROUPS[0]) === state.groupFilter);
}

function getHistoryTargetMember() {
  const activeMember = getActiveMember();
  const filteredMembers = getFilteredMembers();
  if (state.groupFilter === FILTER_ALL) return activeMember || filteredMembers[0] || null;
  if (activeMember && (activeMember.team_group || GROUPS[0]) === state.groupFilter) return activeMember;
  return filteredMembers[0] || null;
}

async function handleGroupFilterChange(nextGroup) {
  state.groupFilter = nextGroup;
  const targetMember = getHistoryTargetMember();
  renderDashboard();
  renderHistoryPanel();
  if (targetMember && !state.historyByMember[String(targetMember.id)]) {
    await loadMemberHistory(targetMember.id);
  }
}

function renderGroupDashboard() {
  const visibleGroups = state.groupFilter === FILTER_ALL ? GROUPS : [state.groupFilter];
  dom.groupGrid.innerHTML = visibleGroups.map((group) => {
    const members = state.members.filter((member) => (member.team_group || GROUPS[0]) === group);
    const avg = members.length ? members.reduce((sum, member) => sum + calcWorkload(member), 0) / members.length : 0;
    const fullLoad = members.filter((member) => calcWorkload(member) >= THRESHOLDS.high).length;
    const highRatio = members.length ? Math.round((members.filter((member) => calcWorkload(member) >= THRESHOLDS.medium).length / members.length) * 100) : 0;
    const remaining = members.reduce((sum, member) => sum + Math.max(0, THRESHOLDS.high - calcWorkload(member)), 0);
    const keyMember = members.map((member) => ({ name: displayName(member), workload: calcWorkload(member) })).sort((a, b) => b.workload - a.workload)[0];
    return `
      <div class="group-card">
        <h3>${group}</h3>
        <div class="subtle">成员数：${members.length} | 平均负荷：${avg.toFixed(1)} | 满载人数：${fullLoad}</div>
        <div class="subtle">高负荷占比：${highRatio}% | 可接单余量：${remaining.toFixed(1)}</div>
        <div class="subtle">关键人依赖：${keyMember ? `${keyMember.name}（${keyMember.workload.toFixed(1)}）` : '暂无'}</div>
        <div class="group-members">
          ${members.length ? members.map((member) => {
            const status = getStatus(calcWorkload(member));
            return `
              <div class="group-member">
                <strong>${displayName(member)}</strong>
                <div class="subtle">最终负荷：${calcWorkload(member).toFixed(1)}</div>
                <div class="pill-row"><span class="pill ${status.pillClass}">${status.shortText}</span></div>
              </div>
            `;
          }).join('') : '<div class="group-member"><strong>暂无成员</strong><div class="subtle">当前小组还没有配置成员。</div></div>'}
        </div>
      </div>
    `;
  }).join('');
}

function renderTrend(avg) {
  const trend = JSON.parse(localStorage.getItem('team-trend') || '{}');
  trend[getCurrentWeekKey()] = Number(avg);
  localStorage.setItem('team-trend', JSON.stringify(trend));
  const labels = Object.keys(trend);
  const data = Object.values(trend);
  if (!state.lineChart) {
    state.lineChart = new Chart(document.getElementById('lineChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: '团队平均负荷', data, borderColor: '#0f766e', backgroundColor: 'rgba(15, 118, 110, 0.18)', fill: true, tension: 0.3 }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  } else {
    state.lineChart.data.labels = labels;
    state.lineChart.data.datasets[0].data = data;
    state.lineChart.update();
  }
}

function renderBarChart(members) {
  const labels = members.map((member) => displayName(member));
  const values = members.map((member) => Number(calcWorkload(member).toFixed(1)));
  if (!state.barChart) {
    state.barChart = new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: '成员负荷值', data: values, backgroundColor: ['#0f766e', '#14b8a6', '#0284c7', '#f59e0b', '#ea580c', '#dc2626', '#7c3aed'] }]
      },
      options: { plugins: { legend: { display: false } } }
    });
  } else {
    state.barChart.data.labels = labels;
    state.barChart.data.datasets[0].data = values;
    state.barChart.update();
  }
}

function renderDashboard() {
  const filtered = getFilteredMembers();
  const avg = filtered.length ? filtered.reduce((sum, member) => sum + calcWorkload(member), 0) / filtered.length : 0;
  dom.avg.textContent = avg.toFixed(1);
  dom.fullLoadCount.textContent = String(filtered.filter((member) => calcWorkload(member) >= THRESHOLDS.medium).length);
  dom.idleCount.textContent = String(filtered.filter((member) => calcWorkload(member) < THRESHOLDS.idle).length);
  dom.groupFilterLabel.textContent = state.groupFilter === FILTER_ALL ? '全部' : state.groupFilter;
  dom.overviewGroupSelect.value = state.groupFilter;
  dom.groupFilterSelect.value = state.groupFilter;
  renderTrend(avg.toFixed(1));
  renderBarChart(filtered);
  renderMemberBoard();
  renderGroupDashboard();
}

function applyViewMode() {
  const dashboardOnly = state.viewMode !== 'editor';
  const groupOnly = state.viewMode === 'group';
  dom.layout.classList.toggle('dashboard-mode', dashboardOnly);
  dom.editorPanel.classList.toggle('hidden', dashboardOnly);
  dom.editorViewBtn.classList.toggle('active', state.viewMode === 'editor');
  dom.dashboardViewBtn.classList.toggle('active', state.viewMode === 'dashboard');
  dom.groupDashboardBtn.classList.toggle('active', groupOnly);
  dom.teamOverviewCard.classList.toggle('hidden', groupOnly);
  dom.memberBoardCard.classList.toggle('hidden', groupOnly);
  dom.historyCard.classList.toggle('hidden', groupOnly);
  dom.chartOverviewCard.classList.toggle('hidden', groupOnly);
  dom.groupDashboardSection.classList.toggle('hidden', !groupOnly);
}

function renderAll() {
  renderMemberSelect();
  renderEditor();
  renderDashboard();
  applyViewMode();
}

function updateActiveMember(mutator) {
  const member = getActiveMember();
  if (!member) return;
  mutator(member);
  setDirty(true);
  renderAll();
}

function openAddMemberModal() {
  state.addModalOpen = true;
  dom.addMemberModal.classList.add('show');
  dom.addMemberModal.setAttribute('aria-hidden', 'false');
  dom.modalMemberName.value = '';
  dom.modalTeamGroup.value = GROUPS[0];
  dom.modalCapabilityType.value = 'tech_generalist_advanced';
  dom.modalWorkPattern.value = 'routine_support';
  dom.modalMemberName.focus();
}

function closeAddMemberModal() {
  state.addModalOpen = false;
  dom.addMemberModal.classList.remove('show');
  dom.addMemberModal.setAttribute('aria-hidden', 'true');
}

function openEditMemberModal() {
  const member = getActiveMember();
  if (!member) return;
  dom.editMemberName.value = member.name || '';
  dom.editTeamGroup.value = member.team_group || GROUPS[0];
  dom.editCapabilityType.value = member.capability_type || 'tech_generalist_advanced';
  dom.editWorkPattern.value = member.work_pattern || 'routine_support';
  dom.editMemberModal.classList.add('show');
  dom.editMemberModal.setAttribute('aria-hidden', 'false');
  dom.editMemberName.focus();
}

function closeEditMemberModal() {
  dom.editMemberModal.classList.remove('show');
  dom.editMemberModal.setAttribute('aria-hidden', 'true');
}

function applyEditMemberModal() {
  const member = getActiveMember();
  if (!member) return;
  member.name = sanitizeNameForSave(dom.editMemberName.value);
  member.team_group = dom.editTeamGroup.value;
  member.capability_type = dom.editCapabilityType.value;
  member.work_pattern = dom.editWorkPattern.value;
  setDirty(true);
  closeEditMemberModal();
  renderAll();
}

async function loadMembers() {
  const response = await fetch('/api/members');
  const data = await response.json();
  state.members = Array.isArray(data) && data.length ? data.map((member) => ({ ...createDraftMember(), ...member })) : [createDraftMember()];
  state.activeId = state.members[0].id;
  renderAll();
  await loadMemberHistory(state.activeId);
}

async function loadMemberHistory(memberId) {
  if (!memberId) return;
  const response = await fetch(`/api/members/${memberId}/history`);
  if (!response.ok) return;
  const data = await response.json();
  state.historyByMember[String(memberId)] = Array.isArray(data.snapshots) ? data.snapshots : [];
  renderHistoryPanel();
}

async function addMember() {
  dom.confirmAddMemberBtn.disabled = true;
  const payload = createDraftMember({
    name: sanitizeNameForSave(dom.modalMemberName.value),
    team_group: dom.modalTeamGroup.value,
    capability_type: dom.modalCapabilityType.value,
    work_pattern: dom.modalWorkPattern.value
  });
  const response = await fetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, week_key: getCurrentWeekKey() })
  });
  dom.confirmAddMemberBtn.disabled = false;
  if (!response.ok) {
    alert('添加成员失败，请检查后端服务。');
    return;
  }
  const created = await response.json();
  state.members.push({ ...createDraftMember(), ...created });
  state.activeId = created.id;
  closeAddMemberModal();
  setDirty(false);
  renderAll();
  await loadMemberHistory(created.id);
}

async function saveMember() {
  const member = getActiveMember();
  if (!member || !member.id || state.saving) return;
  state.saving = true;
  state.saveError = '';
  renderSaveStatus();
  const payload = {
    ...member,
    name: sanitizeNameForSave(member.name),
    week_key: getCurrentWeekKey()
  };
  const response = await fetch(`/api/members/${member.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  state.saving = false;
  if (!response.ok) {
    setDirty(true, '保存失败');
    alert('保存失败，请稍后重试。');
    return;
  }
  const saved = await response.json();
  const index = state.members.findIndex((item) => String(item.id) === String(saved.id));
  if (index >= 0) state.members[index] = { ...createDraftMember(), ...saved };
  setDirty(false);
  renderAll();
  await loadMemberHistory(saved.id);
}

function bindEvents() {
  dom.memberSelect.addEventListener('change', async (event) => {
    state.activeId = event.target.value;
    state.selectedHistoryWeek = '';
    setDirty(false);
    renderAll();
    await loadMemberHistory(state.activeId);
  });
  TASK_FIELDS.forEach((metric) => {
    document.getElementById(metric.key).addEventListener('input', () => updateActiveMember((member) => {
      member[metric.key] = normalizeCount(document.getElementById(metric.key).value);
    }));
  });
  dom.addMemberBtn.addEventListener('click', openAddMemberModal);
  dom.groupDashboardBtn.addEventListener('click', () => {
    state.viewMode = 'group';
    applyViewMode();
  });
  dom.editMemberInfoBtn.addEventListener('click', openEditMemberModal);
  dom.closeMemberModalBtn.addEventListener('click', closeAddMemberModal);
  dom.cancelMemberModalBtn.addEventListener('click', closeAddMemberModal);
  dom.confirmAddMemberBtn.addEventListener('click', addMember);
  dom.addMemberModal.addEventListener('click', (event) => {
    if (event.target === dom.addMemberModal) closeAddMemberModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.addModalOpen) closeAddMemberModal();
    if (event.key === 'Escape' && dom.editMemberModal.classList.contains('show')) closeEditMemberModal();
  });
  dom.closeEditMemberModalBtn.addEventListener('click', closeEditMemberModal);
  dom.cancelEditMemberModalBtn.addEventListener('click', closeEditMemberModal);
  dom.confirmEditMemberBtn.addEventListener('click', applyEditMemberModal);
  dom.editMemberModal.addEventListener('click', (event) => {
    if (event.target === dom.editMemberModal) closeEditMemberModal();
  });
  dom.saveMemberBtn.addEventListener('click', saveMember);
  dom.overviewGroupSelect.addEventListener('change', async (event) => {
    await handleGroupFilterChange(event.target.value);
  });
  dom.groupFilterSelect.addEventListener('change', async (event) => {
    await handleGroupFilterChange(event.target.value);
  });
  dom.historyWeekSelect.addEventListener('change', (event) => {
    state.selectedHistoryWeek = event.target.value;
    renderHistoryPanel();
  });
  dom.editorViewBtn.addEventListener('click', () => {
    state.viewMode = 'editor';
    applyViewMode();
  });
  dom.dashboardViewBtn.addEventListener('click', () => {
    state.viewMode = 'dashboard';
    applyViewMode();
  });
}

buildSelectOptions();
dom.overviewGroupSelect.innerHTML = dom.groupFilterSelect.innerHTML;
buildMetricInputs();
bindEvents();
renderSaveStatus();
loadMembers();
