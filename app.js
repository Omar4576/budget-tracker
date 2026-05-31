const STORAGE_KEY = "daily-command-center-v1";
const SESSION_KEY = "daily-command-auth";
const FILE_DB = "daily-command-files";
const FILE_STORE = "files";
const AUTH = { username: "595", password: "595" };
const CURRENCIES = ["AZN", "USD", "EUR", "AED"];
const APP_INSTANCE_ID = uid();
const STARTUP_POSITIONING =
  "RunwayOS is a local-first money and execution cockpit for ambitious builders who need one place to manage cash, time, commitments, projects, notes, and growth experiments.";
const RATE_FALLBACK = {
  base: "USD",
  rates: { USD: 1, AZN: 1.7, EUR: 0.92, AED: 3.6725 },
  updated: "offline fallback",
  source: "fallback",
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const defaultState = () => ({
  version: 1,
  updatedAt: Date.now(),
  profile: {
    name: "Omar",
    baseCurrency: "USD",
    targetSavingPercent: 20,
    wakeTime: "08:00",
    sleepTime: "00:00",
    segment: "solo founder / student builder",
    northStar: "ship profitable projects without losing control of money or time",
  },
  rates: RATE_FALLBACK,
  budget: {
    wallets: [
      { id: uid(), name: "Cash", currency: "USD", balance: 0 },
      { id: uid(), name: "Savings", currency: "USD", balance: 0 },
    ],
    expenses: [],
    plans: [],
    goals: [],
  },
  routine: {
    tasks: [
      { id: uid(), title: "Morning reset", time: "08:30", priority: "high", doneOn: [] },
      { id: uid(), title: "Study or project block", time: "11:00", priority: "high", doneOn: [] },
      { id: uid(), title: "Evening review", time: "22:30", priority: "medium", doneOn: [] },
    ],
    deadlines: [],
    habits: [
      { id: uid(), title: "Drink water", target: "2L", history: [] },
      { id: uid(), title: "Move body", target: "20 min", history: [] },
      { id: uid(), title: "Read or learn", target: "30 min", history: [] },
    ],
    health: [],
    focus: [],
    reviews: [],
  },
  timer: {
    active: null,
    sessions: [],
  },
  projects: [],
  notes: [],
  startup: {
    mrr: 0,
    customers: 0,
    weeklyLeads: 0,
    conversionRate: 5,
    arpu: 19,
    runwayTargetMonths: 6,
    market: "AI personal finance + execution OS for Gen Z builders and solo operators",
    wedge: "multi-currency cash control plus project ROI and accountability",
  },
  growth: {
    experiments: [
      {
        id: uid(),
        title: "Invite 5 friends to use the tracker with you",
        channel: "referral",
        metric: "activated users",
        target: 5,
        current: 0,
        status: "planned",
        due: "",
        learning: "Manual invites prove whether shared accountability is real.",
      },
      {
        id: uid(),
        title: "Publish one build-in-public demo",
        channel: "content",
        metric: "waitlist signups",
        target: 20,
        current: 0,
        status: "running",
        due: "",
        learning: "Content should sell the pain: money leaks + time leaks.",
      },
    ],
  },
  trash: {
    notes: [],
  },
  friends: {
    room: "omar-595",
    collaborators: [],
    lastInvite: "",
  },
  settings: {
    notifications: false,
    github: { owner: "", repo: "", username: "", branch: "main" },
    remote: { enabled: false, endpoint: "", room: "omar-595", lastPulled: "" },
  },
});

let state = loadState();
let activeView = "overview";
let noteSearch = "";
let pendingInvite = null;
let dbPromise = null;
let channel = null;
let suppressBroadcast = false;

init();

function init() {
  parseInviteHash();
  setupAuth();
  setupBroadcast();
  bindEvents();
  setTodayLabel();
  if (isAuthed()) {
    showApp();
  }
  setInterval(tick, 1000);
  setInterval(checkAlerts, 30000);
  refreshRates(false);
}

function setupAuth() {
  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "").trim();
    if (username === AUTH.username && password === AUTH.password) {
      sessionStorage.setItem(SESSION_KEY, "yes");
      $("#loginError").textContent = "";
      showApp();
      return;
    }
    $("#loginError").textContent = "Wrong login.";
  });

  $("#logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    $("#appShell").classList.add("hidden");
    $("#authScreen").classList.remove("hidden");
  });
}

function isAuthed() {
  return sessionStorage.getItem(SESSION_KEY) === "yes";
}

function showApp() {
  $("#authScreen").classList.add("hidden");
  $("#appShell").classList.remove("hidden");
  render();
}

function setupBroadcast() {
  if (!("BroadcastChannel" in window)) return;
  channel = new BroadcastChannel("daily-command-center");
  channel.onmessage = (event) => {
    if (!event.data || event.data.type !== "state" || event.data.instanceId === APP_INSTANCE_ID || suppressBroadcast) return;
    const incoming = sanitizeState(event.data.state || {});
    if (incoming.updatedAt > state.updatedAt) {
      state = mergeStates(state, incoming);
      persist(false, { touch: false });
      render();
    }
  };
}

function bindEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);
  document.addEventListener("input", handleInput);
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("dragleave", handleDragLeave);
  document.addEventListener("drop", handleDrop);

  $("#notifyButton").addEventListener("click", requestNotifications);
  $("#exportButton").addEventListener("click", exportBackup);
  $("#importInput").addEventListener("change", importBackup);
}

