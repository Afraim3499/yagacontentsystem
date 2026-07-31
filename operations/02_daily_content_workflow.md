# Daily Content Workflow & Staggered Batch Distribution Engine

## 1. Add New Day Workflow

1. Owner initiates a new daily content batch for a target date (e.g. `2026-07-31`).
2. System loads active platforms, active creators, and platform cadences.
3. System generates base content rows and creator-specific caption fields.
4. Day status is initialized as `Draft`.

---

## 2. Content Volume & Staggered 3-Batch Distribution Logic

To optimize employee focus and smooth platform engagement, daily content is automatically divided into **3 staggered delivery batches**:

```text
OWNER PRESSES "SEND TO TEAM"
            │
            ├─► BATCH 1 (Immediate): Deliver 1/3 of daily posts to ALL creators
            │
            ├─► BATCH 2 (+30 Mins): Deliver 1/3 of daily posts to ALL creators
            │
            └─► BATCH 3 (+60 Mins): Deliver remaining 1/3 of daily posts to ALL creators
```

### Staggered Distribution Rules
- **Fair Distribution Guarantee:** Each batch distributes 1/3rd of each creator's assigned work across all their assigned platforms so that **every team member receives actionable work in every batch**.
- **Timing Interval:** 
  - **Batch 1:** Dispatched immediately upon owner confirmation (`T+0m`).
  - **Batch 2:** Dispatched automatically after 30 minutes (`T+30m`).
  - **Batch 3:** Dispatched automatically after 60 minutes (`T+60m`).

---

## 3. Simplified Employee Action Workflow (No Link Required)

1. Telegram bot delivers posting tasks according to the 3 batch schedules.
2. Employee posts the content on the target platform.
3. Employee presses **[Mark as Done]** in Telegram.
4. System updates assignment status to `Completed` instantly.
5. **No URL or post link submission is required.**

---

## 4. Send to Team Automation Sequence

Upon owner confirmation:
1. System validates day completeness and active creator status.
2. System partitions assignments into 3 equal batches per creator.
3. Batch 1 messages are dispatched immediately to Telegram.
4. Timed triggers schedule Batch 2 (+30 min) and Batch 3 (+60 min).
5. Owner receives a distribution report detailing batch execution schedules.
