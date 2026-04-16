const GROUPS = ['INFR', 'IND', 'APP', 'SM', 'NET', 'DIGI', 'GUIYANG'];
const FILTER_ALL = 'ALL';

const METRICS = [];

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
  { key: 'inc_count', label: 'INC（事故）', weight: 2.0, weightText: 'x2.0', defaultValue: 0, kind: 'ops', unit: '件', help: '生产环境事故或紧急故障单，处理压力最大。' },
  { key: 'req_count', label: 'REQ（请求）', weight: 1.0, weightText: 'x1.0', defaultValue: 0, kind: 'ops', unit: '件', help: '标准化服务请求，例如权限申请、软件安装。' },
  { key: 'chg_count', label: 'CHG（变更）', weight: 1.5, weightText: 'x1.5', defaultValue: 0, kind: 'ops', unit: '件', help: '涉及生产系统风险的变更，例如扩容、升级与切换。' },
  { key: 'prb_count', label: 'PRB（问题）', weight: 2.0, weightText: 'x2.0', defaultValue: 0, kind: 'ops', unit: '件', help: '问题管理与 RCA，通常需要长时间深挖。' },
  { key: 'active_projects', label: '活跃项目数', weight: 5.0, weightText: 'x5 /个', defaultValue: 0, kind: 'project', unit: '个', help: '当周同时负责推进的大型项目数量。' },
  { key: 'planner_tasks', label: 'Planner 任务数', weight: 2.0, weightText: 'x2 /个', defaultValue: 0, kind: 'project', unit: '个', help: '计划内已经拆解并进入执行的原子任务数量。' }
];

const THRESHOLDS = {
  idle: 10,
  healthy: 20,
  medium: 30,
  high: 40
};

const state = {
  members: [],
  activeId: null,
  lineChart: null,
  barChart: null,
  viewMode: 'editor',
  groupFilter: FILTER_ALL
};

const dom = {
  layout: document.getElementById('layout'),
  editorPanel: document.getElementById('editorPanel'),
  editorViewBtn: document.getElementById('editorViewBtn'),
  dashboardViewBtn: document.getElementById('dashboardViewBtn'),
  memberSelect: document.getElementById('memberSelect'),
  memberName: document.getElementById('memberName'),
  teamGroup: document.getElementById('teamGroup'),
  capabilityType: document.getElementById('capabilityType'),
  workPattern: document.getElementById('workPattern'),
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
  avg: document.getElementById('avg'),
  fullLoadCount: document.getElementById('fullLoadCount'),
  idleCount: document.getElementById('idleCount'),
  groupFilterLabel: document.getElementById('groupFilterLabel'),
  memberGrid: document.getElementById('memberGrid'),
  groupFilterSelect: document.getElementById('groupFilterSelect'),
  groupGrid: document.getElementById('groupGrid')
};

