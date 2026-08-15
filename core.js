// Core planning rules for MARGIN.
//
// These functions are deliberately free of browser APIs. Keeping the model
// separate from the interface makes it possible to test the scheduling rules
// without loading the application.

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export function calculateCapacity(day, recoveryReserve = 2) {
  const wakingHours = 24 - day.sleep;
  const availableHours =
    wakingHours - day.fixed - day.care - day.commute - recoveryReserve;

  // Low energy and high stress can make the same task take more effort. This
  // is an explicit user-controlled adjustment, not a clinical prediction.
  const friction = 1 + (5 - day.energy) * 0.11 + day.stress * 0.035;
  const adjustedDemand = day.flex * friction;
  const margin = availableHours - adjustedDemand;
  const debt = Math.max(0, -margin);

  let level = "green";
  if (debt > 1 || day.sleep < 5.75) level = "red";
  else if (margin < 2 || day.sleep < 7) level = "amber";

  return {
    reserve: recoveryReserve,
    waking: wakingHours,
    available: availableHours,
    demand: adjustedDemand,
    margin,
    debt,
    level,
    friction,
  };
}

export function sortTasksByDeadline(a, b) {
  const deadlineDifference = new Date(a.due) - new Date(b.due);
  if (deadlineDifference !== 0) return deadlineDifference;
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}

export function startOfWeek(referenceDate = new Date()) {
  const monday = new Date(referenceDate);
  monday.setHours(12, 0, 0, 0);
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday;
}

export function buildDeadlinePlan(week, tasks, referenceDate = new Date()) {
  const monday = startOfWeek(referenceDate);
  const dates = week.map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });

  // Named tasks replace the generic flexible-work estimate when a plan is
  // applied, so planning capacity is measured with flex set to zero here.
  const remainingCapacity = week.map((day) =>
    Math.max(0, calculateCapacity({ ...day, flex: 0 }).margin),
  );

  const entries = [];
  const unscheduled = [];

  for (const task of [...tasks].sort(sortTasksByDeadline)) {
    let hoursLeft = task.remaining ?? task.hours;
    const eligibleDays = dates
      .map((date, index) => ({ date, index }))
      .filter(({ date }) => date <= new Date(`${task.due}T23:59:59`));

    if (eligibleDays.length === 0) {
      unscheduled.push({
        task,
        hours: hoursLeft,
        reason: "deadline is before this visible week",
      });
      continue;
    }

    if (!task.split) {
      const bestDay = [...eligibleDays].sort(
        (a, b) => remainingCapacity[b.index] - remainingCapacity[a.index],
      )[0];

      if (bestDay && remainingCapacity[bestDay.index] >= hoursLeft) {
        entries.push({
          day: bestDay.index,
          taskId: task.id,
          name: task.name,
          hours: hoursLeft,
        });
        remainingCapacity[bestDay.index] -= hoursLeft;
        hoursLeft = 0;
      }
    } else {
      while (hoursLeft > 0.01) {
        const minimumSession = Math.min(task.session, hoursLeft);
        const candidates = eligibleDays
          .filter(({ index }) => remainingCapacity[index] >= minimumSession)
          .sort(
            (a, b) => remainingCapacity[b.index] - remainingCapacity[a.index],
          );

        if (candidates.length === 0) break;

        const bestDay = candidates[0];
        const sessionLength = Math.min(
          hoursLeft,
          remainingCapacity[bestDay.index],
          Math.max(task.session, 1.5),
        );

        entries.push({
          day: bestDay.index,
          taskId: task.id,
          name: task.name,
          hours: sessionLength,
        });
        remainingCapacity[bestDay.index] -= sessionLength;
        hoursLeft -= sessionLength;
      }
    }

    if (hoursLeft > 0.01) {
      unscheduled.push({
        task,
        hours: hoursLeft,
        reason: "not enough margin before deadline",
      });
    }
  }

  return { entries, unscheduled, createdAt: new Date().toISOString() };
}

export function optimiseFlexibleWeek(sourceWeek) {
  const proposedWeek = structuredClone(sourceWeek);
  const moves = [];

  // Move only flexible work, in small blocks, and stop when no receiving day
  // has enough spare margin. Fixed life and recovery are never altered here.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const results = proposedWeek.map(calculateCapacity);
    const source = results
      .map((result, index) => ({ ...result, index }))
      .filter(
        ({ index, margin }) => proposedWeek[index].flex >= 0.5 && margin < 2,
      )
      .sort((a, b) => a.margin - b.margin)[0];

    const destination = results
      .map((result, index) => ({ ...result, index }))
      .filter(({ index }) => !source || index !== source.index)
      .sort((a, b) => b.margin - a.margin)[0];

    if (!source || !destination || destination.margin < 2.2) break;

    proposedWeek[source.index].flex -= 0.5;
    proposedWeek[destination.index].flex += 0.5;
    moves.push({
      from: proposedWeek[source.index].day,
      to: proposedWeek[destination.index].day,
      hours: 0.5,
    });
  }

  const before = sourceWeek.map(calculateCapacity);
  const after = proposedWeek.map(calculateCapacity);

  return {
    week: proposedWeek,
    moves,
    beforeDebt: before.reduce((total, day) => total + day.debt, 0),
    afterDebt: after.reduce((total, day) => total + day.debt, 0),
    beforeRed: before.filter((day) => day.level === "red").length,
    afterRed: after.filter((day) => day.level === "red").length,
  };
}