function handleClick(event) {
  const nav = event.target.closest("[data-view]");
  if (nav) {
    setView(nav.dataset.view);
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;

  const { action: type, id, projectId } = action.dataset;
  if (type === "delete-expense") deleteExpense(id);
  if (type === "delete-wallet") removeById(state.budget.wallets, id);
  if (type === "delete-plan") removeById(state.budget.plans, id);
  if (type === "delete-goal") removeById(state.budget.goals, id);
  if (type === "toggle-task") toggleTask(id);
  if (type === "delete-task") removeById(state.routine.tasks, id);
  if (type === "toggle-habit") toggleHabit(id);
  if (type === "delete-habit") removeById(state.routine.habits, id);
  if (type === "done-focus") toggleFocus(id);
  if (type === "delete-focus") removeById(state.routine.focus, id);
  if (type === "delete-deadline") removeById(state.routine.deadlines, id);
  if (type === "complete-deadline") markDeadline(id);
  if (type === "start-timer") startTimer(projectId || id);
  if (type === "stop-timer") stopTimer();
  if (type === "delete-session") removeById(state.timer.sessions, id);
  if (type === "delete-project") deleteProject(id);
  if (type === "download-file") downloadFile(projectId, id);
  if (type === "delete-file") deleteProjectFile(projectId, id);
  if (type === "delete-note") deleteNote(id);
  if (type === "pin-note") toggleNotePin(id);
  if (type === "delete-experiment") removeById(state.growth.experiments, id);
  if (type === "toggle-experiment") cycleExperimentStatus(id);
  if (type === "copy-pitch") copyText(investorPitch());
  if (type === "delete-collaborator") removeById(state.friends.collaborators, id);
  if (type === "copy-invite") copyInvite();
  if (type === "export-backup") exportBackup();
  if (type === "accept-invite") acceptInvite();
  if (type === "clear-invite") {
    pendingInvite = null;
    render();
  }
  if (type === "refresh-rates") refreshRates(true);
  if (type === "copy-github-url") copyText(buildGithubIssueUrl(getDeadline(id)));
  if (type === "push-remote") pushRemote();
  if (type === "pull-remote") pullRemote();

  const persistedActions = new Set([
    "delete-expense",
    "delete-wallet",
    "delete-plan",
    "delete-goal",
    "toggle-task",
    "delete-task",
    "toggle-habit",
    "delete-habit",
    "done-focus",
    "delete-focus",
    "delete-deadline",
    "complete-deadline",
    "start-timer",
    "stop-timer",
    "delete-session",
    "delete-project",
    "delete-file",
    "delete-note",
    "pin-note",
    "delete-experiment",
    "toggle-experiment",
    "delete-collaborator",
  ]);
  if (persistedActions.has(type)) {
    persist();
    render();
  }
}

function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const type = form.dataset.form;

  if (type === "wallet") {
    state.budget.wallets.push({
      id: uid(),
      name: clean(data.get("name")),
      currency: clean(data.get("currency")),
      balance: toNumber(data.get("balance")),
    });
  }

  if (type === "expense") {
    const expense = {
      id: uid(),
      date: clean(data.get("date")) || todayISO(),
      what: clean(data.get("what")),
      amount: toNumber(data.get("amount")),
      currency: clean(data.get("currency")),
      category: clean(data.get("category")) || "General",
      walletId: clean(data.get("walletId")),
      note: clean(data.get("note")),
    };
    state.budget.expenses.unshift(expense);
    applyExpenseToWallet(expense);
  }

  if (type === "plan") {
    state.budget.plans.push({
      id: uid(),
      title: clean(data.get("title")),
      destination: clean(data.get("destination")),
      amount: toNumber(data.get("amount")),
      currency: clean(data.get("currency")),
      due: clean(data.get("due")),
    });
  }

  if (type === "goal") {
    state.budget.goals.push({
      id: uid(),
      title: clean(data.get("title")),
      target: toNumber(data.get("target")),
      saved: toNumber(data.get("saved")),
      currency: clean(data.get("currency")),
      due: clean(data.get("due")),
    });
  }

  if (type === "task") {
    state.routine.tasks.push({
      id: uid(),
      title: clean(data.get("title")),
      time: clean(data.get("time")),
      priority: clean(data.get("priority")),
      doneOn: [],
    });
  }

  if (type === "deadline") {
    state.routine.deadlines.push({
      id: uid(),
      title: clean(data.get("title")),
      due: clean(data.get("due")),
      priority: clean(data.get("priority")),
      reminder: toNumber(data.get("reminder")),
      status: "open",
      notified: false,
    });
  }

  if (type === "habit") {
    state.routine.habits.push({
      id: uid(),
      title: clean(data.get("title")),
      target: clean(data.get("target")),
      history: [],
    });
  }

  if (type === "health") {
    upsertHealth({
      date: clean(data.get("date")) || todayISO(),
      sleep: toNumber(data.get("sleep")),
      water: toNumber(data.get("water")),
      mood: clean(data.get("mood")),
      energy: toNumber(data.get("energy")),
      note: clean(data.get("note")),
    });
  }

  if (type === "focus") {
    state.routine.focus.push({
      id: uid(),
      title: clean(data.get("title")),
      date: clean(data.get("date")) || todayISO(),
      impact: clean(data.get("impact")),
      done: false,
    });
  }

  if (type === "review") {
    state.routine.reviews.unshift({
      id: uid(),
      week: clean(data.get("week")),
      wins: clean(data.get("wins")),
      fix: clean(data.get("fix")),
      score: toNumber(data.get("score")),
    });
  }

  if (type === "project") {
    state.projects.unshift({
      id: uid(),
      name: clean(data.get("name")),
      status: clean(data.get("status")),
      github: clean(data.get("github")),
      description: clean(data.get("description")),
      files: [],
      createdAt: new Date().toISOString(),
    });
  }

  if (type === "timer") {
    const projectId = clean(data.get("projectId"));
    if (projectId) startTimer(projectId, clean(data.get("task")));
  }

  if (type === "note") {
    state.notes.unshift({
      id: uid(),
      title: clean(data.get("title")),
      tags: clean(data.get("tags")),
      body: clean(data.get("body")),
      type: clean(data.get("type")) || "Decision",
      pinned: Boolean(data.get("pinned")),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (type === "startup") {
    state.profile.segment = clean(data.get("segment")) || state.profile.segment;
    state.profile.northStar = clean(data.get("northStar")) || state.profile.northStar;
    state.startup.mrr = toNumber(data.get("mrr"));
    state.startup.customers = toNumber(data.get("customers"));
    state.startup.weeklyLeads = toNumber(data.get("weeklyLeads"));
    state.startup.conversionRate = toNumber(data.get("conversionRate"));
    state.startup.arpu = toNumber(data.get("arpu"));
    state.startup.runwayTargetMonths = toNumber(data.get("runwayTargetMonths")) || 6;
    state.startup.market = clean(data.get("market")) || state.startup.market;
    state.startup.wedge = clean(data.get("wedge")) || state.startup.wedge;
  }

  if (type === "experiment") {
    state.growth.experiments.unshift({
      id: uid(),
      title: clean(data.get("title")),
      channel: clean(data.get("channel")),
      metric: clean(data.get("metric")),
      target: toNumber(data.get("target")),
      current: toNumber(data.get("current")),
      status: clean(data.get("status")) || "planned",
      due: clean(data.get("due")),
      learning: clean(data.get("learning")),
    });
  }

  if (type === "collaborator") {
    state.friends.collaborators.push({
      id: uid(),
      name: clean(data.get("name")),
      role: clean(data.get("role")),
      addedAt: new Date().toISOString(),
    });
  }

  if (type === "settings") {
    state.profile.name = clean(data.get("name")) || "Omar";
    state.profile.baseCurrency = clean(data.get("baseCurrency")) || "USD";
    state.profile.targetSavingPercent = toNumber(data.get("targetSavingPercent"));
    state.profile.wakeTime = clean(data.get("wakeTime")) || "08:00";
    state.profile.sleepTime = clean(data.get("sleepTime")) || "00:00";
    state.settings.github.owner = clean(data.get("githubOwner"));
    state.settings.github.repo = clean(data.get("githubRepo"));
    state.settings.github.username = clean(data.get("githubUsername"));
    state.settings.github.branch = clean(data.get("githubBranch")) || "main";
    state.settings.remote.endpoint = clean(data.get("remoteEndpoint"));
    state.settings.remote.room = clean(data.get("remoteRoom")) || "omar-595";
    state.settings.remote.enabled = Boolean(data.get("remoteEnabled"));
    state.friends.room = state.settings.remote.room;
  }

  form.reset();
  persist();
  render();
}

function handleChange(event) {
  const fileInput = event.target.closest("[data-file-project]");
  if (fileInput?.files?.length) {
    storeProjectFiles(fileInput.dataset.fileProject, Array.from(fileInput.files));
    fileInput.value = "";
  }
}

function handleInput(event) {
  if (event.target.matches("#noteSearch")) {
    noteSearch = event.target.value;
    renderNotes();
    renderIcons();
  }
}

function handleDragOver(event) {
  const drop = event.target.closest("[data-drop-project]");
  if (!drop) return;
  event.preventDefault();
  drop.classList.add("is-over");
}

function handleDragLeave(event) {
  const drop = event.target.closest("[data-drop-project]");
  if (drop) drop.classList.remove("is-over");
}

function handleDrop(event) {
  const drop = event.target.closest("[data-drop-project]");
  if (!drop) return;
  event.preventDefault();
  drop.classList.remove("is-over");
  if (event.dataTransfer.files.length) {
    storeProjectFiles(drop.dataset.dropProject, Array.from(event.dataTransfer.files));
  }
}

function setView(view) {
  activeView = view;
  $$(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("is-active", section.id === `${view}View`));
  $("#viewTitle").textContent = $(`#${view}View`)?.dataset.title || "Overview";
  render();
}

function render() {
  if (!isAuthed()) return;
  renderOverview();
  renderStrategy();
  renderBudget();
  renderRoutine();
  renderTimer();
  renderProjects();
  renderNotes();
  renderFriends();
  renderSettings();
  renderIcons();
}

function renderOverview() {
  const base = state.profile.baseCurrency;
  const totalWallets = state.budget.wallets.reduce((sum, wallet) => sum + convert(wallet.balance, wallet.currency, base), 0);
  const monthSpent = expensesThisMonth().reduce((sum, expense) => sum + convert(expense.amount, expense.currency, base), 0);
  const saved = state.budget.goals.reduce((sum, goal) => sum + convert(goal.saved, goal.currency, base), 0);
  const todayTasks = state.routine.tasks.filter((task) => !task.doneOn.includes(todayISO()));
  const upcoming = upcomingDeadlines().slice(0, 5);
  const activeTimer = state.timer.active ? getProject(state.timer.active.projectId) : null;
  const focus = state.routine.focus.filter((item) => item.date === todayISO());
  const score = investorScore();
  const runway = runwayMonths(totalWallets, monthSpent);
  const growth = growthSummary();

  $("#overviewView").innerHTML = `
    ${pendingInvite ? inviteBanner() : ""}
    <section class="hero-panel">
      <div>
        <p class="eyebrow">Founder command brief</p>
        <h3>${escapeHtml(STARTUP_POSITIONING)}</h3>
        <p>Current wedge: ${escapeHtml(state.startup.wedge)}. North star: ${escapeHtml(state.profile.northStar)}.</p>
      </div>
      <div class="hero-metrics">
        <span><strong>${score}</strong>Investor score</span>
        <span><strong>${runway}</strong>Runway months</span>
        <span><strong>${growth.active}</strong>Live experiments</span>
      </div>
    </section>
    <div class="grid four">
      ${statCard("Total money", formatMoney(totalWallets, base), `${state.budget.wallets.length} wallets`)}
      ${statCard("Spent this month", formatMoney(monthSpent, base), `${expensesThisMonth().length} entries`)}
      ${statCard("Saved", formatMoney(saved, base), `${state.budget.goals.length} goals`)}
      ${statCard("Focus time today", formatDuration(projectTimeForDate(todayISO())), activeTimer ? `Running: ${escapeHtml(activeTimer.name)}` : "No active timer")}
    </div>

    <div class="grid two">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Today</h3>
            <p>${escapeHtml(state.profile.name)}, ${todayTasks.length} routine items open.</p>
          </div>
          <button class="secondary-btn" data-view="routine" type="button"><i data-lucide="calendar-check"></i>Routine</button>
        </div>
        <div class="list">
          ${todayTasks.slice(0, 6).map(taskRow).join("") || empty("Today is clear. Keep it that way.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Deadlines</h3>
            <p>Browser alerts and GitHub issue links sit here.</p>
          </div>
          <button class="secondary-btn" data-view="routine" type="button"><i data-lucide="plus"></i>Add</button>
        </div>
        <div class="list">
          ${upcoming.map(deadlineRow).join("") || empty("No deadlines loaded.")}
        </div>
      </section>
    </div>

    <div class="grid two">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Top 3</h3>
            <p>Mandatory priority board for the day.</p>
          </div>
        </div>
        <div class="list">
          ${focus.map(focusRow).join("") || empty("Add 1-3 focus items in Routine.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Rates</h3>
            <p>${escapeHtml(state.rates.updated || "Not updated yet")}</p>
          </div>
          <button class="secondary-btn" data-action="refresh-rates" type="button"><i data-lucide="refresh-cw"></i>Refresh</button>
        </div>
        <div class="pill-row">
          ${CURRENCIES.map((currency) => `<span class="currency-pill">1 USD = ${formatNumber(state.rates.rates[currency] || 0)} ${currency}</span>`).join("")}
        </div>
        <p class="rate-source"><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates by Exchange Rate API</a></p>
      </section>
    </div>
  `;
}

function renderStrategy() {
  const base = state.profile.baseCurrency;
  const totalWallets = state.budget.wallets.reduce((sum, wallet) => sum + convert(wallet.balance, wallet.currency, base), 0);
  const monthSpent = expensesThisMonth().reduce((sum, expense) => sum + convert(expense.amount, expense.currency, base), 0);
  const score = investorScore();
  const growth = growthSummary();
  const warnings = investorWarnings(totalWallets, monthSpent);

  $("#strategyView").innerHTML = `
    <section class="hero-panel">
      <div>
        <p class="eyebrow">Venture-scale repositioning</p>
        <h3>From budget tracker to RunwayOS: the money-and-execution layer for builders.</h3>
        <p>Investors will not fund a generic habit app. They might fund a trusted operating system that links cash, time, projects, decisions, and growth into compounding personal data.</p>
      </div>
      <div class="hero-metrics">
        <span><strong>${score}/100</strong>fundability</span>
        <span><strong>${formatMoney(state.startup.mrr, base)}</strong>MRR</span>
        <span><strong>${growth.progress}%</strong>experiment progress</span>
      </div>
    </section>

    <div class="grid three">
      ${statCard("Runway", `${runwayMonths(totalWallets, monthSpent)} mo`, `${formatMoney(totalWallets, base)} available`)}
      ${statCard("Customers", String(state.startup.customers), `${state.startup.weeklyLeads} leads / week`)}
      ${statCard("ARPU", formatMoney(state.startup.arpu, base), `${state.startup.conversionRate}% conversion target`)}
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Investor Readiness</h3>
          <p>What would stop a serious seed investor today.</p>
        </div>
        <button class="secondary-btn" data-action="copy-pitch" type="button"><i data-lucide="copy"></i>Copy pitch</button>
      </div>
      <div class="grid three">
        ${warnings.map((warning) => `<article class="warning-card"><strong>${escapeHtml(warning.title)}</strong><p>${escapeHtml(warning.detail)}</p><span>${escapeHtml(warning.fix)}</span></article>`).join("")}
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Startup Settings</h3>
          <p>Make the product legible as a company, not a side project.</p>
        </div>
      </div>
      <form class="form-grid" data-form="startup">
        <label class="wide">Target user <input name="segment" value="${escapeAttr(state.profile.segment)}" /></label>
        <label class="wide">North star <input name="northStar" value="${escapeAttr(state.profile.northStar)}" /></label>
        <label>MRR <input name="mrr" type="text" inputmode="decimal" value="${state.startup.mrr}" /></label>
        <label>Customers <input name="customers" type="text" inputmode="numeric" value="${state.startup.customers}" /></label>
        <label>Weekly leads <input name="weeklyLeads" type="text" inputmode="numeric" value="${state.startup.weeklyLeads}" /></label>
        <label>Conversion % <input name="conversionRate" type="text" inputmode="decimal" value="${state.startup.conversionRate}" /></label>
        <label>ARPU <input name="arpu" type="text" inputmode="decimal" value="${state.startup.arpu}" /></label>
        <label>Runway target <input name="runwayTargetMonths" type="text" inputmode="numeric" value="${state.startup.runwayTargetMonths}" /></label>
        <label class="wide">Market <input name="market" value="${escapeAttr(state.startup.market)}" /></label>
        <label class="wide">Wedge <input name="wedge" value="${escapeAttr(state.startup.wedge)}" /></label>
        <button class="primary-btn" type="submit"><i data-lucide="save"></i>Save strategy</button>
      </form>
    </section>

    <div class="grid two">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Growth Experiments</h3>
            <p>Retention and virality are not wishes. Track them like product work.</p>
          </div>
        </div>
        <form class="form-grid" data-form="experiment">
          <label class="wide">Experiment <input name="title" placeholder="Launch TikTok demo, referral challenge, student waitlist" required /></label>
          <label>Channel
            <select name="channel"><option>referral</option><option>content</option><option>campus</option><option>creator</option><option>community</option><option>paid</option></select>
          </label>
          <label>Metric <input name="metric" placeholder="activated users" /></label>
          <label>Target <input name="target" type="text" inputmode="numeric" value="10" /></label>
          <label>Current <input name="current" type="text" inputmode="numeric" value="0" /></label>
          <label>Status
            <select name="status"><option>planned</option><option>running</option><option>won</option><option>lost</option></select>
          </label>
          <label>Due <input name="due" type="date" /></label>
          <label class="full">Learning <input name="learning" placeholder="What must be true for this to work?" /></label>
          <button class="primary-btn" type="submit"><i data-lucide="flask-conical"></i>Add experiment</button>
        </form>
        <div class="list">
          ${state.growth.experiments.map(experimentRow).join("") || empty("No growth experiments yet.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Pricing & Monetization</h3>
            <p>Stop thinking free tracker. Think prosumer wedge, then team expansion.</p>
          </div>
        </div>
        <table class="compact-table">
          <thead><tr><th>Plan</th><th>Price</th><th>Who pays</th></tr></thead>
          <tbody>
            <tr><td>Starter</td><td>$9/mo</td><td>students and solo builders</td></tr>
            <tr><td>Pro</td><td>$19/mo</td><td>creators, freelancers, indie hackers</td></tr>
            <tr><td>Team</td><td>$12/user/mo</td><td>small creator teams and clubs</td></tr>
            <tr><td>Campus</td><td>$2-4/user/mo</td><td>schools, bootcamps, accelerators</td></tr>
          </tbody>
        </table>
        <div class="list">
          ${strategicRoadmap().map((item) => `<article class="list-row"><div><h4>${escapeHtml(item.title)}</h4><p class="muted">${escapeHtml(item.body)}</p></div><span class="pill">${escapeHtml(item.when)}</span></article>`).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderBudget() {
  const base = state.profile.baseCurrency;
  const walletOptions = state.budget.wallets.map((wallet) => `<option value="${wallet.id}">${escapeHtml(wallet.name)} (${wallet.currency})</option>`).join("");
  const totalWallets = state.budget.wallets.reduce((sum, wallet) => sum + convert(wallet.balance, wallet.currency, base), 0);
  const planned = state.budget.plans.reduce((sum, plan) => sum + convert(plan.amount, plan.currency, base), 0);
  const goalsTarget = state.budget.goals.reduce((sum, goal) => sum + convert(goal.target, goal.currency, base), 0);
  const saved = state.budget.goals.reduce((sum, goal) => sum + convert(goal.saved, goal.currency, base), 0);

  $("#budgetView").innerHTML = `
    <div class="grid four">
      ${statCard("Available", formatMoney(totalWallets, base), "All wallets")}
      ${statCard("Planned", formatMoney(planned, base), "Where money should go")}
      ${statCard("Goal progress", `${percent(saved, goalsTarget)}%`, `${formatMoney(saved, base)} saved`)}
      ${statCard("This month", formatMoney(expensesThisMonth().reduce((s, e) => s + convert(e.amount, e.currency, base), 0), base), "Spent")}
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Wallets</h3>
          <p>AZN, USD, EUR, and AED all convert into your base currency.</p>
        </div>
      </div>
      <form class="form-grid" data-form="wallet">
        <label class="wide">Wallet name <input name="name" placeholder="Cash, card, savings" required /></label>
        <label>Currency ${currencySelect("currency")}</label>
        <label>Balance <input name="balance" type="text" inputmode="decimal" required /></label>
        <button class="primary-btn" type="submit"><i data-lucide="plus"></i>Add wallet</button>
      </form>
      <div class="grid three">
        ${state.budget.wallets.map(walletCard).join("") || empty("No wallets yet.")}
      </div>
    </section>

    <div class="grid two">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Spending</h3>
            <p>Track what was spent, on what, how much, and from where.</p>
          </div>
        </div>
        <form class="form-grid" data-form="expense">
          <label>Date <input name="date" type="date" value="${todayISO()}" /></label>
          <label class="wide">Spent on <input name="what" placeholder="Food, taxi, software" required /></label>
          <label>Amount <input name="amount" type="text" inputmode="decimal" required /></label>
          <label>Currency ${currencySelect("currency")}</label>
          <label>Category <input name="category" placeholder="Life, work, bills" /></label>
          <label class="wide">Wallet <select name="walletId">${walletOptions}</select></label>
          <label class="full">Note <input name="note" placeholder="Optional detail" /></label>
          <button class="primary-btn" type="submit"><i data-lucide="receipt"></i>Save spend</button>
        </form>
        <div class="list">
          ${state.budget.expenses.slice(0, 8).map(expenseRow).join("") || empty("No spending logged.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Money Plan</h3>
            <p>Decide where to put money before it disappears.</p>
          </div>
        </div>
        <form class="form-grid" data-form="plan">
          <label class="wide">Plan <input name="title" placeholder="Put salary into emergency fund" required /></label>
          <label>Destination
            <select name="destination">
              <option>Save</option><option>Invest</option><option>Spend</option><option>Emergency</option><option>Project</option>
            </select>
          </label>
          <label>Amount <input name="amount" type="text" inputmode="decimal" required /></label>
          <label>Currency ${currencySelect("currency")}</label>
          <label>Due <input name="due" type="date" /></label>
          <button class="primary-btn" type="submit"><i data-lucide="route"></i>Add plan</button>
        </form>
        <div class="list">
          ${state.budget.plans.map(planRow).join("") || empty("No money plan yet.")}
        </div>
      </section>
    </div>

    <div class="grid two">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Savings Goals</h3>
            <p>Targets, deadlines, and current saved amount.</p>
          </div>
        </div>
        <form class="form-grid" data-form="goal">
          <label class="wide">Goal <input name="title" placeholder="Laptop, emergency fund, trip" required /></label>
          <label>Target <input name="target" type="text" inputmode="decimal" required /></label>
          <label>Saved <input name="saved" type="text" inputmode="decimal" value="0" /></label>
          <label>Currency ${currencySelect("currency")}</label>
          <label>Due <input name="due" type="date" /></label>
          <button class="primary-btn" type="submit"><i data-lucide="badge-dollar-sign"></i>Add goal</button>
        </form>
        <div class="list">
          ${state.budget.goals.map(goalRow).join("") || empty("No savings goals yet.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Converter</h3>
            <p>Live rates from the web when online.</p>
          </div>
          <button class="secondary-btn" data-action="refresh-rates" type="button"><i data-lucide="refresh-cw"></i>Rates</button>
        </div>
        <div class="grid two">
          ${CURRENCIES.map((from) => CURRENCIES.filter((to) => to !== from).slice(0, 1).map((to) => rateCard(from, to)).join("")).join("")}
        </div>
        <p class="rate-source"><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates by Exchange Rate API</a></p>
      </section>
    </div>
  `;
}

function renderRoutine() {
  const todayHealth = state.routine.health.find((item) => item.date === todayISO());
  $("#routineView").innerHTML = `
    <div class="routine-grid">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Schedule</h3>
            <p>What to do and when.</p>
          </div>
        </div>
        <form class="form-grid" data-form="task">
          <label class="wide">Task <input name="title" placeholder="Study, gym, call, clean" required /></label>
          <label>Time <input name="time" type="time" required /></label>
          <label>Priority
            <select name="priority"><option>high</option><option>medium</option><option>low</option></select>
          </label>
          <button class="primary-btn" type="submit"><i data-lucide="plus"></i>Add task</button>
        </form>
        <div class="list">
          ${state.routine.tasks.slice().sort((a, b) => a.time.localeCompare(b.time)).map(taskRow).join("") || empty("No routine tasks yet.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Deadlines</h3>
            <p>Browser alerts plus GitHub issue drafts.</p>
          </div>
        </div>
        <form class="form-grid" data-form="deadline">
          <label class="wide">Deadline <input name="title" placeholder="Submit project, pay bill" required /></label>
          <label>Due <input name="due" type="datetime-local" required /></label>
          <label>Priority
            <select name="priority"><option>high</option><option>medium</option><option>low</option></select>
          </label>
          <label>Alert before
            <select name="reminder"><option value="15">15 min</option><option value="60">1 hour</option><option value="1440">1 day</option></select>
          </label>
          <button class="primary-btn" type="submit"><i data-lucide="alarm-clock"></i>Add alert</button>
        </form>
        <div class="list">
          ${state.routine.deadlines.slice().sort((a, b) => new Date(a.due) - new Date(b.due)).map(deadlineRow).join("") || empty("No deadlines yet.")}
        </div>
      </section>
    </div>

    <div class="grid three">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Habits</h3>
            <p>Useful extra 1: streaks for repeatable discipline.</p>
          </div>
        </div>
        <form class="form-grid" data-form="habit">
          <label class="wide">Habit <input name="title" placeholder="Workout, code, meditate" required /></label>
          <label>Target <input name="target" placeholder="30 min" /></label>
          <button class="primary-btn" type="submit"><i data-lucide="flame"></i>Add</button>
        </form>
        <div class="list">
          ${state.routine.habits.map(habitRow).join("") || empty("No habits yet.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Health Check</h3>
            <p>Useful extra 2: sleep, water, mood, energy.</p>
          </div>
        </div>
        <form class="form-grid" data-form="health">
          <label>Date <input name="date" type="date" value="${todayISO()}" /></label>
          <label>Sleep <input name="sleep" type="text" inputmode="decimal" value="${todayHealth?.sleep || ""}" placeholder="hours" /></label>
          <label>Water <input name="water" type="text" inputmode="decimal" value="${todayHealth?.water || ""}" placeholder="liters" /></label>
          <label>Mood
            <select name="mood">
              ${["Sharp", "Good", "Tired", "Stressed", "Low"].map((mood) => `<option ${todayHealth?.mood === mood ? "selected" : ""}>${mood}</option>`).join("")}
            </select>
          </label>
          <label>Energy <input name="energy" type="text" inputmode="numeric" value="${todayHealth?.energy || ""}" /></label>
          <label class="wide">Note <input name="note" value="${escapeAttr(todayHealth?.note || "")}" /></label>
          <button class="primary-btn" type="submit"><i data-lucide="heart-pulse"></i>Save</button>
        </form>
        <div class="list">
          ${state.routine.health.slice(0, 5).map(healthRow).join("") || empty("No health logs yet.")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Top 3 Priorities</h3>
            <p>Useful extra 3: focus before random tasks.</p>
          </div>
        </div>
        <form class="form-grid" data-form="focus">
          <label>Date <input name="date" type="date" value="${todayISO()}" /></label>
          <label class="wide">Priority <input name="title" placeholder="The thing that matters" required /></label>
          <label>Impact
            <select name="impact"><option>high</option><option>medium</option><option>low</option></select>
          </label>
          <button class="primary-btn" type="submit"><i data-lucide="target"></i>Add</button>
        </form>
        <div class="list">
          ${state.routine.focus.slice(0, 8).map(focusRow).join("") || empty("No focus items yet.")}
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Weekly Review</h3>
          <p>Useful extra 4: quick review so you can adjust instead of drifting.</p>
        </div>
      </div>
      <form class="form-grid" data-form="review">
        <label>Week <input name="week" type="week" required /></label>
        <label class="wide">Wins <input name="wins" placeholder="What worked?" /></label>
        <label class="wide">Fix next <input name="fix" placeholder="What needs changing?" /></label>
        <label>Score <input name="score" type="text" inputmode="numeric" value="7" /></label>
        <button class="primary-btn" type="submit"><i data-lucide="clipboard-check"></i>Save review</button>
      </form>
      <div class="list">
        ${state.routine.reviews.slice(0, 4).map(reviewRow).join("") || empty("No reviews yet.")}
      </div>
    </section>
  `;
}

function renderTimer() {
  const active = state.timer.active;
  const projects = state.projects;
  const projectOptions = projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("");
  const activeProject = active ? getProject(active.projectId) : null;
  $("#timerView").innerHTML = `
    <div class="grid two">
      <section class="panel">
        <div class="timer-face">
          <div>
            <div class="timer-time" id="timerClock">${formatDuration(active ? Date.now() - active.startedAt : 0)}</div>
            <p class="timer-sub">${activeProject ? `${escapeHtml(activeProject.name)}: ${escapeHtml(active.task || "Work session")}` : "No running timer"}</p>
          </div>
        </div>
        <form class="form-grid" data-form="timer">
          <label class="wide">Project
            <select name="projectId" ${projects.length ? "" : "disabled"}>${projectOptions}</select>
          </label>
          <label class="wide">Work name <input name="task" placeholder="Design, coding, edit, research" /></label>
          <button class="primary-btn" type="submit" ${active || !projects.length ? "disabled" : ""}><i data-lucide="play"></i>Start</button>
          <button class="danger-btn" data-action="stop-timer" type="button" ${active ? "" : "disabled"}><i data-lucide="square"></i>Stop</button>
        </form>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Time Totals</h3>
            <p>Useful extra 5: daily time accounting by project.</p>
          </div>
        </div>
        <div class="grid two">
          ${statCard("Today", formatDuration(projectTimeForDate(todayISO()) + (active ? Date.now() - active.startedAt : 0)), "All projects")}
          ${statCard("All time", formatDuration(totalProjectTime() + (active ? Date.now() - active.startedAt : 0)), `${state.timer.sessions.length} saved sessions`)}
        </div>
        <div class="list">
          ${projectTimeRows()}
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Sessions</h3>
          <p>Stop saves the time. Refresh keeps a running timer alive.</p>
        </div>
      </div>
      <div class="list">
        ${state.timer.sessions.slice(0, 12).map(sessionRow).join("") || empty("No saved sessions yet.")}
      </div>
    </section>
  `;
}

function renderProjects() {
  const uploadUrl = buildGithubUploadUrl();
  $("#projectsView").innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Projects</h3>
          <p>Store work, links, files, and time logs in one place.</p>
        </div>
        ${uploadUrl ? `<a class="secondary-btn" href="${uploadUrl}" target="_blank" rel="noreferrer"><i data-lucide="github"></i>Upload to GitHub</a>` : ""}
      </div>
      <form class="form-grid" data-form="project">
        <label class="wide">Project name <input name="name" placeholder="Website, client edit, app idea" required /></label>
        <label>Status
          <select name="status"><option>active</option><option>waiting</option><option>done</option><option>paused</option></select>
        </label>
        <label class="wide">GitHub / live link <input name="github" placeholder="https://github.com/..." /></label>
        <label class="full">Description <textarea name="description" placeholder="What this project is and what needs to happen next"></textarea></label>
        <button class="primary-btn" type="submit"><i data-lucide="folder-plus"></i>Add project</button>
      </form>
    </section>

    <div class="grid two">
      ${state.projects.map(projectCard).join("") || empty("No projects yet. Add one, then the timer can track it.")}
    </div>
  `;
}

function renderNotes() {
  const notes = state.notes
    .filter((note) => {
      const text = `${note.title} ${note.tags} ${note.body}`.toLowerCase();
      return text.includes(noteSearch.toLowerCase());
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt) - new Date(a.updatedAt));

  $("#notesView").innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Notes</h3>
          <p>Decision log, customer notes, risks, ideas, and proof that the product is learning.</p>
        </div>
      </div>
      <form class="form-grid" data-form="note">
        <label class="wide">Title <input name="title" required /></label>
        <label>Type
          <select name="type"><option>Decision</option><option>Customer</option><option>Risk</option><option>Idea</option><option>Meeting</option><option>Metric</option></select>
        </label>
        <label>Tags <input name="tags" placeholder="life, money, project" /></label>
        <label class="full">Body <textarea name="body" required></textarea></label>
        <label class="checkline"><input name="pinned" type="checkbox" /> Pin note</label>
        <button class="primary-btn" type="submit"><i data-lucide="notebook-pen"></i>Save note</button>
      </form>
    </section>

    <div class="search-row">
      <input id="noteSearch" placeholder="Search notes" value="${escapeAttr(noteSearch)}" />
      <span class="pill">${notes.length} notes saved locally</span>
    </div>

    <div class="grid three">
      ${notes.map(noteCard).join("") || empty("No notes match.")}
    </div>
  `;
}

function renderFriends() {
  const invite = createInviteLink();
  state.friends.lastInvite = invite;
  $("#friendsView").innerHTML = `
    <div class="grid two">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Invite</h3>
            <p>Share a locked snapshot link. Real-time local tabs sync automatically.</p>
          </div>
          <button class="secondary-btn" data-action="copy-invite" type="button"><i data-lucide="copy"></i>Copy link</button>
        </div>
        <input readonly value="${escapeAttr(invite)}" />
        <div class="pill-row">
          <span class="pill">Room ${escapeHtml(state.friends.room)}</span>
          <span class="pill">${state.friends.collaborators.length} friends</span>
          <span class="pill">${state.settings.remote.enabled ? "Remote sync on" : "Remote sync off"}</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Friends</h3>
            <p>Add people who should know the login.</p>
          </div>
        </div>
        <form class="form-grid" data-form="collaborator">
          <label class="wide">Name <input name="name" required /></label>
          <label>Role <input name="role" placeholder="viewer, friend, teammate" /></label>
          <button class="primary-btn" type="submit"><i data-lucide="user-plus"></i>Add</button>
        </form>
        <div class="list">
          ${state.friends.collaborators.map(collaboratorRow).join("") || empty("No friends added.")}
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Remote Sync</h3>
          <p>Optional JSON endpoint for cross-device shared state.</p>
        </div>
        <div class="row-actions">
          <button class="secondary-btn" data-action="pull-remote" type="button"><i data-lucide="cloud-download"></i>Pull</button>
          <button class="primary-btn" data-action="push-remote" type="button"><i data-lucide="cloud-upload"></i>Push</button>
        </div>
      </div>
      <div class="pill-row">
        <span class="pill">Endpoint ${state.settings.remote.endpoint ? "set" : "missing"}</span>
        <span class="pill">Last pull ${escapeHtml(state.settings.remote.lastPulled || "never")}</span>
      </div>
    </section>
  `;
}

function renderSettings() {
  $("#settingsView").innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Settings</h3>
          <p>Base currency, GitHub issue links, notifications, and backup.</p>
        </div>
      </div>
      <form class="form-grid" data-form="settings">
        <label>Name <input name="name" value="${escapeAttr(state.profile.name)}" /></label>
        <label>Base currency ${currencySelect("baseCurrency", state.profile.baseCurrency)}</label>
        <label>Save target % <input name="targetSavingPercent" type="text" inputmode="numeric" value="${state.profile.targetSavingPercent}" /></label>
        <label>Wake time <input name="wakeTime" type="time" value="${escapeAttr(state.profile.wakeTime)}" /></label>
        <label>Sleep time <input name="sleepTime" type="time" value="${escapeAttr(state.profile.sleepTime)}" /></label>
        <label>GitHub owner <input name="githubOwner" value="${escapeAttr(state.settings.github.owner)}" placeholder="username or org" /></label>
        <label>GitHub repo <input name="githubRepo" value="${escapeAttr(state.settings.github.repo)}" placeholder="repo name" /></label>
        <label>GitHub username <input name="githubUsername" value="${escapeAttr(state.settings.github.username)}" placeholder="assignee" /></label>
        <label>GitHub branch <input name="githubBranch" value="${escapeAttr(state.settings.github.branch)}" /></label>
        <label class="wide">Remote JSON endpoint <input name="remoteEndpoint" value="${escapeAttr(state.settings.remote.endpoint)}" placeholder="https://.../rooms" /></label>
        <label>Remote room <input name="remoteRoom" value="${escapeAttr(state.settings.remote.room)}" /></label>
        <label class="checkline"><input name="remoteEnabled" type="checkbox" ${state.settings.remote.enabled ? "checked" : ""} /> Remote sync</label>
        <button class="primary-btn" type="submit"><i data-lucide="save"></i>Save settings</button>
      </form>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Backup</h3>
          <p>Useful extra 5: export/import so the tracker does not vanish.</p>
        </div>
      </div>
      <div class="row-actions">
        <button class="secondary-btn" data-action="export-backup" type="button"><i data-lucide="download"></i>Export JSON</button>
        <label class="secondary-btn file-label" for="importInput">
          <i data-lucide="upload"></i>Import JSON
        </label>
      </div>
    </section>
  `;
}

function statCard(label, value, sub) {
  return `<article class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(sub)}</small></article>`;
}

function walletCard(wallet) {
  const base = state.profile.baseCurrency;
  return `
    <article class="project-card">
      <header>
        <div>
          <h4>${escapeHtml(wallet.name)}</h4>
          <p class="muted">${formatMoney(convert(wallet.balance, wallet.currency, base), base)}</p>
        </div>
        <span class="pill">${wallet.currency}</span>
      </header>
      <strong>${formatMoney(wallet.balance, wallet.currency)}</strong>
      <button class="ghost-btn" data-action="delete-wallet" data-id="${wallet.id}" type="button"><i data-lucide="trash-2"></i>Delete</button>
    </article>
  `;
}

function expenseRow(expense) {
  return `
    <article class="list-row">
      <div>
        <div class="row-head">
          <h4>${escapeHtml(expense.what)}</h4>
          <strong class="money-negative">-${formatMoney(expense.amount, expense.currency)}</strong>
        </div>
        <div class="pill-row">
          <span class="pill">${escapeHtml(expense.date)}</span>
          <span class="pill">${escapeHtml(expense.category)}</span>
          ${expense.note ? `<span class="pill">${escapeHtml(expense.note)}</span>` : ""}
        </div>
      </div>
      <button class="ghost-btn" data-action="delete-expense" data-id="${expense.id}" type="button"><i data-lucide="trash-2"></i></button>
    </article>
  `;
}

function planRow(plan) {
  return `
    <article class="list-row">
      <div>
        <h4>${escapeHtml(plan.title)}</h4>
        <div class="pill-row">
          <span class="pill">${escapeHtml(plan.destination)}</span>
          <span class="pill">${formatMoney(plan.amount, plan.currency)}</span>
          ${plan.due ? `<span class="pill">${escapeHtml(plan.due)}</span>` : ""}
        </div>
      </div>
      <button class="ghost-btn" data-action="delete-plan" data-id="${plan.id}" type="button"><i data-lucide="trash-2"></i></button>
    </article>
  `;
}

function goalRow(goal) {
  const value = percent(goal.saved, goal.target);
  return `
    <article class="list-row">
      <div>
        <div class="row-head">
          <h4>${escapeHtml(goal.title)}</h4>
          <strong>${value}%</strong>
        </div>
        <div class="progress" aria-label="${value}% saved"><span style="--value:${Math.min(value, 100)}%"></span></div>
        <div class="pill-row">
          <span class="pill">${formatMoney(goal.saved, goal.currency)} / ${formatMoney(goal.target, goal.currency)}</span>
          ${goal.due ? `<span class="pill">${escapeHtml(goal.due)}</span>` : ""}
        </div>
      </div>
      <button class="ghost-btn" data-action="delete-goal" data-id="${goal.id}" type="button"><i data-lucide="trash-2"></i></button>
    </article>
  `;
}

function rateCard(from, to) {
  return `
    <article class="stat">
      <span>${from} to ${to}</span>
      <strong>${formatNumber(convert(1, from, to))}</strong>
      <small>1 ${from}</small>
    </article>
  `;
}

function taskRow(task) {
  const done = task.doneOn.includes(todayISO());
  return `
    <article class="list-row ${task.priority === "high" ? "priority-band" : ""}">
      <div class="checkline">
        <input type="checkbox" ${done ? "checked" : ""} data-action="toggle-task" data-id="${task.id}" />
        <div>
          <h4>${escapeHtml(task.title)}</h4>
          <div class="pill-row">
            <span class="pill">${escapeHtml(task.time || "Anytime")}</span>
            <span class="status-pill ${priorityClass(task.priority)}">${escapeHtml(task.priority)}</span>
          </div>
        </div>
      </div>
      <button class="ghost-btn" data-action="delete-task" data-id="${task.id}" type="button"><i data-lucide="trash-2"></i></button>
    </article>
  `;
}

function deadlineRow(deadline) {
  const due = deadline.due ? new Date(deadline.due) : null;
  const overdue = due && due < new Date() && deadline.status !== "done";
  const issueUrl = buildGithubIssueUrl(deadline);
  return `
    <article class="list-row ${deadline.priority === "high" ? "priority-band" : ""}">
      <div>
        <div class="row-head">
          <h4>${escapeHtml(deadline.title)}</h4>
          <span class="status-pill ${deadline.status === "done" ? "done" : overdue ? "danger" : "warn"}">${deadline.status === "done" ? "done" : overdue ? "overdue" : "open"}</span>
        </div>
        <div class="pill-row">
          <span class="pill">${due ? due.toLocaleString() : "No date"}</span>
          <span class="pill">${escapeHtml(deadline.priority)}</span>
          <span class="pill">alert ${deadline.reminder || 15} min</span>
        </div>
      </div>
      <div class="row-actions">
        ${issueUrl ? `<a class="secondary-btn" href="${issueUrl}" target="_blank" rel="noreferrer"><i data-lucide="github"></i>Issue</a>` : ""}
        <button class="secondary-btn" data-action="complete-deadline" data-id="${deadline.id}" type="button"><i data-lucide="check"></i></button>
        <button class="ghost-btn" data-action="delete-deadline" data-id="${deadline.id}" type="button"><i data-lucide="trash-2"></i></button>
      </div>
    </article>
  `;
}

function habitRow(habit) {
  const done = habit.history.includes(todayISO());
  return `
    <article class="list-row">
      <div class="checkline">
        <input type="checkbox" ${done ? "checked" : ""} data-action="toggle-habit" data-id="${habit.id}" />
        <div>
          <h4>${escapeHtml(habit.title)}</h4>
          <div class="pill-row">
            <span class="pill">${escapeHtml(habit.target || "daily")}</span>
            <span class="pill">${habitStreak(habit)} day streak</span>
          </div>
        </div>
      </div>
      <button class="ghost-btn" data-action="delete-habit" data-id="${habit.id}" type="button"><i data-lucide="trash-2"></i></button>
    </article>
  `;
}

function healthRow(item) {
  return `
    <article class="list-row">
      <div>
        <h4>${escapeHtml(item.date)}</h4>
        <div class="pill-row">
          <span class="pill">${item.sleep || 0}h sleep</span>
          <span class="pill">${item.water || 0}L water</span>
          <span class="pill">${escapeHtml(item.mood || "Mood")}</span>
          <span class="pill">${item.energy || 0}/10 energy</span>
        </div>
      </div>
    </article>
  `;
}

function focusRow(item) {
  return `
    <article class="list-row ${item.impact === "high" ? "priority-band" : ""}">
      <div class="checkline">
        <input type="checkbox" ${item.done ? "checked" : ""} data-action="done-focus" data-id="${item.id}" />
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          <div class="pill-row"><span class="pill">${escapeHtml(item.date)}</span><span class="pill">${escapeHtml(item.impact)}</span></div>
        </div>
      </div>
      <button class="ghost-btn" data-action="delete-focus" data-id="${item.id}" type="button"><i data-lucide="trash-2"></i></button>
    </article>
  `;
}

function reviewRow(review) {
  return `
    <article class="list-row">
      <div>
        <div class="row-head"><h4>${escapeHtml(review.week)}</h4><strong>${review.score}/10</strong></div>
        <p class="muted">${escapeHtml(review.wins || "No wins written.")}</p>
        <p class="muted">${escapeHtml(review.fix || "No fix written.")}</p>
      </div>
    </article>
  `;
}

function projectCard(project) {
  const sessions = state.timer.sessions.filter((session) => session.projectId === project.id);
  const total = sessions.reduce((sum, session) => sum + session.duration, 0);
  const files = project.files || [];
  return `
    <article class="project-card">
      <header>
        <div>
          <h3>${escapeHtml(project.name)}</h3>
          <p class="muted">${escapeHtml(project.description || "No description.")}</p>
        </div>
        <span class="status-pill ${project.status === "done" ? "done" : project.status === "active" ? "warn" : ""}">${escapeHtml(project.status)}</span>
      </header>
      <div class="pill-row">
        <span class="pill">${formatDuration(total)}</span>
        <span class="pill">${files.length} files</span>
        ${project.github ? `<a class="pill" href="${escapeAttr(project.github)}" target="_blank" rel="noreferrer">GitHub</a>` : ""}
      </div>
      <div class="row-actions">
        <button class="primary-btn" data-action="start-timer" data-project-id="${project.id}" type="button" ${state.timer.active ? "disabled" : ""}><i data-lucide="play"></i>Timer</button>
        <label class="secondary-btn file-label"><i data-lucide="upload"></i>Files<input data-file-project="${project.id}" type="file" multiple /></label>
        <button class="ghost-btn" data-action="delete-project" data-id="${project.id}" type="button"><i data-lucide="trash-2"></i></button>
      </div>
      <div class="file-drop" data-drop-project="${project.id}">Drop project files here</div>
      <div class="list">
        ${files.map((file) => fileRow(project.id, file)).join("") || ""}
      </div>
    </article>
  `;
}

function fileRow(projectId, file) {
  return `
    <article class="list-row">
      <div>
        <h4>${escapeHtml(file.name)}</h4>
        <div class="pill-row"><span class="pill">${formatBytes(file.size)}</span><span class="pill">${escapeHtml(file.type || "file")}</span></div>
      </div>
      <div class="row-actions">
        <button class="secondary-btn" data-action="download-file" data-project-id="${projectId}" data-id="${file.id}" type="button"><i data-lucide="download"></i></button>
        <button class="ghost-btn" data-action="delete-file" data-project-id="${projectId}" data-id="${file.id}" type="button"><i data-lucide="trash-2"></i></button>
      </div>
    </article>
  `;
}

function sessionRow(session) {
  const project = getProject(session.projectId);
  return `
    <article class="list-row">
      <div>
        <div class="row-head">
          <h4>${escapeHtml(project?.name || "Deleted project")}</h4>
          <strong>${formatDuration(session.duration)}</strong>
        </div>
        <div class="pill-row">
          <span class="pill">${escapeHtml(session.task || "Work session")}</span>
          <span class="pill">${new Date(session.start).toLocaleString()}</span>
        </div>
      </div>
      <button class="ghost-btn" data-action="delete-session" data-id="${session.id}" type="button"><i data-lucide="trash-2"></i></button>
    </article>
  `;
}

function noteCard(note) {
  return `
    <article class="note-card">
      <header>
        <div>
          <h3>${escapeHtml(note.title)}</h3>
          <div class="pill-row">
            <span class="status-pill">${escapeHtml(note.type || "Decision")}</span>
            ${note.pinned ? `<span class="status-pill warn">pinned</span>` : ""}
            ${note.tags ? note.tags.split(",").map((tag) => `<span class="pill">${escapeHtml(tag.trim())}</span>`).join("") : ""}
            <span class="pill">${new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="ghost-btn" data-action="pin-note" data-id="${note.id}" type="button"><i data-lucide="pin"></i></button>
          <button class="ghost-btn" data-action="delete-note" data-id="${note.id}" type="button"><i data-lucide="trash-2"></i></button>
        </div>
      </header>
      <div class="note-body">${escapeHtml(note.body)}</div>
    </article>
  `;
}

function collaboratorRow(person) {
  return `
    <article class="list-row">
      <div>
        <h4>${escapeHtml(person.name)}</h4>
        <div class="pill-row"><span class="pill">${escapeHtml(person.role || "viewer")}</span><span class="pill">${new Date(person.addedAt).toLocaleDateString()}</span></div>
      </div>
      <button class="ghost-btn" data-action="delete-collaborator" data-id="${person.id}" type="button"><i data-lucide="trash-2"></i></button>
    </article>
  `;
}

function experimentRow(experiment) {
  const progress = percent(experiment.current || 0, experiment.target || 0);
  return `
    <article class="list-row">
      <div>
        <div class="row-head">
          <h4>${escapeHtml(experiment.title)}</h4>
          <span class="status-pill ${experiment.status === "won" ? "done" : experiment.status === "lost" ? "danger" : "warn"}">${escapeHtml(experiment.status)}</span>
        </div>
        <div class="progress" aria-label="${progress}% complete"><span style="--value:${Math.min(progress, 100)}%"></span></div>
        <div class="pill-row">
          <span class="pill">${escapeHtml(experiment.channel)}</span>
          <span class="pill">${escapeHtml(experiment.metric || "metric")} ${experiment.current || 0}/${experiment.target || 0}</span>
          ${experiment.due ? `<span class="pill">${escapeHtml(experiment.due)}</span>` : ""}
        </div>
        ${experiment.learning ? `<p class="muted">${escapeHtml(experiment.learning)}</p>` : ""}
      </div>
      <div class="row-actions">
        <button class="secondary-btn" data-action="toggle-experiment" data-id="${experiment.id}" type="button"><i data-lucide="rotate-cw"></i></button>
        <button class="ghost-btn" data-action="delete-experiment" data-id="${experiment.id}" type="button"><i data-lucide="trash-2"></i></button>
      </div>
    </article>
  `;
}

function inviteBanner() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Invite snapshot detected</h3>
          <p>Importing replaces this browser's current tracker state.</p>
        </div>
        <div class="row-actions">
          <button class="primary-btn" data-action="accept-invite" type="button"><i data-lucide="check"></i>Import</button>
          <button class="ghost-btn" data-action="clear-invite" type="button"><i data-lucide="x"></i>Ignore</button>
        </div>
      </div>
    </section>
  `;
}

function empty(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function currencySelect(name, selected = "USD") {
  return `<select name="${name}">${CURRENCIES.map((currency) => `<option value="${currency}" ${currency === selected ? "selected" : ""}>${currency}</option>`).join("")}</select>`;
}

function removeById(collection, id) {
  const index = collection.findIndex((item) => item.id === id);
  if (index >= 0) collection.splice(index, 1);
}

function toggleTask(id) {
  const task = state.routine.tasks.find((item) => item.id === id);
  if (!task) return;
  toggleDate(task.doneOn, todayISO());
}

function toggleHabit(id) {
  const habit = state.routine.habits.find((item) => item.id === id);
  if (!habit) return;
  toggleDate(habit.history, todayISO());
}

function toggleFocus(id) {
  const focus = state.routine.focus.find((item) => item.id === id);
  if (focus) focus.done = !focus.done;
}

function toggleNotePin(id) {
  const note = state.notes.find((item) => item.id === id);
  if (note) {
    note.pinned = !note.pinned;
    note.updatedAt = new Date().toISOString();
  }
}

function deleteNote(id) {
  removeById(state.notes, id);
  state.trash.notes = Array.from(new Set([...(state.trash.notes || []), id])).slice(-500);
}

function cycleExperimentStatus(id) {
  const experiment = state.growth.experiments.find((item) => item.id === id);
  if (!experiment) return;
  const statuses = ["planned", "running", "won", "lost"];
  experiment.status = statuses[(statuses.indexOf(experiment.status) + 1) % statuses.length];
}

function markDeadline(id) {
  const deadline = getDeadline(id);
  if (deadline) deadline.status = deadline.status === "done" ? "open" : "done";
}

function getDeadline(id) {
  return state.routine.deadlines.find((item) => item.id === id);
}

function toggleDate(history, date) {
  const index = history.indexOf(date);
  if (index >= 0) history.splice(index, 1);
  else history.push(date);
}

function upsertHealth(log) {
  const index = state.routine.health.findIndex((item) => item.date === log.date);
  if (index >= 0) state.routine.health[index] = { ...state.routine.health[index], ...log };
  else state.routine.health.unshift(log);
}

function applyExpenseToWallet(expense) {
  const wallet = state.budget.wallets.find((item) => item.id === expense.walletId);
  if (!wallet) return;
  wallet.balance -= convert(expense.amount, expense.currency, wallet.currency);
}

function deleteExpense(id) {
  const expense = state.budget.expenses.find((item) => item.id === id);
  if (expense) {
    const wallet = state.budget.wallets.find((item) => item.id === expense.walletId);
    if (wallet) wallet.balance += convert(expense.amount, expense.currency, wallet.currency);
  }
  removeById(state.budget.expenses, id);
}

function startTimer(projectId, task = "") {
  if (state.timer.active) return;
  state.timer.active = {
    projectId,
    task,
    startedAt: Date.now(),
    start: new Date().toISOString(),
  };
}

function stopTimer() {
  const active = state.timer.active;
  if (!active) return;
  const end = Date.now();
  state.timer.sessions.unshift({
    id: uid(),
    projectId: active.projectId,
    task: active.task,
    start: active.start,
    end: new Date(end).toISOString(),
    duration: Math.max(0, end - active.startedAt),
  });
  state.timer.active = null;
}

function deleteProject(id) {
  const project = getProject(id);
  if (project?.files?.length) {
    project.files.forEach((file) => deleteFile(file.id));
  }
  removeById(state.projects, id);
  state.timer.sessions = state.timer.sessions.filter((session) => session.projectId !== id);
  if (state.timer.active?.projectId === id) state.timer.active = null;
}

function getProject(id) {
  return state.projects.find((project) => project.id === id);
}

async function storeProjectFiles(projectId, files) {
  const project = getProject(projectId);
  if (!project) return;
  project.files = project.files || [];
  for (const file of files) {
    const id = uid();
    const record = {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      data: await file.arrayBuffer(),
    };
    await putFile(record);
    project.files.push({ id, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified });
  }
  persist();
  render();
  toast(`${files.length} file${files.length === 1 ? "" : "s"} saved.`);
}

async function downloadFile(projectId, fileId) {
  const project = getProject(projectId);
  const meta = project?.files?.find((file) => file.id === fileId);
  const record = await getFile(fileId);
  if (!record || !meta) {
    toast("File data was not found in this browser.");
    return;
  }
  const blob = new Blob([record.data], { type: meta.type || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = meta.name;
  link.click();
  URL.revokeObjectURL(url);
}

async function deleteProjectFile(projectId, fileId) {
  const project = getProject(projectId);
  if (!project) return;
  project.files = (project.files || []).filter((file) => file.id !== fileId);
  await deleteFile(fileId);
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(FILE_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function putFile(record) {
  const db = await openDb();
  return txStore(db, "readwrite").put(record);
}

async function getFile(id) {
  const db = await openDb();
  return txStore(db, "readonly").get(id);
}

async function deleteFile(id) {
  const db = await openDb();
  return txStore(db, "readwrite").delete(id);
}

function txStore(db, mode) {
  const tx = db.transaction(FILE_STORE, mode);
  const store = tx.objectStore(FILE_STORE);
  return {
    put: (value) => req(store.put(value)),
    get: (key) => req(store.get(key)),
    delete: (key) => req(store.delete(key)),
  };
}

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function refreshRates(showToast) {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    if (!response.ok) throw new Error("rate fetch failed");
    const data = await response.json();
    if (data.result !== "success") throw new Error("bad rate payload");
    state.rates = {
      base: "USD",
      rates: CURRENCIES.reduce((rates, currency) => {
        rates[currency] = data.rates[currency];
        return rates;
      }, { USD: 1 }),
      updated: data.time_last_update_utc || new Date().toUTCString(),
      source: "https://open.er-api.com/v6/latest/USD",
    };
    persist();
    render();
    if (showToast) toast("Exchange rates refreshed.");
  } catch (error) {
    if (showToast) toast("Could not refresh rates. Offline fallback is still loaded.");
  }
}

function convert(amount, from, to) {
  const rates = state.rates?.rates || RATE_FALLBACK.rates;
  if (from === to) return Number(amount) || 0;
  const fromRate = rates[from] || RATE_FALLBACK.rates[from] || 1;
  const toRate = rates[to] || RATE_FALLBACK.rates[to] || 1;
  return ((Number(amount) || 0) / fromRate) * toRate;
}

function checkAlerts() {
  if (!state.settings.notifications || Notification.permission !== "granted") return;
  const now = Date.now();
  let changed = false;
  state.routine.deadlines.forEach((deadline) => {
    if (deadline.status === "done" || deadline.notified || !deadline.due) return;
    const due = new Date(deadline.due).getTime();
    const reminderMs = (deadline.reminder || 15) * 60 * 1000;
    if (due - now <= reminderMs && due - now > -60 * 60 * 1000) {
      new Notification("Deadline coming up", { body: deadline.title });
      deadline.notified = true;
      changed = true;
    }
  });

  state.routine.tasks.forEach((task) => {
    if (!task.time || task.doneOn.includes(todayISO())) return;
    const stamp = new Date(`${todayISO()}T${task.time}`).getTime();
    const key = `notified-${task.id}-${todayISO()}`;
    if (now >= stamp && now - stamp < 30 * 60 * 1000 && !localStorage.getItem(key)) {
      new Notification("Routine time", { body: task.title });
      localStorage.setItem(key, "yes");
    }
  });

  if (changed) persist();
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    toast("This browser does not support notifications.");
    return;
  }
  const permission = await Notification.requestPermission();
  state.settings.notifications = permission === "granted";
  persist();
  toast(state.settings.notifications ? "Notifications enabled." : "Notifications are blocked.");
}

function buildGithubIssueUrl(deadline) {
  const { owner, repo, username } = state.settings.github;
  if (!deadline || !owner || !repo) return "";
  const params = new URLSearchParams({
    title: deadline.title,
    body: `Deadline: ${deadline.due || "not set"}\nPriority: ${deadline.priority || "medium"}\n\nCreated from Daily Command Center.`,
    labels: "deadline",
  });
  if (username) params.set("assignees", username);
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/new?${params.toString()}`;
}

function buildGithubUploadUrl() {
  const { owner, repo, branch } = state.settings.github;
  if (!owner || !repo) return "";
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/upload/${encodeURIComponent(branch || "main")}`;
}

function createInviteLink() {
  const snapshot = {
    ...state,
    timer: { ...state.timer, active: null },
    projects: state.projects.map((project) => ({ ...project, files: project.files || [] })),
  };
  const encoded = encodeState(snapshot);
  return `${location.origin}${location.pathname}#invite=${encoded}`;
}

function parseInviteHash() {
  if (!location.hash.startsWith("#invite=")) return;
  try {
    pendingInvite = decodeState(location.hash.replace("#invite=", ""));
    history.replaceState(null, "", location.pathname);
  } catch (error) {
    pendingInvite = null;
  }
}

function acceptInvite() {
  if (!pendingInvite) return;
  state = sanitizeState(pendingInvite);
  pendingInvite = null;
  persist();
  render();
  toast("Invite imported.");
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `daily-command-center-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    state = sanitizeState(JSON.parse(text));
    persist();
    render();
    toast("Backup imported.");
  } catch (error) {
    toast("Could not import that JSON file.");
  } finally {
    event.target.value = "";
  }
}

async function pushRemote() {
  if (!state.settings.remote.enabled || !state.settings.remote.endpoint) {
    toast("Remote endpoint is not enabled.");
    return;
  }
  try {
    const url = remoteUrl();
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!response.ok) throw new Error("push failed");
    toast("Remote state pushed.");
  } catch (error) {
    toast("Remote push failed.");
  }
}

async function pullRemote() {
  if (!state.settings.remote.enabled || !state.settings.remote.endpoint) {
    toast("Remote endpoint is not enabled.");
    return;
  }
  try {
    const response = await fetch(remoteUrl(), { cache: "no-store" });
    if (!response.ok) throw new Error("pull failed");
    const data = await response.json();
    if (!data) throw new Error("empty remote");
    state = sanitizeState(data);
    state.settings.remote.lastPulled = new Date().toLocaleString();
    persist();
    render();
    toast("Remote state pulled.");
  } catch (error) {
    toast("Remote pull failed.");
  }
}

function remoteUrl() {
  const endpoint = state.settings.remote.endpoint.replace(/\/$/, "");
  const room = encodeURIComponent(state.settings.remote.room || state.friends.room || "omar-595");
  return `${endpoint}/${room}.json`;
}

function copyInvite() {
  copyText(state.friends.lastInvite || createInviteLink());
}

async function copyText(text) {
  if (!text) {
    toast("Nothing to copy.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied.");
  } catch (error) {
    toast("Copy failed.");
  }
}

function persist(shouldBroadcast = true, options = { touch: true }) {
  if (options.touch !== false) state.updatedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    toast("Save failed. Export a backup, then remove old files or huge notes.");
    throw error;
  }
  if (shouldBroadcast && channel) {
    channel.postMessage({ type: "state", state, instanceId: APP_INSTANCE_ID });
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeState(JSON.parse(raw)) : defaultState();
  } catch (error) {
    return defaultState();
  }
}

function sanitizeState(input) {
  const base = defaultState();
  const trash = {
    ...base.trash,
    ...(input.trash || {}),
    notes: input.trash?.notes || input.deletedNotes || [],
  };
  return {
    ...base,
    ...input,
    profile: { ...base.profile, ...(input.profile || {}) },
    rates: { ...base.rates, ...(input.rates || {}) },
    budget: {
      wallets: input.budget?.wallets || base.budget.wallets,
      expenses: input.budget?.expenses || [],
      plans: input.budget?.plans || [],
      goals: input.budget?.goals || [],
    },
    routine: {
      tasks: input.routine?.tasks || base.routine.tasks,
      deadlines: input.routine?.deadlines || [],
      habits: input.routine?.habits || base.routine.habits,
      health: input.routine?.health || [],
      focus: input.routine?.focus || [],
      reviews: input.routine?.reviews || [],
    },
    timer: { active: input.timer?.active || null, sessions: input.timer?.sessions || [] },
    projects: input.projects || [],
    notes: normalizeNotes(input.notes || [], trash.notes),
    startup: { ...base.startup, ...(input.startup || {}) },
    growth: {
      ...base.growth,
      ...(input.growth || {}),
      experiments: input.growth?.experiments || base.growth.experiments,
    },
    trash,
    friends: { ...base.friends, ...(input.friends || {}) },
    settings: {
      ...base.settings,
      ...(input.settings || {}),
      github: { ...base.settings.github, ...(input.settings?.github || {}) },
      remote: { ...base.settings.remote, ...(input.settings?.remote || {}) },
    },
  };
}

function normalizeNotes(notes, deletedIds = []) {
  const deleted = new Set(deletedIds || []);
  return (notes || [])
    .filter((note) => note && note.id && !deleted.has(note.id))
    .map((note) => ({
      id: note.id,
      title: clean(note.title) || "Untitled note",
      tags: clean(note.tags),
      body: clean(note.body),
      type: clean(note.type) || "Decision",
      pinned: Boolean(note.pinned),
      createdAt: note.createdAt || note.updatedAt || new Date().toISOString(),
      updatedAt: note.updatedAt || note.createdAt || new Date().toISOString(),
    }));
}

function mergeStates(localState, incomingState) {
  const local = sanitizeState(localState);
  const incoming = sanitizeState(incomingState);
  const trash = {
    notes: Array.from(new Set([...(local.trash?.notes || []), ...(incoming.trash?.notes || [])])),
  };
  return sanitizeState({
    ...local,
    ...incoming,
    profile: incoming.updatedAt >= local.updatedAt ? incoming.profile : local.profile,
    rates: incoming.rates?.updated === local.rates?.updated ? local.rates : incoming.rates,
    budget: {
      wallets: mergeCollection(local.budget.wallets, incoming.budget.wallets),
      expenses: mergeCollection(local.budget.expenses, incoming.budget.expenses),
      plans: mergeCollection(local.budget.plans, incoming.budget.plans),
      goals: mergeCollection(local.budget.goals, incoming.budget.goals),
    },
    routine: {
      tasks: mergeCollection(local.routine.tasks, incoming.routine.tasks),
      deadlines: mergeCollection(local.routine.deadlines, incoming.routine.deadlines),
      habits: mergeCollection(local.routine.habits, incoming.routine.habits),
      health: mergeCollection(local.routine.health, incoming.routine.health, "date"),
      focus: mergeCollection(local.routine.focus, incoming.routine.focus),
      reviews: mergeCollection(local.routine.reviews, incoming.routine.reviews),
    },
    timer: {
      active: incoming.timer.active || local.timer.active,
      sessions: mergeCollection(local.timer.sessions, incoming.timer.sessions),
    },
    projects: mergeCollection(local.projects, incoming.projects),
    notes: mergeCollection(local.notes, incoming.notes).filter((note) => !trash.notes.includes(note.id)),
    startup: incoming.updatedAt >= local.updatedAt ? incoming.startup : local.startup,
    growth: { experiments: mergeCollection(local.growth.experiments, incoming.growth.experiments) },
    friends: {
      ...incoming.friends,
      collaborators: mergeCollection(local.friends.collaborators, incoming.friends.collaborators),
    },
    settings: incoming.updatedAt >= local.updatedAt ? incoming.settings : local.settings,
    trash,
    updatedAt: Math.max(local.updatedAt || 0, incoming.updatedAt || 0),
  });
}

function mergeCollection(left = [], right = [], key = "id") {
  const map = new Map();
  [...left, ...right].forEach((item) => {
    if (!item) return;
    const id = item[key] || item.id || JSON.stringify(item);
    const existing = map.get(id);
    if (!existing) {
      map.set(id, item);
      return;
    }
    const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
    map.set(id, itemTime >= existingTime ? { ...existing, ...item } : { ...item, ...existing });
  });
  return Array.from(map.values());
}

function encodeState(value) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(value))));
}

function decodeState(value) {
  return JSON.parse(decodeURIComponent(escape(atob(value))));
}

function expensesThisMonth() {
  const prefix = todayISO().slice(0, 7);
  return state.budget.expenses.filter((expense) => expense.date?.startsWith(prefix));
}

function upcomingDeadlines() {
  return state.routine.deadlines
    .filter((deadline) => deadline.status !== "done")
    .sort((a, b) => new Date(a.due) - new Date(b.due));
}

function projectTimeForDate(date) {
  return state.timer.sessions
    .filter((session) => session.start?.slice(0, 10) === date)
    .reduce((sum, session) => sum + session.duration, 0);
}

function totalProjectTime() {
  return state.timer.sessions.reduce((sum, session) => sum + session.duration, 0);
}

function projectTimeRows() {
  const rows = state.projects.map((project) => {
    const duration = state.timer.sessions.filter((session) => session.projectId === project.id).reduce((sum, session) => sum + session.duration, 0);
    return { project, duration };
  });
  return rows
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 6)
    .map(({ project, duration }) => `
      <article class="list-row">
        <div><h4>${escapeHtml(project.name)}</h4><span class="pill">${escapeHtml(project.status)}</span></div>
        <strong>${formatDuration(duration)}</strong>
      </article>
    `)
    .join("") || empty("No project time yet.");
}

function runwayMonths(totalWallets, monthlySpend) {
  if (!monthlySpend) return totalWallets > 0 ? "∞" : "0.0";
  return (totalWallets / monthlySpend).toFixed(1);
}

function growthSummary() {
  const experiments = state.growth?.experiments || [];
  const active = experiments.filter((item) => item.status === "running").length;
  const won = experiments.filter((item) => item.status === "won").length;
  const totalProgress = experiments.reduce((sum, item) => sum + Math.min(percent(item.current || 0, item.target || 0), 100), 0);
  return {
    active,
    won,
    progress: experiments.length ? Math.round(totalProgress / experiments.length) : 0,
  };
}

function investorScore() {
  const base = state.profile.baseCurrency;
  const totalWallets = state.budget.wallets.reduce((sum, wallet) => sum + convert(wallet.balance, wallet.currency, base), 0);
  const monthSpent = expensesThisMonth().reduce((sum, expense) => sum + convert(expense.amount, expense.currency, base), 0);
  const runway = Number(runwayMonths(totalWallets, monthSpent));
  const experiments = state.growth?.experiments || [];
  let score = 18;
  if (state.notes.length >= 3) score += 10;
  if (state.projects.length >= 1) score += 10;
  if (state.timer.sessions.length >= 3) score += 8;
  if (state.routine.focus.some((item) => item.done)) score += 6;
  if (state.startup.customers > 0) score += 14;
  if (state.startup.mrr > 0) score += 18;
  if (experiments.some((item) => item.status === "running")) score += 8;
  if (Number.isFinite(runway) && runway >= state.startup.runwayTargetMonths) score += 8;
  return Math.min(score, 100);
}

function investorWarnings(totalWallets, monthSpent) {
  const warnings = [];
  if (!state.startup.customers) {
    warnings.push({
      title: "No customer proof",
      detail: "A tracker without users is a feature, not a company.",
      fix: "Talk to 20 target users and log customer notes here.",
    });
  }
  if (!state.startup.mrr) {
    warnings.push({
      title: "No monetization signal",
      detail: "Investors need evidence that users will pay for behavior change.",
      fix: "Charge $9-19/mo manually before building bank-sync complexity.",
    });
  }
  if ((state.growth?.experiments || []).filter((item) => item.status === "running").length === 0) {
    warnings.push({
      title: "No growth loop",
      detail: "A private dashboard has no natural distribution.",
      fix: "Run referral, campus, and build-in-public experiments weekly.",
    });
  }
  if (!monthSpent && totalWallets === 0) {
    warnings.push({
      title: "No real data",
      detail: "Empty dashboards are not defensible and do not create habit.",
      fix: "Force a 90-second onboarding that captures wallet, goal, and first note.",
    });
  }
  return warnings.slice(0, 6);
}

function strategicRoadmap() {
  return [
    { when: "30 days", title: "Retention wedge", body: "Fix persistence, add onboarding, import/export, weekly review, and one killer insight: money leak vs time leak." },
    { when: "90 days", title: "Network wedge", body: "Shared rooms, accountability groups, referrals, campus ambassadors, and creator templates." },
    { when: "12 months", title: "Data moat", body: "Bank sync, AI categorization, receipt parsing, project ROI, benchmark graph, and privacy-first personal data vault." },
  ];
}

function investorPitch() {
  return `RunwayOS is a local-first money and execution cockpit for ${state.profile.segment}. It combines multi-currency cash control, project time ROI, notes, deadlines, and growth experiments so ambitious builders can see whether their money and time are compounding. Wedge: ${state.startup.wedge}. North star: ${state.profile.northStar}. Current MRR: ${state.startup.mrr}. Customers: ${state.startup.customers}.`;
}

function habitStreak(habit) {
  let streak = 0;
  const history = new Set(habit.history || []);
  const cursor = new Date();
  while (history.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function priorityClass(priority) {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warn";
  return "";
}

function tick() {
  if (state.timer.active) {
    const clock = $("#timerClock");
    if (clock) clock.textContent = formatDuration(Date.now() - state.timer.active.startedAt);
  }
}

function renderIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function setTodayLabel() {
  $("#todayLabel").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clean(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(Number(value) || 0);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor((Number(ms) || 0) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function toast(message) {
  const existing = $(".toast");
  if (existing) existing.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}