function localizeStaticText() {
  document.title = '团队动态负荷评估系统 V3';
  document.querySelector('.page-head h1').textContent = '团队动态负荷评估系统';
  document.querySelector('.page-head .lead').textContent = '支持成员维护、周任务量录入、全员看板和按组查看。当前默认按 7 个小组管理：INFR、IND、APP、SM、NET、DIGI、GUIYANG。';
  dom.editorViewBtn.textContent = '编辑视图';
  dom.dashboardViewBtn.textContent = '全员看板';

  const editorCard = dom.editorPanel.querySelector('.card');
  editorCard.querySelector('h2').textContent = '成员编辑';
  editorCard.querySelector('.subtle').textContent = '成员姓名允许临时留空，输入时也允许空格，例如 `SAM Wang`。保存时如果仍为空，会自动回填为“未命名成员”。';
  document.querySelector('label[for="memberSelect"]').textContent = '当前成员';
  document.getElementById('addMemberBtn').textContent = '添加成员';
  document.getElementById('saveMemberBtn').textContent = '保存当前成员';
  document.querySelector('label[for="memberName"]').textContent = '成员姓名';
  dom.memberName.placeholder = '例如：SAM Wang';
  document.querySelector('label[for="teamGroup"]').textContent = '所属小组';
  document.querySelector('label[for="capabilityType"]').textContent = '核心能力';
  document.querySelector('label[for="workPattern"]').textContent = '当前任务类型';

  const formulaCard = document.querySelector('.formula-card');
  formulaCard.querySelector('h3').textContent = '计算说明';
  formulaCard.querySelector('p').innerHTML = '<strong>总负荷 = （运维得分 × 上下文系数 + 项目得分）× CFC</strong>';
  formulaCard.querySelector('ul').innerHTML = [
    '<li>运维得分 = INC × 2.0 + REQ × 1.0 + CHG × 1.5 + PRB × 2.0</li>',
    '<li>项目得分 = 活跃项目数 × 5.0 + Planner 任务数 × 2.0</li>',
    '<li>当周超过 3 种运维单据类型时，上下文系数 = 1.1，否则为 1.0</li>',
    '<li>CFC 由核心能力与当前任务类型的匹配关系自动计算</li>'
  ].join('');

  const resultPanel = document.getElementById('resultPanel');
  resultPanel.children[0].textContent = '当前真实负荷指数';
  resultPanel.querySelector('.result-meta').innerHTML = [
    '<div>基础负荷：<strong id="baseWorkload">0.0</strong></div>',
    '<div>运维 / 项目：<strong id="scoreBreakdown">0.0 / 0.0</strong> <span id="contextFactorLabel">上下文系数 x1.0</span></div>',
    '<div>CFC：<strong id="currentCfc">1.00</strong> <span id="currentMatchLabel">正常匹配</span></div>'
  ].join('');
  dom.baseWorkload = document.getElementById('baseWorkload');
  dom.scoreBreakdown = document.getElementById('scoreBreakdown');
  dom.contextFactorLabel = document.getElementById('contextFactorLabel');
  dom.currentCfc = document.getElementById('currentCfc');
  dom.currentMatchLabel = document.getElementById('currentMatchLabel');

  const overviewCard = document.querySelector('.right-stack .card');
  overviewCard.querySelector('h2').textContent = '团队概览';
  const kpiTitles = overviewCard.querySelectorAll('.kpi-title');
  kpiTitles[0].textContent = '平均负荷';
  kpiTitles[1].textContent = '满载人数';
  kpiTitles[2].textContent = '极度空闲人数';
  kpiTitles[3].textContent = '当前筛选小组';

  document.querySelector('#memberBoardCard h3').textContent = '成员状态看板';
  document.querySelectorAll('.right-stack .card h3')[1].textContent = '图表概览';
  document.querySelector('#groupDashboardCard h3').textContent = '按组看板';
  document.querySelector('#groupDashboardCard .subtle').textContent = '通过下拉选项可以只查看某个小组，也可以查看全员分组状态。';
  document.querySelector('label[for="groupFilterSelect"]').textContent = '按小组视图';
}

function normalizeCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function displayName(member) {
  return member && member.name !== '' ? member.name : '未命名成员';
}

