import {
  buildDeadlinePlan,
  calculateCapacity as calc,
  optimiseFlexibleWeek,
  sortTasksByDeadline as taskSort,
} from "./core.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Storage is deliberately versioned so future migrations can be explicit.
const STORE = "margin-state-v1";
const STATE_SCHEMA = 2;
const demoWeek = [
  {
    day: "Mon",
    date: "10",
    sleep: 7,
    fixed: 7,
    flex: 3,
    care: 1,
    commute: 1,
    energy: 4,
    stress: 2,
  },
  {
    day: "Tue",
    date: "11",
    sleep: 6.5,
    fixed: 8,
    flex: 4,
    care: 0,
    commute: 1.5,
    energy: 3,
    stress: 3,
  },
  {
    day: "Wed",
    date: "12",
    sleep: 5.5,
    fixed: 9,
    flex: 6,
    care: 2,
    commute: 1.5,
    energy: 2,
    stress: 5,
  },
  {
    day: "Thu",
    date: "13",
    sleep: 6,
    fixed: 8,
    flex: 5,
    care: 1,
    commute: 2,
    energy: 2,
    stress: 4,
  },
  {
    day: "Fri",
    date: "14",
    sleep: 7,
    fixed: 6,
    flex: 3,
    care: 1,
    commute: 1,
    energy: 3,
    stress: 3,
  },
  {
    day: "Sat",
    date: "15",
    sleep: 8,
    fixed: 2,
    flex: 4,
    care: 2,
    commute: 0.5,
    energy: 3,
    stress: 2,
  },
  {
    day: "Sun",
    date: "16",
    sleep: 8,
    fixed: 1,
    flex: 2,
    care: 2,
    commute: 0,
    energy: 4,
    stress: 2,
  },
];
const actions = [
  {
    id: "orient",
    title: "Name five steady things",
    minutes: 2,
    energy: ["low", "medium", "high"],
    places: ["public", "private", "outside"],
    silent: true,
    steps:
      "Look around slowly. Name five neutral things you can see, four sensations you can feel, and one sound you can hear.",
    reason: "It needs no privacy, movement, app or special equipment.",
  },
  {
    id: "exhale",
    title: "Longer-exhale reset",
    minutes: 2,
    energy: ["low", "medium", "high"],
    places: ["public", "private", "outside"],
    silent: true,
    steps:
      "Breathe normally. For five rounds, let your exhale last a little longer than your inhale. Stop if you feel uncomfortable.",
    reason: "It is discreet and fits a very short, low-energy moment.",
  },
  {
    id: "water",
    title: "Water + one next step",
    minutes: 5,
    energy: ["low", "medium"],
    places: ["public", "private"],
    silent: true,
    steps:
      "Drink some water if available. Write only the next physical action—not the whole project. Make it small enough to begin in two minutes.",
    reason: "It combines a physical pause with reduced decision load.",
  },
  {
    id: "walk",
    title: "Unhurried reset walk",
    minutes: 10,
    energy: ["medium", "high"],
    places: ["outside", "public"],
    silent: true,
    steps:
      "Walk without trying to exercise. Let your eyes look farther away than a screen. Return when the timer ends.",
    reason: "Your context allows movement and a wider visual field.",
  },
  {
    id: "brain-dump",
    title: "Three-column brain dump",
    minutes: 10,
    energy: ["medium", "high"],
    places: ["private", "public"],
    silent: true,
    steps:
      "Write three headings: must happen, can move, not mine. Put every open loop into one column. Choose one “must happen” item.",
    reason: "It reduces cognitive load without asking you to solve everything.",
  },
  {
    id: "sensory",
    title: "Lower the sensory volume",
    minutes: 5,
    energy: ["low", "medium"],
    places: ["private"],
    silent: true,
    steps:
      "Dim one light, silence one notification source, and reduce one uncomfortable sound or texture. Sit without adding another task.",
    reason: "You have some privacy and limited energy.",
  },
  {
    id: "stretch",
    title: "Desk release sequence",
    minutes: 5,
    energy: ["medium", "high"],
    places: ["private", "outside"],
    silent: false,
    steps:
      "Unclench your jaw, lower your shoulders, open and close your hands, then stand or stretch gently within comfort.",
    reason: "It uses a little movement without becoming a workout.",
  },
  {
    id: "connection",
    title: "Send one low-pressure message",
    minutes: 5,
    energy: ["medium", "high"],
    places: ["private", "public"],
    silent: true,
    steps:
      "Message one trusted person: “I am overloaded. I do not need solutions, but could you check in later?”",
    reason:
      "It asks for a specific kind of support without a long explanation.",
  },
  {
    id: "rest",
    title: "Protected nothing block",
    minutes: 20,
    energy: ["low", "medium"],
    places: ["private"],
    silent: true,
    steps:
      "Set the timer. Lie down or sit comfortably. No catching up, scrolling or planning. Let this block have no productivity target.",
    reason: "You have privacy and enough time for actual recovery.",
  },
];
// Build a useful first-run demo. Dates are tied to the hackathon week so the
// reviewer can see deadline pressure immediately.
function fresh() {
  return {
    schemaVersion: STATE_SCHEMA,
    week: structuredClone(demoWeek),
    tasks: [
      {
        id: "demo-1",
        name: "Biology lab report",
        due: "2026-08-17",
        hours: 3,
        remaining: 3,
        priority: "high",
        split: true,
        session: 0.5,
      },
      {
        id: "demo-2",
        name: "Group presentation slides",
        due: "2026-08-19",
        hours: 2.5,
        remaining: 2.5,
        priority: "medium",
        split: true,
        session: 0.5,
      },
    ],
    taskPlan: null,
    checkin: { energy: 3, stress: 3, at: null },
    history: demoWeek.map((d, i) => ({
      day: d.day,
      energy: d.energy,
      stress: d.stress,
      sleep: d.sleep,
      at: `2026-08-${10 + i}T12:00:00Z`,
    })),
    learning: {},
    recent: [],
    helpfulWins: 0,
    support: { name: "", signs: "", help: "", avoid: "" },
    resource: { name: "", contact: "" },
    resourcePack: [],
    settings: { contrast: false, calm: false, size: "normal" },
  };
}
let state;
try {
  state = JSON.parse(localStorage.getItem(STORE)) || fresh();
} catch {
  state = fresh();
}
if (!state.week?.length) state = fresh();
state.tasks ??= [];
state.taskPlan ??= null;
state.history ??= [];
state.helpfulWins ??= 0;
state.resource ??= { name: "", contact: "" };
state.resourcePack ??= [];
state.learning ??= {};
state.recent ??= [];
state.schemaVersion = STATE_SCHEMA;
let selectedDay = 5,
  scenario = { ...state.week[selectedDay] },
  rescuedWeek = null,
  resetContext = {
    minutes: 5,
    energy: "medium",
    place: "public",
    quiet: false,
  },
  currentAction = null,
  timer = null,
  timeLeft = 0;
const save = () => localStorage.setItem(STORE, JSON.stringify(state));
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.remove("show"), 2300);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Firefox and embedded mobile browsers do not always expose the modern
  // clipboard API. Keep a small legacy fallback for those environments.
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand?.("copy");
  field.remove();
  if (!copied) throw new Error("Clipboard permission is unavailable");
}

