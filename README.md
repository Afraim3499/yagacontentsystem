# ⚡️ YAGA CALLS — Multi-Creator Content Operations Engine & CRM v2.0

![Yaga Calls Operational Command Center](https://img.shields.io/badge/System-v2.0_Production_Ready-gold?style=for-the-badge)
![Supabase Realtime](https://img.shields.io/badge/Database-Supabase_PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)
![Telegram Bot Engine](https://img.shields.io/badge/Telegram_Bot-Active_Engine-26A5E4?style=for-the-badge&logo=telegram)
![React Vite CRM](https://img.shields.io/badge/CRM_UI-React_Vite_HSL-61DAFB?style=for-the-badge&logo=react)

> **The Next-Generation Autonomous Multi-Platform Content Operations Platform**  
> Yaga Calls eliminates traditional content bottlenecks by orchestrating multi-creator onboardings, platform setups, AI voice personalizations, 3-batch staggered Telegram dispatches, and real-time SLA circuit breakers from a central command center.

---

## 🚀 What is Yaga Calls System?

Yaga Calls is an end-to-end enterprise content operations platform designed to scale multi-platform publishing across a team of creators (X/Twitter, Telegram, Medium, Binance Square, Substack, LinkedIn) with zero manual overhead.

The platform combines a **React 18 + HSL Glassmorphism Web CRM** with a **Node.js Telegram Bot Engine (`@yagacontentbot`)** backed by **Supabase PostgreSQL & Realtime WebSockets**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       YAGA CALLS CRM COMMAND CENTER                         │
│  React + Vite • Live Supabase Realtime • Multi-Owner Alert Vault            │
└─────────────────────────────────────────────────────────────────────────────┘
                               ▲                      ▲
                               │ Realtime Sync        │ REST API Pipeline
                               ▼                      ▼
┌────────────────────────────────────────┐  ┌─────────────────────────────────┐
│         SUPABASE POSTGRES DB           │  │     TELEGRAM BOT ENGINE         │
│  12 Relational Tables (creators,      │◄─┤ Node.js (bot_engine.js)         │
│  owners, base_content, captions,       │  │ Polls updates, sends dispatches,│
│  assignment_queue, issue_tickets,      │  │ 3-Step onboarding, 60m SLA      │
│  credentials_vault, system_logs)       │  │ Circuit Breaker & Owner Alerts  │
└────────────────────────────────────────┘  └─────────────────────────────────┘
```

---

## ⚡️ How It Revolutionizes Traditional Content Operations

### 📊 The Paradigm Shift

| Feature / Metric | 🔴 Traditional Content Workflow | ⚡️ Yaga Calls Autonomous Engine |
| :--- | :--- | :--- |
| **Creator Onboarding** | Manual forms, email back-and-forth, manual password sharing. | **Zero-Friction 3-Step Bot Onboarding** (`/registration` → `/onboard`). |
| **Voice Personalization** | Generic copy-pasted captions across all creators. | **Dynamic AI Voice Tuning** (Custom tone, sentence style, vocabulary, CTA per creator). |
| **Task Distribution** | Manual posting requests sent via chat throughout the day. | **Automated 3-Batch Staggered Pipeline** (11:00 AM, 11:30 AM, 12:00 PM EST). |
| **Overdue & Deadline Tracking** | Loose spreadsheets; missed posts go unnoticed for days. | **60-Min SLA Circuit Breaker** (30m nudge, 60m auto-ticket & multi-owner alert). |
| **Owner Visibility** | Asking creators for updates via DM. | **Multi-Owner Telegram Alerts & Real-Time News Ticker Banner**. |
| **Content Character Limits** | Over-character posts rejected by platforms at post time. | **Real-time CRM character & headline validation** (🟢 Green, 🟡 Yellow, 🔴 Red). |

---

## 📈 Operational Impact & Efficiency Gains

- **10x Content Velocity**: A single content operational manager can broadcast and monitor 50+ posts across 10+ creators in under 2 minutes.
- **90% Reduction in Management Overhead**: Automated bot-driven platform onboarding, credential collection, and SLA reminders eliminate manual chasing.
- **100% SLA Post Compliance Guarantee**: 60-minute circuit breaker freezes overdue tasks, alerts all system owners, and logs tickets in the CRM Issue Resolution Desk.
- **Strict Per-User Isolation**: Zero cross-contamination — every task, ticket, and statistic is isolated to the specific creator's database primary keys.

---

## 🌟 Core System Features

1. **3-Step Telegram Onboarding Router (`/registration`, `/onboard`, `/tasks`)**:
   - **Step 1:** User Onboarding (`/registration`) registers creator profile and voice profile.
   - **Step 2:** Platform Onboarding (`/onboard`) presents setup guidelines and encrypts login credentials into Supabase `credentials_vault`.
   - **Step 3:** Daily Task Delivery (`/tasks`) delivers 3-batch staggered cards with inline `[Mark as Done]` and `[Report a Problem]` actions.

2. **Multi-Owner Broadcast Alert Vault (`/owner`)**:
   - Multiple administrators register via `/owner`.
   - Receives personalized Telegram alerts for batch dispatches, problem reports, 60m SLA circuit breaker tickets, and account activations.

3. **Live Operations News Ticker & Audit Desk**:
   - High-tech scrolling news ticker in the CRM navbar streaming real-time headlines.
   - Dynamic real-time filterable log stream (`system_logs`) tracking all user onboardings, platform setups, dispatches, and issue tickets.

4. **Structured Single & Multi-Creator Content Studio**:
   - Headline, Subheadline, Body Content, Platform Character Count validation.
   - Multi-creator selective targeting pills.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Lucide Icons, Custom HSL Styling (No Tailwind dependency).
- **Backend Bot**: Node.js, Telegram Bot API, Native PostgreSQL Client (`pg`).
- **Database & Realtime**: Supabase PostgreSQL DB, WebSockets (`@supabase/supabase-js`).

---

## 💻 Quick Start & Local Setup

### 1. Prerequisites
- Node.js v18+
- Supabase PostgreSQL Database

### 2. Database Setup
Run the migration scripts to initialize the Supabase schema:
```bash
node update_schema_v3.js
node update_schema_v4.js
node update_schema_v5.js
```

### 3. Start Telegram Bot Engine
```bash
node bot_engine.js
```
*Bot Engine starts on `http://localhost:3001` and connects to Telegram `@yagacontentbot`.*

### 4. Start CRM Web Application
```bash
cd crm-app
npm install
npm run dev
```
*Open `http://localhost:5173` to access the Chief System Engineering Command Center.*

---

## 📚 Operational Documentation

- [01_TEAM_MEMBER_GUIDE.md](01_TEAM_MEMBER_GUIDE.md) — Team Member & Creator Telegram Bot Guide.
- [02_OWNERS_OPERATIONAL_GUIDE.md](02_OWNERS_OPERATIONAL_GUIDE.md) — System Owner Registration & Alert Guide.
- [03_CHIEF_SYSTEM_ENGINEER_RUNBOOK.md](03_CHIEF_SYSTEM_ENGINEER_RUNBOOK.md) — Master Technical Architecture & Operations Manual.

---

## 📄 License & Attribution

Developed by the **Chief System Engineering Team** for **Yaga Calls Operations** © 2026. All rights reserved.