function sanitizeNameForSave(name) {
  const normalized = String(name || '').trim();
  return normalized || '未命名成员';
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

function createDraftMember() {
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
  return draft;
}

function getActiveMember() {
  return state.members.find((member) => String(member.id) === String(state.activeId)) || null;
}

function calcOpsScore(member) {
  return TASK_FIELDS
    .filter((metric) => metric.kind === 'ops')
    .reduce((sum, metric) => sum + normalizeCount(member[metric.key]) * metric.weight, 0);
}

function calcProjectScore(member) {
  return TASK_FIELDS
    .filter((metric) => metric.kind === 'project')
    .reduce((sum, metric) => sum + normalizeCount(member[metric.key]) * metric.weight, 0);
}

function calcContextFactor(member) {
  const activeOpsTypes = TASK_FIELDS
    .filter((metric) => metric.kind === 'ops')
    .filter((metric) => normalizeCount(member[metric.key]) > 0)
    .length;
  return activeOpsTypes > 3 ? 1.1 : 1.0;
}

function calcBaseWorkload(member) {
  return calcOpsScore(member) * calcContextFactor(member) + calcProjectScore(member);
}

function calcWorkload(member) {
  const cfcMeta = getCfcMeta(member);
  return calcBaseWorkload(member) * cfcMeta.value;
}

function getStatus(workload) {
  if (workload < THRESHOLDS.idle) {
    return { text: '状态：极度空闲', shortText: '极度空闲', pillClass: 'pill-blue', color: '#0284c7' };
  }
  if (workload < THRESHOLDS.healthy) {
    return { text: '状态：健康有余力', shortText: '健康有余力', pillClass: 'pill-green', color: '#16a34a' };
  }
  if (workload < THRESHOLDS.medium) {
    return { text: '状态：中等负荷', shortText: '中等负荷', pillClass: 'pill-yellow', color: '#ca8a04' };
  }
  if (workload < THRESHOLDS.high) {
    return { text: '状态：较高负荷', shortText: '较高负荷', pillClass: 'pill-orange', color: '#ea580c' };
  }
  return { text: '状态：负荷满载', shortText: '负荷满载', pillClass: 'pill-red', color: '#dc2626' };
}

function buildMetricInputs() {
  dom.metricsContainer.innerHTML = TASK_FIELDS.map((metric) => `
    <div class="metric">
      <div class="metric-head">
        <div class="metric-title">
          <label for="${metric.key}">${metric.label}</label>
          <span class="metric-weight">${metric.weightText || ''}</span>
        </div>
        <span class="metric-value" id="${metric.key}Value">0</span>
      </div>
      <input id="${metric.key}" type="number" min="0" step="1" inputmode="numeric" aria-label="${metric.label}">
      <p class="metric-help">${metric.help}</p>
    </div>
  `).join('');

  TASK_FIELDS.forEach((metric) => {
    document.getElementById(metric.key).addEventListener('input', () => handleMetricInput(metric.key));
  });
}

function buildCapabilityOptions() {
  dom.capabilityType.innerHTML = CAPABILITY_TYPES.map((item) => `<option value="${item.value}">${item.label}</option>`).join('');
}

function buildWorkPatternOptions() {
  dom.workPattern.innerHTML = WORK_PATTERNS.map((item) => `<option value="${item.value}">${item.label}</option>`).join('');
}

function buildGroupOptions() {
  dom.teamGroup.innerHTML = GROUPS.map((group) => `<option value="${group}">${group}</option>`).join('');
}

function buildGroupFilters() {
  const items = [FILTER_ALL].concat(GROUPS);
  dom.groupFilterSelect.innerHTML = items.map((item) => `
    <option value="${item}">${item === FILTER_ALL ? '全部小组' : item}</option>
  `).join('');
  dom.groupFilterSelect.value = state.groupFilter;
}

function renderMemberSelect() {
  dom.memberSelect.innerHTML = state.members.map((member) => `
    <option value="${member.id}">${displayName(member)}</option>
  `).join('');
  dom.memberSelect.value = state.activeId;
}

function renderEditor() {
  const member = getActiveMember();
  if (!member) return;

  dom.memberName.value = member.name || '';
  dom.teamGroup.value = member.team_group || GROUPS[0];
  dom.capabilityType.value = member.capability_type || 'tech_generalist_advanced';
  dom.workPattern.value = member.work_pattern || 'routine_support';

  TASK_FIELDS.forEach((metric) => {
    const value = normalizeCount(member[metric.key]);
    document.getElementById(metric.key).value = value;
    document.getElementById(`${metric.key}Value`).innerText = value;
  });

  renderCurrentResult();
}

function renderCurrentResult() {
  const member = getActiveMember();
  if (!member) return;

  const opsScore = calcOpsScore(member);
  const projectScore = calcProjectScore(member);
  const contextFactor = calcContextFactor(member);
  const baseWorkload = calcBaseWorkload(member);
  const cfcMeta = getCfcMeta(member);
  const workload = baseWorkload * cfcMeta.value;
  const status = getStatus(workload);
  dom.currentWorkload.innerText = workload.toFixed(1);
  dom.currentStatus.innerText = status.text;
  dom.baseWorkload.innerText = baseWorkload.toFixed(1);
  dom.scoreBreakdown.innerText = `${opsScore.toFixed(1)} / ${projectScore.toFixed(1)}`;
  dom.contextFactorLabel.innerText = `上下文系数 x${contextFactor.toFixed(1)}`;
  dom.currentCfc.innerText = cfcMeta.value.toFixed(2);
  dom.currentMatchLabel.innerText = `（${cfcMeta.label}）`;
  dom.resultPanel.style.background = status.color;

  const topMetric = TASK_FIELDS
    .map((metric) => ({ ...metric, contribution: normalizeCount(member[metric.key]) * metric.weight, value: normalizeCount(member[metric.key]) }))
    .sort((a, b) => b.contribution - a.contribution)[0];

  const tips = [];
  if (workload >= THRESHOLDS.high) {
    tips.push('当前已经接近上限，建议立刻做任务收敛与资源重分配。');
  } else if (workload >= THRESHOLDS.medium) {
    tips.push('当前负荷偏高，建议优先保障关键事项，减少临时插入工作。');
  } else if (workload >= THRESHOLDS.healthy) {
    tips.push('当前处于中等负荷区，可以推进，但需要观察是否继续上升。');
  } else if (workload < THRESHOLDS.idle) {
    tips.push('当前明显偏空闲，可以补充优化类、预研类或支持性任务。');
  } else {
    tips.push('当前仍有健康余量，可以承接少量增量任务并保留缓冲。');
  }

  if (topMetric && topMetric.value > 0) {
    tips.push(`当前主要压力来源是“${topMetric.label}”，优先对这一项做减压最有效。`);
  }

  tips.push(`所属小组：${member.team_group || GROUPS[0]}。`);
  tips.push(`核心能力：${getCapabilityLabel(member.capability_type)}；当前任务类型：${getWorkPatternLabel(member.work_pattern)}。`);
  tips.push(`运维得分 ${opsScore.toFixed(1)}，项目得分 ${projectScore.toFixed(1)}，上下文系数 ${contextFactor.toFixed(1)}。`);
  tips.push(`基础负荷 ${baseWorkload.toFixed(1)} × CFC ${cfcMeta.value.toFixed(2)} = 最终负荷 ${workload.toFixed(1)}。`);
  dom.memberTips.innerHTML = tips.map((tip) => `<li>${tip}</li>`).join('');
}

function renderMemberBoard() {
  dom.memberGrid.innerHTML = state.members.map((member) => {
    const baseWorkload = calcBaseWorkload(member);
    const cfcMeta = getCfcMeta(member);
    const workload = calcWorkload(member);
    const status = getStatus(workload);
    const activeClass = String(member.id) === String(state.activeId) ? 'active' : '';
    return `
      <div class="member-card ${activeClass}" data-member-id="${member.id}">
        <h4>${displayName(member)}</h4>
        <div class="subtle">小组：${member.team_group || GROUPS[0]}</div>
        <div class="subtle">最终负荷：${workload.toFixed(1)}</div>
        <div class="subtle">基础负荷 ${baseWorkload.toFixed(1)} | CFC ${cfcMeta.value.toFixed(2)}</div>
        <div class="pill-row">
          <span class="pill ${status.pillClass}">${status.shortText}</span>
        </div>
      </div>
    `;
  }).join('');

  dom.memberGrid.querySelectorAll('.member-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.activeId = card.dataset.memberId;
      state.viewMode = 'editor';
      renderAll();
    });
  });
}

