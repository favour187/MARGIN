import assert from "node:assert/strict";
import {
  buildDeadlinePlan,
  calculateCapacity,
  optimiseFlexibleWeek,
  sortTasksByDeadline,
  startOfWeek,
} from "../core.js";

const ordinaryDay = {
  day: "Mon",
  sleep: 8,
  fixed: 6,
  flex: 2,
  care: 1,
  commute: 1,
  energy: 4,
  stress: 2,
};

function test(name, run) {
  try {
    run();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("a rested day with modest demand keeps usable margin", () => {
  const result = calculateCapacity(ordinaryDay);
  assert.equal(result.level, "green");
  assert.ok(result.margin > 2);
});

test("capacity debt is visible rather than clipped to zero", () => {
  const result = calculateCapacity({
    ...ordinaryDay,
    sleep: 5,
    fixed: 10,
    flex: 7,
    energy: 1,
    stress: 5,
  });
  assert.equal(result.level, "red");
  assert.ok(result.debt > 0);
  assert.ok(result.margin < 0);
});

test("week optimisation never edits fixed life or sleep", () => {
  const week = [
    { ...ordinaryDay, day: "Mon", flex: 7, energy: 2, stress: 5 },
    { ...ordinaryDay, day: "Tue", fixed: 2, flex: 0, care: 0 },
    { ...ordinaryDay, day: "Wed", fixed: 3, flex: 0, care: 2 },
  ];
  const result = optimiseFlexibleWeek(week);

  week.forEach((day, index) => {
    assert.equal(result.week[index].fixed, day.fixed);
    assert.equal(result.week[index].sleep, day.sleep);
    assert.equal(result.week[index].care, day.care);
    assert.equal(result.week[index].commute, day.commute);
  });
  assert.ok(result.afterDebt <= result.beforeDebt);
});

test("tasks sort by deadline before priority", () => {
  const tasks = [
    { due: "2026-08-13", priority: "high" },
    { due: "2026-08-12", priority: "low" },
  ];
  tasks.sort(sortTasksByDeadline);
  assert.equal(tasks[0].due, "2026-08-12");
});

test("deadline scheduler does not place work after its deadline", () => {
  const week = Array.from({ length: 7 }, (_, index) => ({
    ...ordinaryDay,
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index],
    fixed: 2,
    flex: 0,
  }));
  const task = {
    id: "essay",
    name: "Essay",
    due: "2026-08-11",
    hours: 3,
    remaining: 3,
    priority: "high",
    split: true,
    session: 0.5,
  };
  const referenceMonday = new Date("2026-08-10T12:00:00");
  const plan = buildDeadlinePlan(week, [task], referenceMonday);
  assert.ok(plan.entries.length > 0);
  assert.ok(plan.entries.every((entry) => entry.day <= 1));
});

test("an unsplittable task remains unscheduled when no day can hold it", () => {
  const week = Array.from({ length: 7 }, (_, index) => ({
    ...ordinaryDay,
    day: String(index),
    fixed: 11,
    flex: 0,
  }));
  const task = {
    id: "large",
    name: "Large task",
    due: "2026-08-16",
    hours: 8,
    remaining: 8,
    priority: "high",
    split: false,
    session: 1,
  };
  const plan = buildDeadlinePlan(
    week,
    [task],
    new Date("2026-08-10T12:00:00"),
  );
  assert.equal(plan.entries.length, 0);
  assert.equal(plan.unscheduled.length, 1);
  assert.equal(plan.unscheduled[0].hours, 8);
});

test("startOfWeek always returns Monday", () => {
  assert.equal(startOfWeek(new Date("2026-08-15T12:00:00")).getDay(), 1);
});

console.log("\nAll MARGIN core tests passed.");
