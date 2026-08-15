import {
  buildDeadlinePlan,
  calculateCapacity,
  optimiseFlexibleWeek,
} from "./core.js";

const results = document.querySelector("#results");
let passed = 0;

function check(name, assertion) {
  const item = document.createElement("li");
  try {
    if (!assertion()) throw new Error("Assertion returned false");
    item.className = "pass";
    item.textContent = `Passed — ${name}`;
    passed += 1;
  } catch (error) {
    item.className = "fail";
    item.textContent = `Failed — ${name}: ${error.message}`;
  }
  results.append(item);
}

const baseDay = {
  day: "Mon",
  sleep: 8,
  fixed: 6,
  flex: 2,
  care: 1,
  commute: 1,
  energy: 4,
  stress: 2,
};

check("usable margin stays positive on a modest day", () => {
  return calculateCapacity(baseDay).margin > 2;
});

check("overload remains visible as capacity debt", () => {
  return (
    calculateCapacity({
      ...baseDay,
      sleep: 5,
      fixed: 10,
      flex: 7,
      energy: 1,
      stress: 5,
    }).debt > 0
  );
});

check("whole-week rescue never increases capacity debt", () => {
  const week = [
    { ...baseDay, day: "Mon", flex: 7, stress: 5 },
    { ...baseDay, day: "Tue", fixed: 2, flex: 0 },
    { ...baseDay, day: "Wed", fixed: 3, flex: 0 },
  ];
  const result = optimiseFlexibleWeek(week);
  return result.afterDebt <= result.beforeDebt;
});

check("rescue preserves sleep and fixed commitments", () => {
  const week = [
    { ...baseDay, day: "Mon", flex: 7 },
    { ...baseDay, day: "Tue", fixed: 2, flex: 0 },
  ];
  const result = optimiseFlexibleWeek(week);
  return result.week.every(
    (day, index) =>
      day.sleep === week[index].sleep && day.fixed === week[index].fixed,
  );
});

check("task planner keeps work before its deadline", () => {
  const week = Array.from({ length: 7 }, (_, index) => ({
    ...baseDay,
    day: String(index),
    fixed: 2,
    flex: 0,
  }));
  const task = {
    id: "test",
    name: "Test task",
    due: "2026-08-11",
    hours: 3,
    remaining: 3,
    priority: "high",
    split: true,
    session: 0.5,
  };
  const plan = buildDeadlinePlan(week, [task], new Date("2026-08-10T12:00:00"));
  return (
    plan.entries.length > 0 && plan.entries.every((entry) => entry.day <= 1)
  );
});

document.querySelector("#score").textContent = `${passed} / 5 checks passed`;
document.body.dataset.complete = "true";