function getFilteredMembers() {
  if (state.groupFilter === FILTER_ALL) {
    return state.members;
  }
  return state.members.filter((member) => (member.team_group || GROUPS[0]) === state.groupFilter);
}

function renderGroupDashboard() {
  const visibleGroups = state.groupFilter === FILTER_ALL ? GROUPS : [state.groupFilter];
  dom.groupGrid.innerHTML = visibleGroups.map((group) => {
    const members = state.members.filter((member) => (member.team_group || GROUPS[0]) === group);
    const avg = members.length ? (members.reduce((sum, member) => sum + calcWorkload(member), 0) / members.length).toFixed(1) : '0.0';
    const fullLoad = members.filter((member) => calcWorkload(member) >= THRESHOLDS.high).length;

    return `
      <div class="group-card">
        <h3>${group}</h3>
        <div class="subtle">成员数：${members.length} | 平均负荷：${avg} | 满载人数：${fullLoad}</div>
        <div class="group-members">
          ${members.length ? members.map((member) => {
            const baseWorkload = calcBaseWorkload(member);
            const cfcMeta = getCfcMeta(member);
            const workload = calcWorkload(member);
            const status = getStatus(workload);
            return `
              <div class="group-member">
                <strong>${displayName(member)}</strong>
                <div class="subtle">最终负荷：${workload.toFixed(1)}</div>
                <div class="subtle">基础负荷 ${baseWorkload.toFixed(1)} | CFC ${cfcMeta.value.toFixed(2)}</div>
                <div class="pill-row">
                  <span class="pill ${status.pillClass}">${status.shortText}</span>
                </div>
              </div>
            `;
          }).join('') : '<div class="group-member"><strong>暂无成员</strong><div class="subtle">当前小组还没有配置成员。</div></div>'}
        </div>
      </div>
    `;
  }).join('');
}

function getWeekKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - start) / 86400000);
  const week = Math.ceil((days + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function saveTrend(avg) {
  const trend = JSON.parse(localStorage.getItem('trend') || '{}');
  trend[getWeekKey()] = Number(avg);
  localStorage.setItem('trend', JSON.stringify(trend));
}

function renderTrend(avg) {
  saveTrend(avg);
  const trend = JSON.parse(localStorage.getItem('trend') || '{}');
  const labels = Object.keys(trend);
  const data = Object.values(trend);

  if (!state.lineChart) {
    state.lineChart = new Chart(document.getElementById('lineChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '团队平均负荷',
          data,
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15, 118, 110, 0.18)',
          fill: true,
          tension: 0.3
        }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
    return;
  }

  state.lineChart.data.labels = labels;
  state.lineChart.data.datasets[0].data = data;
  state.lineChart.update();
}

function renderBarChart(members) {
  const labels = members.map((member) => displayName(member));
  const values = members.map((member) => Number(calcWorkload(member).toFixed(1)));

  if (!state.barChart) {
    state.barChart = new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '成员负荷值',
          data: values,
          backgroundColor: ['#0f766e', '#14b8a6', '#0284c7', '#f59e0b', '#ea580c', '#dc2626', '#7c3aed']
        }]
      },
      options: { plugins: { legend: { display: false } } }
    });
    return;
  }

  state.barChart.data.labels = labels;
  state.barChart.data.datasets[0].data = values;
  state.barChart.update();
}

function renderDashboard() {
  const filtered = getFilteredMembers();
  const avg = filtered.length ? filtered.reduce((sum, member) => sum + calcWorkload(member), 0) / filtered.length : 0;
  const fullLoadCount = filtered.filter((member) => calcWorkload(member) >= THRESHOLDS.high).length;
  const idleCount = filtered.filter((member) => calcWorkload(member) < THRESHOLDS.idle).length;

  dom.avg.innerText = avg.toFixed(1);
  dom.fullLoadCount.innerText = String(fullLoadCount);
  dom.idleCount.innerText = String(idleCount);
  dom.groupFilterLabel.innerText = state.groupFilter === FILTER_ALL ? '全部' : state.groupFilter;

  renderTrend(avg.toFixed(1));
  renderBarChart(filtered.length ? filtered : state.members);
  renderMemberBoard();
  renderGroupDashboard();
}

function applyViewMode() {
  const dashboardOnly = state.viewMode === 'dashboard';
  dom.layout.classList.toggle('dashboard-mode', dashboardOnly);
  dom.editorPanel.classList.toggle('hidden', dashboardOnly);
  dom.editorViewBtn.classList.toggle('active', !dashboardOnly);
  dom.dashboardViewBtn.classList.toggle('active', dashboardOnly);
}