function downloadBlob(blob, filename, revokeAfter = 2_000) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), revokeAfter);
  return url;
}
const fmt = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}h`;
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
function closeDrawer() {
  $("#menuDrawer").hidden = true;
  $("#menuScrim").hidden = true;
  $("#menuBtn").setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}
function showView(name) {
  $$(".view").forEach((v) => {
    v.hidden = true;
    v.classList.remove("active");
  });
  $$(".drawer-link").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name),
  );
  const v = $(`#${name}View`);
  if (!v) return;
  v.hidden = false;
  v.classList.add("active");
  if (name === "tasks") renderTasks();
  if (name === "week") renderWeekLab();
  if (name === "reset") renderRecommendation(false);
  if (name === "support") renderSupport();
  closeDrawer();
  scrollTo({ top: 0, behavior: "smooth" });
}
$$("[data-view]").forEach((b) =>
  b.addEventListener("click", () => showView(b.dataset.view)),
);
$$("[data-go]").forEach((b) =>
  b.addEventListener("click", () => showView(b.dataset.go)),
);
$("#menuBtn").addEventListener("click", () => {
  const open = $("#menuDrawer").hidden;
  $("#menuDrawer").hidden = !open;
  $("#menuScrim").hidden = !open;
  $("#menuBtn").setAttribute("aria-expanded", String(open));
  if (open) document.body.style.overflow = "hidden";
});
$("#closeMenu").addEventListener("click", closeDrawer);
$("#menuScrim").addEventListener("click", closeDrawer);
// ---------------------------------------------------------------------------
// Today dashboard
// ---------------------------------------------------------------------------
function renderDashboard() {
  const results = state.week.map(calc),
    total = results.reduce((s, r) => s + r.margin, 0),
    red = results.filter((r) => r.level === "red").length,
    amber = results.filter((r) => r.level === "amber").length;
  $("#heroMargin").textContent = total.toFixed(1);
  $("#weekRibbon").innerHTML = state.week
    .map((d, i) => {
      const r = results[i],
        height = Math.max(10, Math.min(100, 50 + r.margin * 7));
      const statusLabel =
        r.level === "red"
          ? "capacity debt"
          : r.level === "amber"
            ? "thin margin"
            : "usable margin";

      return `
        <article class="day-column ${r.level} ${i === 5 ? "today" : ""}">
          <span class="day-state"></span>
          <span class="day-name">${d.day}</span>
          <span class="day-date">Aug ${d.date}</span>
          <div class="capacity-bar">
            <i style="height:${height}%;--capacity:${height}%"></i>
          </div>
          <strong class="day-margin">${fmt(r.margin)}</strong>
          <small>${statusLabel}</small>
        </article>
      `;
    })
    .join("");
  const careHours = state.week.reduce((total, day) => total + day.care, 0);
  const commuteHours = state.week.reduce(
    (total, day) => total + day.commute,
    0,
  );
  const summaryItems = [
    [red, "redline days"],
    [amber, "thin-margin days"],
    [`${careHours.toFixed(1)}h`, "care work counted"],
    [`${commuteHours.toFixed(1)}h`, "commuting counted"],
  ];

  $("#weekSummary").innerHTML = summaryItems
    .map(
      ([value, label]) => `
        <span class="summary-chip">
          <strong>${value}</strong> ${label}
        </span>
      `,
    )
    .join("");
  const worst = results
      .map((r, i) => ({ ...r, i }))
      .sort((a, b) => a.margin - b.margin)[0],
    wd = state.week[worst.i];
  $("#mainInsight").innerHTML = `
    <strong>${wd.day} is carrying more than it can hold.</strong>
    <p>
      After sleep, fixed commitments, care work, commuting and a minimum
      recovery reserve, ${wd.day} has ${worst.debt.toFixed(1)} hours of
      capacity debt. Moving even one flexible block could protect the rest
      of the week.
    </p>
  `;
  const td = state.week[5],
    tr = results[5];
  $("#todayState").textContent =
    tr.level === "green"
      ? "Room available"
      : tr.level === "amber"
        ? "Thin margin"
        : "Redline";
  $("#todayState").className = `state-pill ${tr.level}`;
  $("#todayPlan").innerHTML = [
    ["08:00", "Care duties", "Counted, not invisible"],
    ["10:30", "Assignment block", `${td.flex.toFixed(1)}h flexible demand`],
    [
      "15:00",
      "Unclaimed margin",
      tr.margin > 0
        ? `${tr.margin.toFixed(1)}h protected`
        : "No protected margin",
    ],
    ["19:30", "Recovery reserve", "2.0h minimum"],
  ]
    .map(
      (x) =>
        `<div class="plan-row"><time>${x[0]}</time><strong>${x[1]}</strong><span>${x[2]}</span></div>`,
    )
    .join("");
  $("#energyRange").value = state.checkin.energy;
  $("#stressRange").value = state.checkin.stress;
  $("#energyValue").textContent = `${state.checkin.energy} / 5`;
  $("#stressValue").textContent = `${state.checkin.stress} / 5`;
  $("#checkinSaved").textContent = state.checkin.at ? "Saved locally" : "";
  renderTrends();
  renderFootprints();
  renderOneThing();
}
function renderTrends() {
  const data = state.history.length
    ? state.history.slice(-7)
    : state.week.map((d) => ({
        day: d.day,
        energy: d.energy,
        stress: d.stress,
        sleep: d.sleep,
      }));
  $("#trendChart").innerHTML = data
    .map(
      (day) => `
        <div
          class="trend-day"
          title="${day.day}: energy ${day.energy}, stress ${day.stress}, sleep ${day.sleep} hours"
        >
          <i style="height:${day.energy * 18}%"></i>
          <i style="height:${day.stress * 18}%"></i>
          <i style="height:${Math.min(100, day.sleep * 10)}%"></i>
          <span>${day.day}</span>
        </div>
      `,
    )
    .join("");
  const low = [...data].sort(
      (a, b) => a.energy - a.stress - (b.energy - b.stress),
    )[0],
    avgSleep = data.reduce((s, d) => s + d.sleep, 0) / data.length;
  $("#trendInsight").textContent =
    `Energy was most stretched on ${low.day}. Average recorded sleep is ${avgSleep.toFixed(1)} hours. MARGIN shows association, not medical causation.`;
}
function renderFootprints() {
  const wins = state.helpfulWins || 0,
    shown = Math.min(10, Math.max(5, wins));
  $("#footprints").innerHTML = Array.from(
    { length: shown },
    (_, i) =>
      `<span class="footprint ${i < wins ? "" : "empty"}">${i < wins ? "✓" : "·"}</span>`,
  ).join("");
  $("#winsCount").textContent =
    `${wins} helpful moment${wins === 1 ? "" : "s"}`;
}
function daysUntil(date) {
  const now = new Date(),
    d = new Date(`${date}T23:59:00`);
  return Math.ceil((d - now) / 864e5);
}
function renderOneThing() {
  const tasks = [...state.tasks]
      .filter((t) => (t.remaining ?? t.hours) > 0)
      .sort(taskSort),
    one = tasks[0];
  if (one) {
    const sessionLength = Math.min(
      one.session || 0.5,
      one.remaining ?? one.hours,
    );
    const dueLabel = new Date(`${one.due}T12:00:00`).toLocaleDateString(
      undefined,
      { weekday: "short", month: "short", day: "numeric" },
    );
    $("#oneThing").innerHTML = `
      <strong>${escapeHTML(one.name)}</strong>
      <p>
        ${sessionLength.toFixed(1)}h session · due ${dueLabel}. Start only this
        session; the rest remains scheduled.
      </p>
    `;
  } else {
    $("#oneThing").innerHTML = `
      <strong>Your inbox is clear.</strong>
      <p>Add a real task to receive one deadline-aware next action.</p>
    `;
  }
  const soon = tasks.filter((t) => daysUntil(t.due) <= 2),
    hours = soon.reduce((s, t) => s + (t.remaining ?? t.hours), 0),
    available = state.week
      .slice(5, 7)
      .map(calc)
      .reduce((s, r) => s + Math.max(0, r.margin), 0),
    alert = soon.length > 1 || hours > available;
  $("#shockCard").classList.toggle("alert", alert);
  $("#shockHeading").textContent = alert
    ? `${soon.length} deadlines are competing for the same margin.`
    : "No deadline shocks detected.";
  $("#shockSummary").textContent = alert
    ? `${hours.toFixed(1)} task hours are due within two days, against roughly ${available.toFixed(1)} hours of visible margin. Open Task Inbox before accepting another commitment.`
    : "MARGIN will flag deadline clusters and workload that exceeds visible capacity.";
}
$("#demoBtn").addEventListener("click", () => {
  state.week = structuredClone(demoWeek);
  state.history = demoWeek.map((d, i) => ({
    day: d.day,
    energy: d.energy,
    stress: d.stress,
    sleep: d.sleep,
    at: `2026-08-${10 + i}T12:00:00Z`,
  }));
  selectedDay = 5;
  scenario = { ...state.week[5] };
  save();
  renderDashboard();
  toast("Demo week restored");
});
["energy", "stress"].forEach((k) => {
  $(`#${k}Range`).addEventListener("input", (e) => {
    $(`#${k}Value`).textContent = `${e.target.value} / 5`;
  });
});
function commitCheckin(energy, stress, sleep = state.week[5].sleep) {
  state.checkin = { energy, stress, at: new Date().toISOString() };
  state.week[5].energy = energy;
  state.week[5].stress = stress;
  state.week[5].sleep = sleep;
  state.history.push({
    day: state.week[5].day,
    energy,
    stress,
    sleep,
    at: state.checkin.at,
  });
  state.history = state.history.slice(-21);
  save();
  renderDashboard();
}
$("#saveCheckin").addEventListener("click", () => {
  commitCheckin(+$("#energyRange").value, +$("#stressRange").value);
  toast("Check-in saved on this device");
});
$("#voiceCheckin").addEventListener("click", () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $("#voiceStatus").textContent =
      "Voice check-in is unavailable in this browser. The sliders still work offline.";
    return;
  }
  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = false;
  $("#voiceCheckin").classList.add("listening");
  $("#voiceStatus").textContent = "Listening… speak naturally.";
  rec.onresult = (e) => {
    const t = e.results[0][0].transcript.toLowerCase();
    let energy = 3,
      stress = 3,
      sleep = state.week[5].sleep;
    const sm = t.match(
      /(?:slept|sleep|got)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?/,
    );
    if (sm) sleep = Math.max(3, Math.min(10, +sm[1]));
    if (
      /energy\s+(?:is\s+)?(?:very\s+)?low|exhausted|drained|no energy/.test(t)
    )
      energy = 1;
    else if (/energy\s+(?:is\s+)?high|energized|full of energy/.test(t))
      energy = 5;
    else if (/energy\s+(?:is\s+)?medium|okay energy|steady/.test(t)) energy = 3;
    if (/stress\s+(?:is\s+)?(?:very\s+)?high|overwhelmed|flooded/.test(t))
      stress = 5;
    else if (/stress\s+(?:is\s+)?low|calm|relaxed/.test(t)) stress = 1;
    else if (/stress\s+(?:is\s+)?medium|a bit stressed/.test(t)) stress = 3;
    commitCheckin(energy, stress, sleep);
    $("#voiceStatus").textContent =
      `Heard: “${t}” — sleep ${sleep}h, energy ${energy}/5, stress ${stress}/5.`;
    $("#voiceCheckin").classList.remove("listening");
  };
  rec.onerror = () => {
    $("#voiceStatus").textContent =
      "I could not hear that. Try again or use the sliders.";
    $("#voiceCheckin").classList.remove("listening");
  };
  rec.onend = () => $("#voiceCheckin").classList.remove("listening");
  rec.start();
});
$("#readInsight").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    toast("Read aloud is unavailable");
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance($("#mainInsight").innerText);
  u.rate = 0.92;
  speechSynthesis.speak(u);
  toast("Reading insight aloud");
});
// ---------------------------------------------------------------------------
// Task inbox and deadline-aware scheduling
// ---------------------------------------------------------------------------
function normalizeTask(t) {
  return {
    id: t.id || crypto.randomUUID?.() || String(Date.now() + Math.random()),
    name: String(t.name || "Untitled task").trim(),
    due: t.due || new Date().toISOString().slice(0, 10),
    hours: Math.max(0.5, +t.hours || 1),
    remaining: Math.max(0.5, +t.remaining || +t.hours || 1),
    priority: ["high", "medium", "low"].includes(t.priority)
      ? t.priority
      : "medium",
    split: t.split === true || String(t.splittable).toLowerCase() === "yes",
    session: Math.max(0.5, +t.session || 0.5),
  };
}
function taskCardHTML(task) {
  const isOverdue = daysUntil(task.due) < 0;
  const remainingHours = task.remaining ?? task.hours;
  const dueLabel = new Date(`${task.due}T12:00:00`).toLocaleDateString();

  return `
    <article class="task-item ${isOverdue ? "overdue" : ""}">
      <div>
        <h3>${escapeHTML(task.name)}</h3>
        <div class="task-meta">
          <span class="${task.priority}">${task.priority}</span>
          <span>${remainingHours.toFixed(1)}h remaining</span>
          <span>due ${dueLabel}</span>
          <span>${task.split ? "splittable" : "one block"}</span>
        </div>
      </div>
      <button
        class="task-delete"
        data-delete-task="${escapeHTML(task.id)}"
        aria-label="Delete ${escapeHTML(task.name)}"
      >×</button>
    </article>
  `;
}

