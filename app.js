(() => {
  "use strict";

  const STORAGE_KEY = "task-tracker-v1";
  const DEFAULT_STATE = {
    tasks: [],
    settings: {
      firstDayOfWeek: 1
    }
  };

  const state = loadState();
  let currentView = "dashboard";
  let calendarMode = "monthly";
  let calendarCursor = new Date();
  let selectedDate = toDateInput(new Date());

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindNavigation();
    bindGlobalActions();
    renderAll();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function dateKey(date) {
    return toDateInput(date);
  }

  function toDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function fromDateInput(value) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(date, amount) {
    const d = new Date(date);
    d.setDate(d.getDate() + amount);
    return d;
  }

  function addMonths(date, amount) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + amount);
    return d;
  }

  function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day - state.settings.firstDayOfWeek + 7) % 7;
    d.setDate(d.getDate() - diff);
    d.setHours(0,0,0,0);
    return d;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function startOfYear(date) {
    return new Date(date.getFullYear(), 0, 1);
  }

  function endOfYear(date) {
    return new Date(date.getFullYear(), 11, 31);
  }

  function daysBetweenInclusive(a, b) {
    const ms = 86400000;
    return Math.round((fromDateInput(toDateInput(b)) - fromDateInput(toDateInput(a))) / ms) + 1;
  }

  function formatLongDate(value) {
    return fromDateInput(value).toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
  }

  function formatShortDate(date) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function monthName(date) {
    return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function taskListForDate(key) {
    return state.tasks.filter(t => t.date === key);
  }

  function dayStats(key) {
    const tasks = taskListForDate(key);
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { tasks, total, completed, pct, full: total > 0 && completed === total };
  }

  function dayStatus(key) {
    const s = dayStats(key);
    if (!s.total) return { cls: "status-empty", icon: "–", text: "No tasks", heat: "heat-none" };
    if (s.full) return { cls: "status-complete", icon: "✓", text: "Complete", heat: "heat-100" };
    if (s.pct >= 75) return { cls: "status-partial", icon: "✗", text: `${s.pct}%`, heat: "heat-75" };
    if (s.pct >= 50) return { cls: "status-partial", icon: "✗", text: `${s.pct}%`, heat: "heat-50" };
    if (s.pct >= 25) return { cls: "status-low", icon: "✗", text: `${s.pct}%`, heat: "heat-25" };
    return { cls: "status-low", icon: "✗", text: `${s.pct}%`, heat: "heat-1" };
  }

  function eligibleDayStats(start, end) {
    let eligible = 0, fullyComplete = 0, totalTasks = 0, completedTasks = 0;
    const days = [];
    let d = new Date(start);
    while (d <= end) {
      const key = dateKey(d);
      const stats = dayStats(key);
      if (stats.total > 0) {
        eligible++;
        if (stats.full) fullyComplete++;
        totalTasks += stats.total;
        completedTasks += stats.completed;
        days.push({ key, ...stats });
      }
      d = addDays(d, 1);
    }
    return {
      eligible, fullyComplete,
      pct: eligible ? Math.round((fullyComplete / eligible) * 100) : 0,
      totalTasks, completedTasks, days
    };
  }

  function overallStats() {
    const tasks = state.tasks;
    const completed = tasks.filter(t => t.completed).length;
    const days = [...new Set(tasks.map(t => t.date))].map(dayStats);
    const fullDays = days.filter(s => s.full).length;
    const dayPct = days.length ? Math.round(fullDays / days.length * 100) : 0;
    return {
      tasks: tasks.length,
      completed,
      pending: tasks.length - completed,
      taskPct: tasks.length ? Math.round(completed / tasks.length * 100) : 0,
      activeDays: days.length,
      fullDays,
      dayPct
    };
  }

  function getStreaks() {
    const activeDates = [...new Set(
      state.tasks.filter(t => t.completed).map(t => t.date)
    )].sort();

    if (!activeDates.length) return { current: 0, best: 0 };

    let best = 1, run = 1;
    for (let i = 1; i < activeDates.length; i++) {
      if (toDateInput(addDays(fromDateInput(activeDates[i - 1]), 1)) === activeDates[i]) {
        run++;
      } else {
        run = 1;
      }
      best = Math.max(best, run);
    }

    let current = 0;
    let cursor = new Date();
    while (activeDates.includes(toDateInput(cursor))) {
      current++;
      cursor = addDays(cursor, -1);
    }

    return { current, best };
  }

  function completionColorClass(pct, total) {
    if (!total) return "heat-none";
    if (pct === 100) return "heat-100";
    if (pct >= 75) return "heat-75";
    if (pct >= 50) return "heat-50";
    if (pct >= 25) return "heat-25";
    return pct > 0 ? "heat-1" : "heat-0";
  }

  function renderAll() {
    renderHeader();
    renderDashboard();
    renderCalendar();
    renderAnalytics();
    renderSettings();
  }

  function renderHeader() {
    const titles = {
      dashboard: ["Dashboard", "Good morning"],
      calendar: ["Calendar", "Your task calendar"],
      analytics: ["Analytics", "Productivity insights"],
      settings: ["Settings", "Application settings"]
    };
    const [eyebrow, title] = titles[currentView];
    $("#pageEyebrow").textContent = eyebrow;
    $("#pageTitle").textContent = currentView === "dashboard"
      ? `${title}, ${new Date().toLocaleDateString(undefined, { weekday: "long" })}`
      : title;

    $$(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === currentView));
    $$(".view").forEach(view => view.classList.remove("active"));
    $(`#${currentView}View`).classList.add("active");
  }

  function renderDashboard() {
    const todayKey = dateKey(new Date());
    const s = dayStats(todayKey);
    const weekStart = startOfWeek(new Date());
    const weekEnd = addDays(weekStart, 6);
    const week = eligibleDayStats(weekStart, weekEnd);
    const monthStart = startOfMonth(new Date());
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    const month = eligibleDayStats(monthStart, monthEnd);
    const streaks = getStreaks();

    const recent = [...state.tasks]
      .filter(t => t.date === todayKey)
      .sort(taskSort)
      .slice(0, 10);

    $("#dashboardView").innerHTML = `
      <div class="grid dashboard-grid">
        <div class="card card-span-3">
          <div class="stat-label">Today</div>
          <div class="stat-value">${s.total ? s.pct : 0}%</div>
          <div class="stat-sub">${s.completed} / ${s.total} tasks completed</div>
          <div class="progress" style="margin-top:14px"><div style="width:${s.pct}%"></div></div>
        </div>
        <div class="card card-span-3">
          <div class="stat-label">This week</div>
          <div class="stat-value">${week.pct}%</div>
          <div class="stat-sub">${week.fullyComplete} / ${week.eligible} fully completed days</div>
          <div class="progress" style="margin-top:14px"><div style="width:${week.pct}%"></div></div>
        </div>
        <div class="card card-span-3">
          <div class="stat-label">This month</div>
          <div class="stat-value">${month.pct}%</div>
          <div class="stat-sub">${month.fullyComplete} / ${month.eligible} fully completed days</div>
          <div class="progress" style="margin-top:14px"><div style="width:${month.pct}%"></div></div>
        </div>
        <div class="card card-span-3">
          <div class="stat-label">Current streak</div>
          <div class="stat-value">🔥 ${streaks.current}</div>
          <div class="stat-sub">Best streak: ${streaks.best} days</div>
        </div>

        <div class="card card-span-7">
          <div class="section-head">
            <h2>Today's tasks</h2>
            <button class="secondary-btn" data-action="open-day" data-date="${todayKey}">Open day</button>
          </div>
          ${recent.length ? `<div class="task-list">${recent.map(taskRow).join("")}</div>` :
            `<div class="empty">No tasks scheduled for today. Add your first task.</div>`}
        </div>

        <div class="card card-span-5">
          <div class="section-head">
            <h2>This week</h2>
            <button class="secondary-btn" data-action="open-calendar" data-mode="weekly">Week</button>
          </div>
          <div class="weekly-board">${renderWeekMini(weekStart)}</div>
        </div>

        <div class="card card-span-12">
          <div class="section-head">
            <h2>Monthly heatmap</h2>
            <button class="secondary-btn" data-action="open-calendar" data-mode="monthly">Open calendar</button>
          </div>
          ${renderMonthMini(new Date())}
        </div>
      </div>
    `;
  }

  function taskRow(t) {
    const priorityClass = `priority-${t.priority || "medium"}`;
    const time = t.start ? `${t.start}${t.end ? `–${t.end}` : ""}` : "";
    return `
      <div class="task-row ${t.completed ? "completed" : ""}">
        <button class="check-btn ${t.completed ? "checked" : ""}" data-action="toggle-task" data-id="${t.id}" aria-label="Toggle task">
          ${t.completed ? "✓" : ""}
        </button>
        <div class="task-main">
          <div class="task-name">${escapeHtml(t.name)}</div>
          <div class="task-meta">${escapeHtml(t.category || "Other")}${time ? ` · ${escapeHtml(time)}` : ""}${t.notes ? ` · ${escapeHtml(t.notes)}` : ""}</div>
        </div>
        <div class="task-actions">
          <span class="priority ${priorityClass}">${capitalize(t.priority || "medium")}</span>
          <button class="small-btn" data-action="edit-task" data-id="${t.id}" aria-label="Edit">✎</button>
        </div>
      </div>
    `;
  }

  function renderWeekMini(start) {
    const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const key = dateKey(d);
      const s = dayStats(key);
      return `
        <div class="week-card" data-action="open-day" data-date="${key}">
          <div class="dow">${names[i]}</div>
          <div class="date">${d.getDate()}</div>
          <div class="mini-bar"><div style="width:${s.total ? s.pct : 0}%"></div></div>
          <div class="mini-label">${s.total ? `${s.pct}% · ${s.completed}/${s.total}` : "No tasks"}</div>
        </div>
      `;
    }).join("");
  }

  function renderMonthMini(date) {
    const start = startOfMonth(date);
    const offset = (start.getDay() - state.settings.firstDayOfWeek + 7) % 7;
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const cells = [];
    const prevDays = new Date(date.getFullYear(), date.getMonth(), 0).getDate();
    for (let i = offset - 1; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - 1, prevDays - i);
      cells.push(dayCell(d, true));
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(dayCell(new Date(date.getFullYear(), date.getMonth(), day), false));
    }
    while (cells.length < 42) {
      const nextIndex = cells.length - (offset + daysInMonth) + 1;
      cells.push(dayCell(new Date(date.getFullYear(), date.getMonth() + 1, nextIndex), true));
    }
    return `
      <div class="month-grid">
        ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x => `<div class="week-head">${x}</div>`).join("")}
        ${cells.join("")}
      </div>
    `;
  }

  function dayCell(date, outside) {
    const key = dateKey(date);
    const s = dayStats(key);
    const status = dayStatus(key);
    const today = key === dateKey(new Date());
    return `
      <div class="day-cell ${outside ? "outside" : ""} ${today ? "today" : ""}" data-action="open-day" data-date="${key}">
        <div class="day-number">${date.getDate()}</div>
        <div class="day-score">${s.total ? `${s.pct}%` : ""}</div>
        <div class="cell-icon">${s.total ? status.icon : "·"}</div>
        <div class="heat-strip ${status.heat}"></div>
      </div>
    `;
  }

  function renderCalendar() {
    const cursor = calendarCursor;
    let content = "";
    if (calendarMode === "daily") content = renderDailyCalendar(cursor);
    if (calendarMode === "weekly") content = renderWeeklyCalendar(cursor);
    if (calendarMode === "monthly") content = renderMonthlyCalendar(cursor);
    if (calendarMode === "yearly") content = renderYearlyCalendar(cursor);

    $("#calendarView").innerHTML = `
      <div class="card">
        <div class="calendar-toolbar">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="secondary-btn" data-action="calendar-prev">←</button>
            <button class="secondary-btn" data-action="calendar-today">Today</button>
            <button class="secondary-btn" data-action="calendar-next">→</button>
            <strong>${calendarMode === "yearly" ? cursor.getFullYear() : monthName(cursor)}</strong>
          </div>
          <div class="segmented">
            ${["daily","weekly","monthly","yearly"].map(mode =>
              `<button class="${calendarMode === mode ? "active" : ""}" data-action="set-calendar-mode" data-mode="${mode}">${capitalize(mode)}</button>`
            ).join("")}
          </div>
        </div>
        ${content}
      </div>
    `;
  }

  function renderDailyCalendar(date) {
    const key = dateKey(date);
    const s = dayStats(key);
    return `
      <div class="grid" style="grid-template-columns:1fr 1.7fr;align-items:start">
        <div class="card">
          <div class="eyebrow">Selected day</div>
          <h2 style="margin:6px 0">${formatLongDate(key)}</h2>
          <div class="stat-value">${s.pct}%</div>
          <div class="stat-sub">${s.completed} / ${s.total} completed</div>
          <div class="progress" style="margin-top:14px"><div style="width:${s.pct}%"></div></div>
          <div style="margin-top:16px">
            <button class="primary-btn" data-action="add-task" data-date="${key}">＋ Add task</button>
          </div>
        </div>
        <div>
          <div class="section-head">
            <h2>Tasks</h2>
            <span class="day-status ${dayStatus(key).cls}">
              <span class="status-icon">${dayStatus(key).icon}</span>${dayStatus(key).text}
            </span>
          </div>
          ${s.tasks.length ? `<div class="task-list">${s.tasks.sort(taskSort).map(taskRow).join("")}</div>` :
            `<div class="empty">No tasks for this date.</div>`}
        </div>
      </div>
    `;
  }

  function renderWeeklyCalendar(date) {
    const start = startOfWeek(date);
    const end = addDays(start, 6);
    const week = eligibleDayStats(start, end);
    return `
      <div class="section-head">
        <div>
          <h2 style="margin:0">Week of ${formatShortDate(start)} – ${formatShortDate(end)}</h2>
          <div class="stat-sub">${week.fullyComplete} / ${week.eligible} eligible days fully completed</div>
        </div>
        <div class="stat-value" style="font-size:24px">${week.pct}%</div>
      </div>
      <div class="weekly-board">${renderWeekMini(start)}</div>
    `;
  }

  function renderMonthlyCalendar(date) {
    const start = startOfMonth(date);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const stats = eligibleDayStats(start, end);
    return `
      <div class="section-head">
        <div>
          <h2 style="margin:0">${monthName(date)}</h2>
          <div class="stat-sub">${stats.fullyComplete} / ${stats.eligible} eligible days fully completed</div>
        </div>
        <div class="stat-value" style="font-size:24px">${stats.pct}%</div>
      </div>
      ${renderMonthMini(date)}
    `;
  }

  function renderYearlyCalendar(date) {
    const year = date.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
    const all = eligibleDayStats(startOfYear(date), endOfYear(date));
    return `
      <div class="section-head">
        <div>
          <h2 style="margin:0">${year} annual heatmap</h2>
          <div class="stat-sub">${all.fullyComplete} / ${all.eligible} eligible days fully completed</div>
        </div>
        <div class="stat-value" style="font-size:24px">${all.pct}%</div>
      </div>
      <div class="year-grid">
        ${months.map(m => {
          const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
          const boxes = [];
          for (let d = 1; d <= days; d++) {
            const key = dateKey(new Date(year, m.getMonth(), d));
            const s = dayStats(key);
            boxes.push(`<div class="box ${completionColorClass(s.pct, s.total)}" title="${key}: ${s.total ? `${s.pct}%` : "No tasks"}" data-action="open-day" data-date="${key}"></div>`);
          }
          return `<div class="year-month">${m.toLocaleDateString(undefined,{month:"short"})}<div class="stack">${boxes.join("")}</div></div>`;
        }).join("")}
      </div>
      <div class="year-summary">
        <span>Green = 100%</span><span>Light green = 75–99%</span><span>Yellow = 50–74%</span><span>Orange = 25–49%</span><span>Red = below 25%</span>
      </div>
    `;
  }

  function renderAnalytics() {
    const today = new Date();
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = dateKey(d);
      const s = dayStats(key);
      last14.push({ date: d, ...s });
    }
    const stats = overallStats();
    const streaks = getStreaks();

    $("#analyticsView").innerHTML = `
      <div class="grid analytics-grid">
        <div class="card chart-card">
          <div class="section-head">
            <div>
              <h2>Last 14 days</h2>
              <div class="stat-sub">Daily task completion percentage</div>
            </div>
          </div>
          <div class="chart">
            ${last14.map(x => `
              <div class="bar-wrap" title="${dateKey(x.date)}: ${x.total ? x.pct : "No tasks"}%">
                <div class="bar" style="height:${x.total ? Math.max(3, x.pct) : 3}%"></div>
                <div class="bar-label">${x.date.getDate()}</div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="card metrics-card">
          <div class="section-head"><h2>Overall</h2></div>
          <div class="metric-line"><span>Total tasks</span><b>${stats.tasks}</b></div>
          <div class="metric-line"><span>Tasks completed</span><b>${stats.completed}</b></div>
          <div class="metric-line"><span>Tasks pending</span><b>${stats.pending}</b></div>
          <div class="metric-line"><span>Task completion</span><b>${stats.taskPct}%</b></div>
          <div class="metric-line"><span>Fully completed days</span><b>${stats.fullDays}</b></div>
          <div class="metric-line"><span>Current streak</span><b>${streaks.current}</b></div>
          <div class="metric-line"><span>Best streak</span><b>${streaks.best}</b></div>
        </div>

        <div class="card card-span-12">
          <div class="section-head"><h2>How the score works</h2></div>
          <p class="setting-note">
            Daily completion = completed tasks ÷ total tasks. Weekly completion = fully completed days ÷ days that had at least one task.
            A day with no task is excluded from the weekly score, so empty days do not artificially increase your performance.
          </p>
        </div>
      </div>
    `;
  }

  function renderSettings() {
    $("#settingsView").innerHTML = `
      <div class="grid settings-grid">
        <div class="card">
          <div class="section-head"><h2>Data</h2></div>
          <p class="setting-note">Your tasks are stored in this browser using localStorage. Use Export data regularly if you want a backup or want to move your data to another browser.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="primary-btn" data-action="export">Export JSON</button>
            <button class="secondary-btn" data-action="seed-demo">Add demo data</button>
          </div>
        </div>
        <div class="card danger-zone">
          <div class="section-head"><h2>Danger zone</h2></div>
          <p class="setting-note">This permanently deletes all tasks from this browser. Export your data first if you need a backup.</p>
          <button class="danger-btn" data-action="clear-all">Delete all tasks</button>
        </div>
        <div class="card">
          <div class="section-head"><h2>GitHub Pages</h2></div>
          <p class="setting-note">
            This application requires no backend and can be hosted directly from a GitHub repository using GitHub Pages.
            Because data is stored locally, the same account/data is not automatically shared across devices.
          </p>
        </div>
      </div>
    `;
  }

  function bindNavigation() {
    document.addEventListener("click", e => {
      const nav = e.target.closest(".nav-item");
      if (!nav) return;
      currentView = nav.dataset.view;
      renderAll();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function bindGlobalActions() {
    $("#quickAddBtn").addEventListener("click", () => openTaskModal(selectedDate));
    $("#todayBtn").addEventListener("click", () => {
      selectedDate = dateKey(new Date());
      calendarCursor = new Date();
      currentView = "calendar";
      calendarMode = "daily";
      renderAll();
    });
    $("#closeModalBtn").addEventListener("click", closeTaskModal);
    $("#cancelModalBtn").addEventListener("click", closeTaskModal);
    $("#deleteTaskBtn").addEventListener("click", deleteFromModal);
    $("#taskForm").addEventListener("submit", saveTaskFromModal);
    $("#modalBackdrop").addEventListener("click", e => {
      if (e.target.id === "modalBackdrop") closeTaskModal();
    });

    $("#exportBtn").addEventListener("click", exportData);
    $("#importInput").addEventListener("change", importData);

    document.body.addEventListener("click", e => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const action = el.dataset.action;

      if (action === "toggle-task") toggleTask(el.dataset.id);
      if (action === "edit-task") openTaskModal(null, el.dataset.id);
      if (action === "add-task") openTaskModal(el.dataset.date);
      if (action === "open-day") {
        selectedDate = el.dataset.date;
        calendarCursor = fromDateInput(selectedDate);
        currentView = "calendar";
        calendarMode = "daily";
        renderAll();
      }
      if (action === "open-calendar") {
        currentView = "calendar";
        calendarMode = el.dataset.mode || "monthly";
        calendarCursor = new Date();
        renderAll();
      }
      if (action === "set-calendar-mode") {
        calendarMode = el.dataset.mode;
        renderCalendar();
      }
      if (action === "calendar-prev") navigateCalendar(-1);
      if (action === "calendar-next") navigateCalendar(1);
      if (action === "calendar-today") {
        calendarCursor = new Date();
        selectedDate = dateKey(calendarCursor);
        renderCalendar();
      }
      if (action === "export") exportData();
      if (action === "seed-demo") seedDemo();
      if (action === "clear-all") clearAll();
    });
  }

  function navigateCalendar(direction) {
    if (calendarMode === "daily") calendarCursor = addDays(calendarCursor, direction);
    if (calendarMode === "weekly") calendarCursor = addDays(calendarCursor, direction * 7);
    if (calendarMode === "monthly") calendarCursor = addMonths(calendarCursor, direction);
    if (calendarMode === "yearly") calendarCursor = new Date(calendarCursor.getFullYear() + direction, calendarCursor.getMonth(), calendarCursor.getDate());
    renderCalendar();
  }

  function openTaskModal(date = null, taskId = null) {
    const task = taskId ? state.tasks.find(t => t.id === taskId) : null;
    $("#taskModalTitle").textContent = task ? "Edit task" : "Add task";
    $("#taskId").value = task?.id || "";
    $("#taskName").value = task?.name || "";
    $("#taskDate").value = task?.date || date || selectedDate || dateKey(new Date());
    $("#taskCategory").value = task?.category || "Work";
    $("#taskPriority").value = task?.priority || "medium";
    $("#taskStart").value = task?.start || "";
    $("#taskEnd").value = task?.end || "";
    $("#taskNotes").value = task?.notes || "";
    $("#taskRecurring").checked = false;
    $("#deleteTaskBtn").classList.toggle("hidden", !task);
    $("#modalBackdrop").classList.remove("hidden");
    setTimeout(() => $("#taskName").focus(), 50);
  }

  function closeTaskModal() {
    $("#modalBackdrop").classList.add("hidden");
  }

  function saveTaskFromModal(e) {
    e.preventDefault();
    const id = $("#taskId").value;
    const payload = {
      name: $("#taskName").value.trim(),
      date: $("#taskDate").value,
      category: $("#taskCategory").value,
      priority: $("#taskPriority").value,
      start: $("#taskStart").value,
      end: $("#taskEnd").value,
      notes: $("#taskNotes").value.trim()
    };

    if (!payload.name || !payload.date) return;

    if (id) {
      const existing = state.tasks.find(t => t.id === id);
      if (existing) Object.assign(existing, payload);
      showToast("Task updated");
    } else {
      state.tasks.push({
        id: uid(),
        ...payload,
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString()
      });

      if ($("#taskRecurring").checked) {
        const base = fromDateInput(payload.date);
        for (let i = 1; i <= 30; i++) {
          const d = dateKey(addDays(base, i));
          state.tasks.push({
            id: uid(),
            ...payload,
            date: d,
            completed: false,
            completedAt: null,
            createdAt: new Date().toISOString()
          });
        }
        showToast("Task created for 31 days");
      } else {
        showToast("Task added");
      }
    }

    saveState();
    selectedDate = payload.date;
    closeTaskModal();
    renderAll();
  }

  function deleteFromModal() {
    const id = $("#taskId").value;
    if (!id) return;
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (!confirm(`Delete "${task.name}"?`)) return;
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    closeTaskModal();
    renderAll();
    showToast("Task deleted");
  }

  function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveState();
    renderAll();
  }

  function taskSort(a, b) {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    return (a.start || "99:99").localeCompare(b.start || "99:99") || a.name.localeCompare(b.name);
  }

  function exportData() {
    const payload = {
      app: "Task Tracker",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-tracker-${dateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Data exported");
  }

  function importData(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = parsed.data || parsed;
        if (!Array.isArray(imported.tasks)) throw new Error("Invalid data");
        state.tasks = imported.tasks;
        state.settings = { ...DEFAULT_STATE.settings, ...(imported.settings || {}) };
        saveState();
        renderAll();
        showToast("Data imported");
      } catch {
        alert("The selected file is not a valid Task Tracker export.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function clearAll() {
    if (!state.tasks.length) return;
    if (!confirm("Delete all tasks? This cannot be undone unless you exported a backup.")) return;
    state.tasks = [];
    saveState();
    renderAll();
    showToast("All tasks deleted");
  }

  function seedDemo() {
    const start = new Date();
    const samples = [
      ["Morning exercise", "Health", "high"],
      ["Check emails", "Work", "medium"],
      ["Review BA requirements", "Work", "high"],
      ["Update Jira", "Work", "medium"],
      ["30 minutes reading", "Learning", "low"]
    ];

    samples.forEach((item, i) => {
      const d = dateKey(addDays(start, -(i % 4)));
      state.tasks.push({
        id: uid(),
        name: item[0],
        date: d,
        category: item[1],
        priority: item[2],
        start: "",
        end: "",
        notes: "Demo task",
        completed: i !== 3,
        completedAt: i !== 3 ? new Date().toISOString() : null,
        createdAt: new Date().toISOString()
      });
    });

    saveState();
    renderAll();
    showToast("Demo data added");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[ch]));
  }

  function capitalize(v) {
    return String(v || "").charAt(0).toUpperCase() + String(v || "").slice(1);
  }

  function showToast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => el.classList.remove("show"), 1800);
  }
})();
