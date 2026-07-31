# 🛠️ YAGA CALLS — CHIEF SYSTEM ENGINEER OPERATIONAL RUNBOOK
> **Master Technical Specification & Operations Manual**  
> This document details the system architecture, database schema, background process topology, dispatch pipeline, SLA circuit breakers, and troubleshooting procedures for operating Yaga Calls Operations System error-free.

---

## 🏛️ 1. Architecture & Process Topology

The system operates across three decoupled layers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CRM FRONTEND WEB APP                               │
│  React + Vite (Port 5173) • Tailored HSL CSS • Realtime Supabase Sync        │
└─────────────────────────────────────────────────────────────────────────────┘
                               ▲                      ▲
                               │ Realtime Sync        │ REST API Calls
                               ▼                      ▼
┌────────────────────────────────────────┐  ┌─────────────────────────────────┐
│         SUPABASE POSTGRES DB           │  │     TELEGRAM BOT ENGINE         │
│  AWS PostgreSQL Pooler (Port 5432)     │◄─┤ Node.js (bot_engine.js: 3001)   │
│  Tables: creators, owners, platforms,  │  │ Telegram Bot: @yagacontentbot   │
│  base_content, creator_captions,       │  │ Polls updates, sends dispatches,│
│  assignment_queue, issue_tickets,      │  │ handles 3-step onboarding,      │
│  credentials_vault, system_logs        │  │ runs 60m SLA Circuit Breaker    │
└────────────────────────────────────────┘  └─────────────────────────────────┘
```

---

## 🗄️ 2. Database Schema Reference (Supabase Postgres)

| Table Name | Primary Key | Description |
| :--- | :--- | :--- |
| `public.creators` | `id` (`CR-001`) | Stores creator profiles, real names, public display names, titles, and Telegram Chat IDs. |
| `public.owners` | `id` (`OWN-001`) | Stores registered System Owners (`name`, `telegram_chat_id`, `active`). |
| `public.voice_profiles` | `creator_id` | Stores per-creator voice guidelines (tone, sentence length, vocabulary, humor, CTA style). |
| `public.platforms` | `id` (`PL-001`) | Stores platform registry (`name`, `category`, `daily_posts_req`, `article_freq`, `engagement_req`, `status`). |
| `public.accounts` | `id` (`AC-...`) | Links creator to platform (`handle`, `posting_ready`, `status`). |
| `public.base_content` | `id` (`CNT-...`) | Stores daily base topics (`day_id`, `platform_id`, `headline`, `subheadline`, `shared_topic`, `drive_link`). |
| `public.creator_captions` | `(content_id, creator_id)` | Stores personalized AI captions for each creator per topic. |
| `public.assignment_queue` | `id` (`ASN-...`) | Tracks task deliveries (`batch_number`, `scheduled_time`, `status`, `sla_nudge_sent`, `sla_ticketed`). |
| `public.issue_tickets` | `id` (`ISS-...`) | Logs issue reports and 60m SLA overdue tickets (`creator_id`, `platform_id`, `status`, `owner_response`). |
| `public.credentials_vault` | `id` (`CRD-...`) | Stores platform credentials collected via Telegram during Step 2 Onboarding. |
| `public.system_logs` | `id` (`LOG-...`) | Stores system audit events (`event_type`, `creator_name`, `message`, `created_at`) powering Navbar Ticker & Audit Desk. |
| `public.system_config` | `key` | Stores global key-value system settings (e.g. `owner_chat_id`, `system_phase`). |

---

## 🚀 3. Staggered 3-Batch Dispatch Pipeline

Dispatches are triggered via CRM Content Studio (`onSendToTeam()`) or `POST http://localhost:3001/api/dispatch`.

1. **Batch 1 (11:00 AM EST)**: Sent immediately upon trigger.
2. **Batch 2 (+30 mins — 11:30 AM EST)**: Queued automatically via `setTimeout` in `bot_engine.js`.
3. **Batch 3 (+60 mins — 12:00 PM EST)**: Queued automatically via `setTimeout` in `bot_engine.js`.

### User-Level Selective Targeting:
During dispatch, `dispatchBatch` checks `creator_captions` for matching `(content_id, creator_id)` rows. Unassigned creators do not receive topics meant for other creators.

---

## ⏰ 4. Overdue Task SLA Circuit Breaker

`checkOverdueSLA()` runs every **10 minutes** in `bot_engine.js`:

1. **30-Minute Nudge (`minutesElapsed >= 30 && < 60`)**:
   - Sends Telegram reminder card to creator: *"Hi [Name], assignment [ID] is 30 mins past post time."*
   - Sets `sla_nudge_sent = true` so nudge fires only once.

2. **60-Minute SLA Circuit Breaker (`minutesElapsed >= 60`)**:
   - Generates issue ticket `ISS-SLA-[timestamp]` in `issue_tickets`.
   - Sets `sla_ticketed = true` on `assignment_queue` row (**Circuit Breaker**).
   - **Freezes SLA tracking** on this task so it stops looping.
   - Broadcasts SLA alert card to **ALL registered owners** on Telegram.

---

## 💻 5. Launching & Managing Processes

### Starting Bot Engine:
```powershell
cd "d:\yagacallls content operation"
node bot_engine.js
```

### Starting CRM Web App:
```powershell
cd "d:\yagacallls content operation\crm-app"
npm run dev
```

### Checking Bot Engine Status & Health:
- **Health Check Endpoint**: `GET http://localhost:3001/api/health`
- **Bot Engine Logs**: View background task log or console output.

---

## 🔧 6. Maintenance & Troubleshooting

### Issue 1: Telegram Bot Not Responding
- Verify Node process is running (`node bot_engine.js`).
- Test API health endpoint: `http://localhost:3001/api/health`.
- Check Telegram bot token in `bot_engine.js` (`8446355677:AAGrA3dAPuQ45bvf...`).

### Issue 2: Website Not Updating in Realtime
- Check browser console for Supabase WebSocket connection status.
- Ensure `VITE_SUPABASE_ANON_KEY` is present in `crm-app/.env`.

### Issue 3: Owner Not Receiving Telegram Alerts
- Ensure owner typed `/owner` on Telegram and submitted their name.
- Open CRM → `Creators & Accounts` → `System Owners` tab → verify owner's Chat ID and active status.

---
*YAGA CALLS OPERATIONS SYSTEM • CHIEF SYSTEM ENGINEERING RUNBOOK v2.0*