function renderTasks() {
  state.tasks = state.tasks.map(normalizeTask);
  const tasks = [...state.tasks].sort(taskSort);
  $("#taskCount").textContent =
    `${tasks.length} open task${tasks.length === 1 ? "" : "s"}`;
  $("#taskList").innerHTML = tasks.length
    ? tasks.map(taskCardHTML).join("")
    : `
      <div class="empty-tasks">
        No tasks yet. Add one real deadline to start.
      </div>
    `;
  $$("[data-delete-task]").forEach((b) =>
    b.addEventListener("click", () => {
      state.tasks = state.tasks.filter((t) => t.id !== b.dataset.deleteTask);
      save();
      renderTasks();
      renderDashboard();
    }),
  );
  $("#scheduleReport").hidden = !state.taskPlan;
  $("#applyTaskPlan").hidden = !state.taskPlan;
}
$("#addTask").addEventListener("click", () => {
  const name = $("#taskName").value.trim(),
    due = $("#taskDue").value;
  if (!name || !due) {
    toast("Add a task name and due date");
    return;
  }
  state.tasks.push(
    normalizeTask({
      name,
      due,
      hours: +$("#taskHours").value,
      priority: $("#taskPriority").value,
      split: $("#taskSplit").checked,
      session: +$("#taskSession").value,
    }),
  );
  state.taskPlan = null;
  save();
  renderTasks();
  renderDashboard();
  $("#taskName").value = "";
  toast("Task added locally");
});
function parseTaskLines(text) {
  const lines = text
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean),
    out = [];
  for (const line of lines) {
    const p = line.includes("|")
      ? line.split("|").map((x) => x.trim())
      : line.split(",").map((x) => x.trim());
    if (p.length < 3 || /^(name|task)$/i.test(p[0])) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p[1])) continue;
    out.push(
      normalizeTask({
        name: p[0],
        due: p[1],
        hours: +p[2],
        priority: (p[3] || "medium").toLowerCase(),
        splittable: p[4] || "yes",
      }),
    );
  }
  return out;
}
function importTaskText(text) {
  const tasks = parseTaskLines(text);
  state.tasks.push(...tasks);
  state.taskPlan = null;
  save();
  renderTasks();
  renderDashboard();
  $("#taskImportStatus").textContent =
    `Imported ${tasks.length} verified-format task${tasks.length === 1 ? "" : "s"}. Review every deadline and estimate.`;
}
$("#parseTasks").addEventListener("click", () =>
  importTaskText($("#taskPaste").value),
);
$("#taskFile").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (f) importTaskText(await f.text());
});
function buildTaskPlan() {
  return buildDeadlinePlan(state.week, state.tasks, new Date());
}
function scheduledDayHTML(group) {
  const names = group.items.map((item) => escapeHTML(item.name)).join(", ");
  const hours = group.items.reduce((total, item) => total + item.hours, 0);

  return `
    <div class="schedule-row">
      <b>${group.day}</b>
      <span>${names}</span>
      <strong>${hours.toFixed(1)}h</strong>
    </div>
  `;
}

