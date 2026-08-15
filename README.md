# MARGIN

**Make room before burnout.**

MARGIN is a private, offline-first capacity planner for student life. It counts classes, paid work, flexible assignments, commuting, care duties, sleep and recovery in one explainable weekly model.

## Core experiences

- Seven-day Capacity Map with green, thin-margin and redline states
- Explainable Capacity Debt calculation
- Two-minute energy and stress check-in
- Week Lab before/after scenario simulator
- On-device contextual-bandit Reset Engine that learns only from explicit feedback
- Private Support Card for communicating needs
- Local data export and deletion
- High contrast, reduced motion, larger text and keyboard-friendly controls
- Installable offline PWA with no account, analytics or paid API

## Capacity model

Available capacity is calculated from waking time after fixed commitments, care duties, commuting and a two-hour recovery reserve. Flexible demand is adjusted by an explainable friction factor based on user-entered energy and stress. The result is a scheduling signal—not medical advice or diagnosis.

## Run locally

```bash
python3 -m http.server 8090
```

Then open `http://localhost:8090`.

## Privacy

All week data, check-ins, Support Card content and recommendation feedback remain in browser local storage unless the user explicitly exports them.

## Built for

CS Girlies Technology for Wellness 2026 and Build Beyond as a separate project from ProofScout.