function renderAll() {
  renderMemberSelect();
  renderEditor();
  renderDashboard();
  applyViewMode();
}

function handleNameInput() {
  const member = getActiveMember();
  if (!member) return;
  member.name = dom.memberName.value;
  renderMemberSelect();
  dom.memberSelect.value = state.activeId;
  renderMemberBoard();
  renderGroupDashboard();
  renderBarChart(getFilteredMembers().length ? getFilteredMembers() : state.members);
}

function handleGroupInput() {
  const member = getActiveMember();
  if (!member) return;
  member.team_group = dom.teamGroup.value;
  renderMemberBoard();
  renderGroupDashboard();
  renderDashboard();
}

function handleCapabilityInput() {
  const member = getActiveMember();
  if (!member) return;
  member.capability_type = dom.capabilityType.value;
  renderCurrentResult();
  renderDashboard();
}

function handleWorkPatternInput() {
  const member = getActiveMember();
  if (!member) return;
  member.work_pattern = dom.workPattern.value;
  renderCurrentResult();
  renderDashboard();
}

function handleMetricInput(metricKey) {
  const member = getActiveMember();
  if (!member) return;
  const value = normalizeCount(document.getElementById(metricKey).value);
  member[metricKey] = value;
  document.getElementById(`${metricKey}Value`).innerText = value;
  renderCurrentResult();
  renderDashboard();
}

async function loadMembers() {
  const response = await fetch('/api/members');
  const data = await response.json();
  state.members = Array.isArray(data) && data.length ? data : [createDraftMember()];
  state.members = state.members.map((member) => ({
    ...createDraftMember(),
    ...member,
    team_group: member.team_group || GROUPS[0],
    capability_type: member.capability_type || 'tech_generalist_advanced',
    work_pattern: member.work_pattern || 'routine_support'
  }));
  state.activeId = state.members[0].id;
  renderAll();
}

async function addMember() {
  const draft = createDraftMember();
  const response = await fetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...draft, name: sanitizeNameForSave(draft.name) })
  });

  if (!response.ok) {
    alert('添加成员失败，请检查后端服务。');
    return;
  }

  const created = await response.json();
  state.members.push(created);
  state.activeId = created.id;
  state.viewMode = 'editor';
  renderAll();
  dom.memberName.focus();
  dom.memberName.select();
}

async function saveMember() {
  const member = getActiveMember();
  if (!member || !member.id) return;

  const payload = {
    ...member,
    name: sanitizeNameForSave(member.name),
    team_group: member.team_group || GROUPS[0],
    capability_type: member.capability_type || 'tech_generalist_advanced',
    work_pattern: member.work_pattern || 'routine_support'
  };
  const response = await fetch(`/api/members/${member.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    alert('保存失败，请稍后重试。');
    return;
  }

  const saved = await response.json();
  const index = state.members.findIndex((item) => String(item.id) === String(saved.id));
  if (index >= 0) {
    state.members[index] = saved;
    state.activeId = saved.id;
  }
  renderAll();
}

function bindEvents() {
  dom.memberSelect.addEventListener('change', (event) => {
    state.activeId = event.target.value;
    renderAll();
  });

  dom.memberName.addEventListener('input', handleNameInput);
  dom.teamGroup.addEventListener('change', handleGroupInput);
  dom.capabilityType.addEventListener('change', handleCapabilityInput);
  dom.workPattern.addEventListener('change', handleWorkPatternInput);

  document.getElementById('addMemberBtn').addEventListener('click', addMember);
  document.getElementById('saveMemberBtn').addEventListener('click', saveMember);
  dom.groupFilterSelect.addEventListener('change', (event) => {
    state.groupFilter = event.target.value;
    renderDashboard();
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

localizeStaticText();
buildCapabilityOptions();
buildWorkPatternOptions();
buildMetricInputs();
buildGroupOptions();
buildGroupFilters();
bindEvents();
loadMembers();