function unscheduledTasksHTML(items) {
  if (items.length === 0) return "";
  const lines = items
    .map(
      (item) => `
        ${escapeHTML(item.task.name)}: ${item.hours.toFixed(1)}h unscheduled —
        ${escapeHTML(item.reason)}
      `,
    )
    .join("<br>");
  return `<div class="schedule-warning">${lines}</div>`;
}

function showTaskPlan(plan) {
  const grouped = state.week
    .map((d, i) => ({
      day: d.day,
      items: plan.entries.filter((e) => e.day === i),
    }))
    .filter((g) => g.items.length);
  const scheduledHours = plan.entries.reduce(
    (total, entry) => total + entry.hours,
    0,
  );

  $("#scheduleReport").hidden = false;
  $("#scheduleReport").innerHTML = `
    <strong>${scheduledHours.toFixed(1)}h placed before deadlines</strong>
    ${grouped.map(scheduledDayHTML).join("")}
    ${unscheduledTasksHTML(plan.unscheduled)}
  `;
  $("#applyTaskPlan").hidden = !plan.entries.length;
}
$("#scheduleTasks").addEventListener("click", () => {
  state.taskPlan = buildTaskPlan();
  save();
  showTaskPlan(state.taskPlan);
});
$("#applyTaskPlan").addEventListener("click", () => {
  if (!state.taskPlan) return;
  state.week.forEach(
    (d, i) =>
      (d.flex = state.taskPlan.entries
        .filter((e) => e.day === i)
        .reduce((s, e) => s + e.hours, 0)),
  );
  save();
  renderDashboard();
  toast("Deadline-safe task blocks applied to Capacity Map");
});
$("#notifyBtn").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    toast("Notifications unavailable");
    return;
  }
  const p = await Notification.requestPermission();
  if (p === "granted") {
    new Notification("MARGIN alerts enabled", {
      body: "You will only receive alerts you request from this device.",
    });
    $("#notifyBtn").textContent = "Alerts enabled";
  } else toast("Notification permission was not granted");
});
// ---------------------------------------------------------------------------
// Week Lab: manual scenarios, calendar import and whole-week rescue
// ---------------------------------------------------------------------------
function renderWeekLab() {
  const days = state.week;
  $("#dayPicker").innerHTML = days
    .map(
      (d, i) =>
        `<button class="${i === selectedDay ? "active" : ""}" data-day="${i}">${d.day}<br>${d.date}</button>`,
    )
    .join("");
  $$("#dayPicker button").forEach((b) =>
    b.addEventListener("click", () => {
      selectedDay = +b.dataset.day;
      scenario = { ...state.week[selectedDay] };
      renderWeekLab();
    }),
  );
  ["sleep", "fixed", "flex", "care", "commute"].forEach((k) => {
    $(`#${k}Input`).value = scenario[k];
    $(`#${k}Out`).textContent = `${scenario[k]}h`;
  });
  renderScenario();
}
["sleep", "fixed", "flex", "care", "commute"].forEach((k) =>
  $(`#${k}Input`).addEventListener("input", (e) => {
    scenario[k] = +e.target.value;
    $(`#${k}Out`).textContent = `${scenario[k]}h`;
    renderScenario();
  }),
);
function renderScenario() {
  const before = calc(state.week[selectedDay]),
    after = calc(scenario),
    delta = after.margin - before.margin;
  $("#scenarioTitle").textContent =
    `${state.week[selectedDay].day}: test a safer shape.`;
  const width = (v) => `${Math.max(4, Math.min(100, 50 + v * 7))}%`;
  $("#beforeBar").style.width = width(before.margin);
  $("#afterBar").style.width = width(after.margin);
  $("#beforeValue").textContent = fmt(before.margin);
  $("#afterValue").textContent = fmt(after.margin);
  let scenarioMessage =
    "This plan keeps a usable recovery margin without pretending every hour is productive.";
  if (after.level === "red") {
    scenarioMessage =
      "This scenario still creates capacity debt. Keep reducing flexible demand or protect more sleep.";
  } else if (after.level === "amber") {
    scenarioMessage = "This is safer, but the margin remains thin.";
  }

  const deltaLabel = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`;
  $("#scenarioVerdict").innerHTML = `
    <strong>${deltaLabel} hours of breathing room</strong>
    <p>${scenarioMessage}</p>
  `;
  $("#scenarioWhy").innerHTML = [
    ["Waking time", `${after.waking.toFixed(1)}h`],
    ["Capacity after fixed life", `${after.available.toFixed(1)}h`],
    ["Friction-adjusted demand", `${after.demand.toFixed(1)}h`],
    ["Recovery reserve", "2.0h protected"],
  ]
    .map(
      (x) =>
        `<div class="why-row"><span>${x[0]}</span><strong>${x[1]}</strong></div>`,
    )
    .join("");
  const moves = [];
  if (scenario.sleep < 7)
    moves.push(["Protect 30 more minutes of sleep", "+0.5h"]);
  if (scenario.flex > 2)
    moves.push(["Move 60 minutes of flexible work", "+1.0h"]);
  if (scenario.commute > 1)
    moves.push(["Combine or remote one trip", "up to +0.5h"]);
  if (scenario.fixed > 8)
    moves.push(["Ask which fixed block can flex", "conversation"]);
  moves.push(["Keep the recovery reserve untouched", "protect 2.0h"]);
  $("#moveSuggestions").innerHTML = moves
    .slice(0, 4)
    .map(
      (x) =>
        `<div class="suggestion-row"><p>${x[0]}</p><strong>${x[1]}</strong></div>`,
    )
    .join("");
}
$("#resetScenario").addEventListener("click", () => {
  scenario = { ...state.week[selectedDay] };
  renderWeekLab();
});
$("#saveScenario").addEventListener("click", () => {
  state.week[selectedDay] = { ...scenario };
  save();
  renderDashboard();
  renderWeekLab();
  toast(`${state.week[selectedDay].day} updated safely`);
});
function optimizeWeek(source) {
  return optimiseFlexibleWeek(source);
}
$("#rescueWeek").addEventListener("click", () => {
  const o = optimizeWeek(state.week);
  rescuedWeek = o.week;
  const grouped = [];
  o.moves.forEach((m) => {
    const k = `${m.from} → ${m.to}`,
      g = grouped.find((x) => x.k === k);
    if (g) g.h += m.hours;
    else grouped.push({ k, h: m.hours });
  });
  const rescuedHours = o.beforeDebt - o.afterDebt;
  const moveRows = grouped
    .slice(0, 6)
    .map(
      (group) => `
        <div class="rescue-move">
          <span>${group.k}</span>
          <b>${group.h.toFixed(1)}h moved</b>
        </div>
      `,
    )
    .join("");

  $("#rescueReport").hidden = false;
  $("#rescueReport").innerHTML = `
    <strong>${rescuedHours.toFixed(1)}h less capacity debt</strong>
    <p>
      Redline days: ${o.beforeRed} before, ${o.afterRed} after. Flexible work
      only was moved; sleep, fixed commitments, care and commuting were
      untouched.
    </p>
    ${moveRows}
    <p>Check every suggested move against real deadlines before applying it.</p>
  `;
  $("#applyRescue").hidden = !o.moves.length;
  if (!o.moves.length)
    toast("No safe redistribution found without changing fixed life");
});
$("#applyRescue").addEventListener("click", () => {
  if (!rescuedWeek) return;
  state.week = structuredClone(rescuedWeek);
  scenario = { ...state.week[selectedDay] };
  save();
  renderDashboard();
  renderWeekLab();
  $("#rescueReport").hidden = false;
  toast("Rescued week applied locally");
});
function parseICSDate(raw) {
  const m = raw?.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/);
  if (!m) return null;
  return new Date(
    +m[1],
    +m[2] - 1,
    +m[3],
    +(m[4] || 0),
    +(m[5] || 0),
    +(m[6] || 0),
  );
}
$("#calendarImport").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = (await file.text()).replace(/\r?\n[ \t]/g, ""),
      events = [...text.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].map(
        (x) => x[1],
      );
    let added = 0,
      count = 0;
    for (const block of events) {
      const start = parseICSDate(block.match(/DTSTART[^:]*:([^\r\n]+)/)?.[1]),
        end = parseICSDate(block.match(/DTEND[^:]*:([^\r\n]+)/)?.[1]);
      if (!start || !end || end <= start) continue;
      const idx = (start.getDay() + 6) % 7,
        h = Math.min(12, (end - start) / 36e5);
      state.week[idx].fixed = Math.min(14, state.week[idx].fixed + h);
      added += h;
      count++;
    }
    save();
    scenario = { ...state.week[selectedDay] };
    renderDashboard();
    renderWeekLab();
    $("#calendarStatus").textContent =
      `Imported ${count} events and counted ${added.toFixed(1)} fixed hours locally.`;
  } catch {
    $("#calendarStatus").textContent =
      "That calendar could not be read. Export it as a standard .ics file and try again.";
  }
});
$("#exportCalendar").addEventListener("click", () => {
  const pad = (n) => String(n).padStart(2, "0"),
    base = new Date(2026, 7, 10),
    lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MARGIN//Safer Week//EN",
    ];
  state.week.forEach((d, i) => {
    const date = new Date(base);
    date.setDate(base.getDate() + i);
    const ds = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
      flexMinutes = Math.round(d.flex * 60),
      endH = 14 + Math.floor(flexMinutes / 60),
      endM = flexMinutes % 60;
    lines.push(
      "BEGIN:VEVENT",
      `UID:margin-flex-${i}@local`,
      `DTSTART:${ds}T140000`,
      `DTEND:${ds}T${pad(Math.min(23, endH))}${pad(endM)}00`,
      `SUMMARY:MARGIN flexible work block (${d.flex.toFixed(1)}h)`,
      "DESCRIPTION:Review this suggested block against real deadlines.",
      "END:VEVENT",
      "BEGIN:VEVENT",
      `UID:margin-recovery-${i}@local`,
      `DTSTART:${ds}T200000`,
      `DTEND:${ds}T220000`,
      "SUMMARY:Protected recovery margin",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  downloadBlob(blob, "margin-safer-week.ics");
  $("#calendarStatus").textContent =
    "Safer week exported. Review times before adding it to your calendar.";
});
// ---------------------------------------------------------------------------
// Reset Lab: a small contextual bandit trained only by explicit feedback
// ---------------------------------------------------------------------------
function bindChoice(group, key, attr) {
  $$(`${group} button`).forEach((b) =>
    b.addEventListener("click", () => {
      $$(`${group} button`).forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      resetContext[key] =
        attr === "minutes" ? +b.dataset[attr] : b.dataset[attr];
    }),
  );
}
bindChoice("#timeChoices", "minutes", "minutes");
bindChoice("#resetEnergy", "energy", "energy");
bindChoice("#placeChoices", "place", "place");
$("#quietOnly").addEventListener(
  "change",
  (e) => (resetContext.quiet = e.target.checked),
);
function contextKey() {
  return `${resetContext.energy}:${resetContext.place}:${resetContext.quiet ? "quiet" : "any"}`;
}
function actionScore(a) {
  if (a.minutes > resetContext.minutes) return -999;
  let s = 45 + (resetContext.minutes - a.minutes) * 1.2;
  if (a.energy.includes(resetContext.energy)) s += 16;
  else s -= 8;
  if (a.places.includes(resetContext.place)) s += 15;
  else s -= 12;
  if (resetContext.quiet && a.silent) s += 10;
  if (resetContext.quiet && !a.silent) s -= 25;
  const learned = state.learning?.[a.id]?.[contextKey()];
  if (learned) s += (learned.mean - 0.5) * 36;
  if (state.recent.includes(a.id)) s -= 14;
  return s;
}
function renderRecommendation(find = true) {
  if (!find && !currentAction) return;
  const ranked = actions
    .map((a) => ({ ...a, score: actionScore(a) }))
    .filter((a) => a.score > -100)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) {
    $("#recommendation").innerHTML =
      '<span class="rec-icon">↺</span><h2>Try a little more time or fewer constraints.</h2><p>No action in the local library fits all selected limits safely.</p>';
    return;
  }
  currentAction = ranked[0];
  const r = currentAction;
  $("#recommendation").classList.remove("empty-rec");
  $("#recommendation").innerHTML =
    `<span class="rec-icon">${r.silent ? "◌" : "↗"}</span><h2>${r.title}</h2><p>${r.steps}</p><p class="rec-why">Why this: ${r.reason}</p>`;
  $("#timerBox").hidden = false;
  $("#feedbackBox").hidden = false;
  timeLeft = r.minutes * 60;
  updateTimer();
  $("#learningBadge").textContent = state.learning?.[r.id]?.[contextKey()]
    ? "Adapted to feedback"
    : "First local estimate";
}
$("#findReset").addEventListener("click", () => {
  resetContext.quiet = $("#quietOnly").checked;
  renderRecommendation(true);
});
function updateTimer() {
  const m = Math.floor(timeLeft / 60),
    s = timeLeft % 60;
  $("#timerDisplay").textContent =
    `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
$("#timerBtn").addEventListener("click", () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    $("#timerBtn").textContent = "Resume";
    return;
  }
  $("#timerBtn").textContent = "Pause";
  timer = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) {
      clearInterval(timer);
      timer = null;
      $("#timerBtn").textContent = "Done";
      toast("Reset complete — notice, do not grade yourself");
    }
  }, 1000);
});
$$("[data-feedback]").forEach((b) =>
  b.addEventListener("click", () => {
    if (!currentAction) return;
    state.learning[currentAction.id] ??= {};
    const k = contextKey(),
      old = state.learning[currentAction.id][k] || { n: 0, mean: 0.5 },
      reward = b.dataset.feedback === "yes" ? 1 : 0;
    old.mean = (old.mean * old.n + reward) / (old.n + 1);
    old.n++;
    state.learning[currentAction.id][k] = old;
    state.recent = [
      currentAction.id,
      ...state.recent.filter((x) => x !== currentAction.id),
    ].slice(0, 2);
    if (reward) state.helpfulWins = (state.helpfulWins || 0) + 1;
    save();
    renderFootprints();
    toast(
      reward
        ? "Helpful moment saved — no streak required"
        : "Feedback learned without judgment",
    );
    renderRecommendation(true);
  }),
);
// ---------------------------------------------------------------------------
// Support, privacy-preserving sharing and encrypted device transfer
// ---------------------------------------------------------------------------
function renderSupport() {
  const s = state.support;
  $("#supportName").value = s.name;
  $("#overloadSigns").value = s.signs;
  $("#helpfulActions").value = s.help;
  $("#avoidActions").value = s.avoid;
  $("#resourceName").value = state.resource?.name || "";
  $("#resourceContact").value = state.resource?.contact || "";
  updateSupportPreview();
  renderResource();
  renderCampusResources();
}
function renderResource() {
  const r = state.resource || {};
  $("#savedResource").innerHTML =
    r.name || r.contact
      ? `<div class="resource-pill"><strong>${r.name || "Trusted support"}</strong><span>${r.contact || "Contact details not added"}</span></div>`
      : "";
}
function campusResourceHTML(resource) {
  const verification = resource.verifiedBy
    ? `Pack states: verified by ${escapeHTML(resource.verifiedBy)}`
    : "Verification not supplied";

  return `
    <article class="campus-resource">
      <strong>${escapeHTML(resource.name || "Resource")}</strong>
      <span>${escapeHTML(resource.contact || "No contact")}</span>
      <span>${escapeHTML(resource.hours || "Hours not supplied")}</span>
      <span>${verification}</span>
    </article>
  `;
}

function renderCampusResources() {
  const list = state.resourcePack || [];
  $("#campusResources").innerHTML = list.length
    ? list.map(campusResourceHTML).join("")
    : `
      <article class="campus-resource">
        <strong>No resource pack imported</strong>
        <span>Add only packs from a school or community you trust.</span>
      </article>
    `;
}
function updateSupportPreview() {
  const s = {
    name: $("#supportName").value.trim(),
    signs: $("#overloadSigns").value.trim(),
    help: $("#helpfulActions").value.trim(),
    avoid: $("#avoidActions").value.trim(),
  };
  $("#previewName").textContent = s.name
    ? `How to support ${s.name}`
    : "A small guide for a hard moment";
  $("#previewSigns").textContent =
    s.signs || "I may have less capacity than usual.";
  $("#previewHelp").textContent = s.help || "Ask what kind of support I want.";
  $("#previewAvoid").textContent =
    s.avoid || "Assuming silence means I do not care.";
  return s;
}
["supportName", "overloadSigns", "helpfulActions", "avoidActions"].forEach(
  (id) => $(`#${id}`).addEventListener("input", updateSupportPreview),
);
$("#updateCard").addEventListener("click", () => {
  state.support = updateSupportPreview();
  save();
  toast("Support Card saved locally");
});
$("#clearSupport").addEventListener("click", () => {
  state.support = { name: "", signs: "", help: "", avoid: "" };
  renderSupport();
  save();
  toast("Support Card cleared");
});
$("#copyCard").addEventListener("click", async () => {
  const s = updateSupportPreview();
  const txt = [
    `How to support ${s.name || "me"}`,
    `You may notice: ${s.signs || "I may have less capacity than usual."}`,
    `What helps: ${s.help || "Ask what kind of support I want."}`,
    `Please avoid: ${s.avoid || "Assuming silence means I do not care."}`,
  ].join("\n\n");
  try {
    await copyText(txt);
    toast("Support Card copied");
  } catch {
    toast("Clipboard unavailable");
  }
});
$("#printCard").addEventListener("click", () => window.print());
function canvasWrap(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(text).split(/\s+/);
  let line = "",
    lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  lines
    .slice(0, maxLines)
    .forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + Math.min(lines.length, maxLines) * lineHeight;
}
$("#downloadCard").addEventListener("click", () => {
  const s = updateSupportPreview(),
    c = document.createElement("canvas");
  c.width = 1200;
  c.height = 675;
  const x = c.getContext("2d");
  x.fillStyle = "#18201d";
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#d8f36a";
  x.beginPath();
  x.arc(1080, 90, 42, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = "#18201d";
  x.font = "900 36px system-ui";
  x.textAlign = "center";
  x.fillText("M", 1080, 103);
  x.textAlign = "left";
  x.fillStyle = "#d8f36a";
  x.font = "800 18px system-ui";
  x.fillText("HOW TO SUPPORT ME", 70, 75);
  x.fillStyle = "#ffffff";
  x.font = "700 48px system-ui";
  x.fillText(
    s.name ? `How to support ${s.name}` : "A small guide for a hard moment",
    70,
    145,
  );
  const blocks = [
    ["YOU MAY NOTICE", s.signs || "I may have less capacity than usual."],
    ["WHAT HELPS", s.help || "Ask what kind of support I want."],
    ["PLEASE AVOID", s.avoid || "Assuming silence means I do not care."],
  ];
  let y = 225;
  blocks.forEach(([h, t]) => {
    x.fillStyle = "#98aaa2";
    x.font = "800 15px system-ui";
    x.fillText(h, 70, y);
    x.fillStyle = "#ffffff";
    x.font = "24px system-ui";
    y = canvasWrap(x, t, 70, y + 38, 1030, 32, 3) + 35;
  });
  x.fillStyle = "#98aaa2";
  x.font = "15px system-ui";
  x.fillText(
    "This card shares preferences, not a diagnosis. Created privately with MARGIN.",
    70,
    630,
  );
  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = "margin-support-card.png";
  a.style.display = "none";
  document.body.append(a);
  a.click();
  a.remove();
  toast("Support Card image downloaded");
});
$("#generateBoundary").addEventListener("click", () => {
  const audience = $("#boundaryAudience").value,
    request = $("#boundaryRequest").value,
    alt =
      $("#boundaryDate").value.trim() || "a short alternative we can agree on",
    hello =
      audience === "lecturer"
        ? "Hello,"
        : audience === "manager"
          ? "Hello,"
          : "Hi team,",
    context =
      audience === "team"
        ? "I have reviewed our current workload and my available capacity."
        : "I am writing early because several fixed commitments have created a temporary capacity conflict.",
    ask =
      request === "extension"
        ? `Could we agree on a short extension, ideally ${alt}?`
        : request === "scope"
          ? `Could we reduce the immediate scope to ${alt}?`
          : request === "meeting"
            ? `Could we have a brief meeting to reprioritize, ideally ${alt}?`
            : `Could we adjust the schedule or shift to ${alt}?`;
  $("#boundaryOutput").value = [
    hello,
    `${context} I want to communicate before this affects the quality or reliability of my work.`,
    ask,
    "I can still complete the highest-priority part and will confirm the revised plan clearly. I prefer to keep personal details private, but I am raising the conflict as early as possible.",
    "Thank you for considering this request.",
  ].join("\n\n");
});
$("#copyBoundary").addEventListener("click", async () => {
  if (!$("#boundaryOutput").value) {
    toast("Generate a draft first");
    return;
  }
  try {
    await copyText($("#boundaryOutput").value);
    toast("Boundary message copied");
  } catch {
    toast("Clipboard unavailable");
  }
});
$("#makeAvailability").addEventListener("click", () => {
  const lines = state.week
    .map((d, i) => ({ d, r: calc(d), i }))
    .filter((x) => x.r.level !== "red" && x.r.margin >= 1)
    .map(
      (x) =>
        `${x.d.day}: up to ${Math.floor(x.r.margin * 2) / 2}h available for study or meetings`,
    );
  $("#availabilityOutput").value = [
    "My current MARGIN availability",
    lines.join("\n"),
    "This shares availability only—not sleep, stress, energy, care duties or private check-ins. Times still need confirmation.",
  ].join("\n\n");
});
$("#copyAvailability").addEventListener("click", async () => {
  if (!$("#availabilityOutput").value) $("#makeAvailability").click();
  try {
    await copyText($("#availabilityOutput").value);
    toast("Availability copied without wellness data");
  } catch {
    toast("Clipboard unavailable");
  }
});
const bytesToB64 = (a) => btoa(String.fromCharCode(...a)),
  b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function deriveKey(pass, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pass),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
$("#encryptExport").addEventListener("click", async () => {
  const pass = $("#transferPass").value;
  if (pass.length < 8) {
    $("#transferStatus").textContent = "Use at least eight characters.";
    return;
  }
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16)),
      iv = crypto.getRandomValues(new Uint8Array(12)),
      key = await deriveKey(pass, salt),
      data = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(JSON.stringify(state)),
      ),
      payload = {
        format: "MARGIN-encrypted-v1",
        salt: bytesToB64(salt),
        iv: bytesToB64(iv),
        data: bytesToB64(new Uint8Array(data)),
      },
      blob = new Blob([JSON.stringify(payload)], { type: "application/json" });

    const filename = "margin-encrypted-transfer.margin";
    const downloadUrl = downloadBlob(blob, filename, 10 * 60 * 1_000);
    const fallbackLink = $("#transferDownload");
    fallbackLink.href = downloadUrl;
    fallbackLink.download = filename;
    fallbackLink.hidden = false;
    $("#transferStatus").textContent =
      "Encrypted transfer created. If the download did not start, use the button below.";
  } catch {
    $("#transferStatus").textContent =
      "Encryption is unavailable in this browser.";
  }
});
$("#encryptedImport").addEventListener("change", async (e) => {
  const file = e.target.files?.[0],
    pass = $("#transferPass").value;
  if (!file) return;
  if (pass.length < 8) {
    $("#transferStatus").textContent = "Enter the transfer passphrase first.";
    return;
  }
  try {
    const p = JSON.parse(await file.text());
    if (p.format !== "MARGIN-encrypted-v1") throw Error();
    const key = await deriveKey(pass, b64ToBytes(p.salt)),
      plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64ToBytes(p.iv) },
        key,
        b64ToBytes(p.data),
      ),
      incoming = JSON.parse(new TextDecoder().decode(plain));
    if (!Array.isArray(incoming.week)) throw Error();
    state = incoming;
    state.tasks ??= [];
    state.resourcePack ??= [];
    save();
    renderDashboard();
    renderSupport();
    $("#transferStatus").textContent = "Encrypted data imported successfully.";
  } catch {
    $("#transferStatus").textContent =
      "Could not decrypt. Check the file and passphrase.";
  }
});
$("#resourcePackImport").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const p = JSON.parse(await f.text()),
      list = Array.isArray(p) ? p : p.resources;
    if (!Array.isArray(list)) throw Error();
    state.resourcePack = list.slice(0, 50).map((r) => ({
      name: String(r.name || "Resource"),
      contact: String(r.contact || ""),
      hours: String(r.hours || ""),
      verifiedBy: String(r.verifiedBy || ""),
    }));
    save();
    renderCampusResources();
    toast(
      `${state.resourcePack.length} local resources imported — verify the source`,
    );
  } catch {
    toast("Resource pack must be valid JSON with a resources array");
  }
});
$("#exportResourcePack").addEventListener("click", () => {
  const resources = [...(state.resourcePack || [])];
  if (state.resource?.name || state.resource?.contact)
    resources.unshift({
      name: state.resource.name || "Trusted support",
      contact: state.resource.contact || "",
      hours: "",
      verifiedBy: "Added personally on this device",
    });
  const contents = JSON.stringify(
    { format: "MARGIN-resource-pack-v1", resources },
    null,
    2,
  );
  const blob = new Blob([contents], { type: "application/json" });
  downloadBlob(blob, "margin-resource-pack.json");
  toast("Resource pack exported");
});
$("#saveResource").addEventListener("click", () => {
  state.resource = {
    name: $("#resourceName").value.trim(),
    contact: $("#resourceContact").value.trim(),
  };
  save();
  renderResource();
  toast("Human support saved locally");
});
$("#exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `margin-data-${Date.now()}.json`);
  toast("Local data export created");
});
$("#deleteData").addEventListener("click", () => {
  if (
    confirm("Delete this week, check-ins, Support Card and local learning?")
  ) {
    localStorage.removeItem(STORE);
    state = fresh();
    save();
    renderDashboard();
    renderSupport();
    toast("All local MARGIN data deleted");
  }
});
// ---------------------------------------------------------------------------
// First-run tour. It explains the product loop instead of exposing every
// feature at once.
// ---------------------------------------------------------------------------
const tourSteps = [
  {
    title: "See what your week can honestly hold.",
    copy: "The Capacity Map counts fixed life, flexible work, care, commuting, sleep and a recovery reserve.",
    view: "today",
  },
  {
    title: "Give real tasks real deadlines.",
    copy: "Task Inbox builds a plan before deadlines and leaves work visible when it cannot fit.",
    view: "tasks",
  },
  {
    title: "Rescue the plan, not your worth.",
    copy: "Week Lab moves only flexible work. Sleep, fixed commitments and care remain protected.",
    view: "week",
  },
  {
    title: "Learn from what actually helps.",
    copy: "Reset Lab adapts from explicit feedback on this device. There are no streaks, diagnosis or hidden tracking.",
    view: "reset",
  },
];
let tourIndex = 0;
function renderTour() {
  const step = tourSteps[tourIndex];
  $("#tourNumber").textContent = `${tourIndex + 1} OF ${tourSteps.length}`;
  $("#tourTitle").textContent = step.title;
  $("#tourCopy").textContent = step.copy;
  $("#tourBack").disabled = tourIndex === 0;
  $("#tourNext").innerHTML =
    tourIndex === tourSteps.length - 1
      ? "Start using MARGIN <span>→</span>"
      : "Next <span>→</span>";
}
function openTour() {
  closeDrawer();
  tourIndex = 0;
  renderTour();
  $("#tourOverlay").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeTour() {
  $("#tourOverlay").hidden = true;
  document.body.style.overflow = "";
  localStorage.setItem("margin-tour-seen", "yes");
}
$("#tourBtn").addEventListener("click", openTour);
$("#closeTour").addEventListener("click", closeTour);
$("#tourBack").addEventListener("click", () => {
  if (tourIndex > 0) tourIndex -= 1;
  renderTour();
});
$("#tourNext").addEventListener("click", () => {
  if (tourIndex < tourSteps.length - 1) {
    tourIndex += 1;
    renderTour();
    return;
  }
  const destination = tourSteps[tourIndex].view;
  closeTour();
  showView(destination);
  localStorage.setItem("margin-tour-seen", "yes");
});

// ---------------------------------------------------------------------------
// Calm Now deliberately shows one instruction at a time.
// ---------------------------------------------------------------------------
const calmSteps = [
  {
    title: "Nothing else is required for this minute.",
    copy: "Put both feet somewhere supported. Let the screen wait.",
    breathe: false,
    next: "One next step",
  },
  {
    title: "Make the exhale a little longer.",
    copy: "Breathe normally. If it feels comfortable, let the next few exhales last slightly longer than the inhales. Stop if you feel dizzy.",
    breathe: true,
    next: "I am ready",
  },
  {
    title: "Choose only what comes next.",
    copy: "Not the whole day. Not the whole problem. Name one physical action small enough to begin in two minutes.",
    breathe: false,
    next: "One final step",
  },
  {
    title: "Continue, pause, or ask for a person.",
    copy: "All three are valid. The goal is not to feel perfect; it is to reduce the next moment’s load.",
    breathe: false,
    next: "Close Calm Now",
  },
];
let calmIndex = 0;
function renderCalm() {
  const s = calmSteps[calmIndex];
  $("#calmNumber").textContent = `STEP ${calmIndex + 1} OF ${calmSteps.length}`;
  $("#calmTitle").textContent = s.title;
  $("#calmCopy").textContent = s.copy;
  $("#calmProgress").style.width =
    `${((calmIndex + 1) / calmSteps.length) * 100}%`;
  $("#breathingPacer").hidden = !s.breathe;
  $("#calmBack").disabled = calmIndex === 0;
  $("#calmNext").innerHTML = `${s.next} <span>→</span>`;
}
$("#calmNowBtn").addEventListener("click", () => {
  calmIndex = 0;
  renderCalm();
  $("#calmOverlay").hidden = false;
  document.body.style.overflow = "hidden";
});
$("#closeCalm").addEventListener("click", () => {
  $("#calmOverlay").hidden = true;
  document.body.style.overflow = "";
});
$("#calmNext").addEventListener("click", () => {
  if (calmIndex === calmSteps.length - 1) {
    $("#calmOverlay").hidden = true;
    document.body.style.overflow = "";
    return;
  }
  calmIndex++;
  renderCalm();
});
$("#calmBack").addEventListener("click", () => {
  if (calmIndex > 0) {
    calmIndex--;
    renderCalm();
  }
});
$("#calmRead").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    toast("Read aloud unavailable");
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(
    `${calmSteps[calmIndex].title} ${calmSteps[calmIndex].copy}`,
  );
  u.rate = 0.86;
  speechSynthesis.speak(u);
});
$("#humanHelp").addEventListener("click", () => {
  $("#calmOverlay").hidden = true;
  document.body.style.overflow = "";
  showView("support");
  setTimeout(() => $("#resourceName").focus(), 350);
});
$("#accessBtn").addEventListener(
  "click",
  () => ($("#accessPanel").hidden = !$("#accessPanel").hidden),
);
$("#closeAccess").addEventListener(
  "click",
  () => ($("#accessPanel").hidden = true),
);
$("#contrastToggle").addEventListener("change", (e) => {
  state.settings.contrast = e.target.checked;
  applySettings();
});
$("#calmToggle").addEventListener("change", (e) => {
  state.settings.calm = e.target.checked;
  applySettings();
});
$$("[data-size]").forEach((b) =>
  b.addEventListener("click", () => {
    state.settings.size = b.dataset.size;
    $$("[data-size]").forEach((x) => x.classList.toggle("active", x === b));
    applySettings();
  }),
);
function applySettings() {
  document.body.classList.toggle("high-contrast", state.settings.contrast);
  document.body.classList.toggle("calm", state.settings.calm);
  document.body.classList.toggle("large-text", state.settings.size === "large");
  $("#contrastToggle").checked = state.settings.contrast;
  $("#calmToggle").checked = state.settings.calm;
  $$("[data-size]").forEach((b) =>
    b.classList.toggle("active", b.dataset.size === state.settings.size),
  );
  save();
}
renderDashboard();
applySettings();
if (!localStorage.getItem("margin-tour-seen")) {
  setTimeout(openTour, 650);
}
if ("serviceWorker" in navigator) {
  let refreshingForUpdate = false;

  navigator.serviceWorker.addEventListener?.("controllerchange", () => {
    if (refreshingForUpdate) return;
    refreshingForUpdate = true;
    window.location.reload();
  });

  addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      const updateRequest = registration.update?.();
      updateRequest?.catch(() => {});
    });
  });
}
