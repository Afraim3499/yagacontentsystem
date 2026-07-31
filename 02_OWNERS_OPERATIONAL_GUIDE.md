# 👑 YAGA CALLS — SYSTEM OWNERS OPERATIONAL GUIDE
> **Welcome System Owners & Administrators!**  
> This guide explains how to register as a System Owner on Telegram, monitor real-time dispatches, manage owners in the CRM, and resolve creator issues.

---

## 👑 STEP 1: Multi-Owner Telegram Registration

Multiple owners can register to receive real-time Telegram alerts.

1. Open Telegram and message **@yagacontentbot**.
2. Type `/owner` or `/admin`.
3. The bot will prompt:
   > `👑 YAGA OWNER REGISTRATION: Please reply with your full name (e.g. Rizwan or System Admin):`
4. Reply with your name.
5. **Done!** You are registered in the Supabase `owners` table (`OWN-001`, `OWN-002`, etc.) and will receive personalized broadcast updates.

---

## 📢 Real-Time Owner Telegram Broadcast Alerts

Once registered, you receive 4 types of personalized notifications directly on Telegram:

### 1. 📢 Batch Dispatch Summary Cards
Sent automatically whenever a batch (Batch 1, Batch 2, or Batch 3) is dispatched:
```
📢 OWNER DISPATCH NOTIFICATION

Hi Rizwan, Batch 1 of 3 has been dispatched successfully!

👥 Assigned Creators: Alex Crypto, Elena Trades, Marcus Market
📊 Total Assignments Sent: 6

📋 Content Breakdown:
• 📝 Text Posts: 2
• 🖼 Graphic/Image Posts: 3
• 📰 Articles: 1

⏰ Posting Window: 11:00 AM EST
```

### 2. 🚨 Creator Problem Ticket Alerts
Sent instantly when a creator taps **[Report a Problem]** on Telegram:
```
🚨 OWNER ALERT — CREATOR PROBLEM REPORTED

Hi Rizwan, creator Elena Trades reported an issue:

🎫 Ticket: ISS-94821
👤 Creator: Elena Trades (CR-002)
📋 Assignment: ASN-20260730-001-CR002-B1

Check Issue Desk in CRM to reply.
```

### 3. ⏰ 60-Minute SLA Overdue Alerts
Sent when a creator exceeds the 60-minute posting SLA window:
```
🚨 OWNER ALERT — 60m SLA OVERDUE TICKET

Hi Rizwan, an SLA overdue ticket was generated:

🎫 Ticket: ISS-SLA-88219
👤 Creator: Marcus Market Calls (CR-003)
📱 Platform: Substack
📋 Assignment: ASN-20260730-003-CR003-B1

⚡️ Ticket logged in CRM Issue Desk. SLA tracking for this task is now frozen.
```

### 4. ✅ Account Activation Confirmations
Sent when a creator completes Step 2 Platform Onboarding:
```
✅ ACCOUNT ACTIVATED

Hi Rizwan, creator Alex Crypto completed onboarding for account AC-X-CR001 (Handle: @alex_crypto_x).
```

---

## 🖥 Managing Owners in the CRM Website

System Owners can be managed via two interfaces in the CRM website:

1. **Creators & Accounts Tab (`CreatorsAccountsView.jsx`)**:
   - Switch to the **System Owners ({owners.length})** sub-tab.
   - View all registered owners (Owner ID, Name, Telegram Chat ID, Alert Status).
   - Click **+ Add System Owner** to register an owner via web form.
   - Toggle Active/Inactive status to temporarily pause alerts.
   - Delete owner records.

2. **System Settings Tab (`SettingsView.jsx`)**:
   - View **Registered System Owners Vault**.
   - Add/Remove owners directly inline.

---

## 💬 Replying to Creator Tickets from CRM

When a creator reports an issue:
1. Open the CRM website and navigate to **Issue Resolution Desk** (left menu).
2. Locate the open ticket (e.g. `ISS-94821`).
3. Type your response in the **Owner Response** input and click **Resolve Issue**.
4. The system updates the ticket status to `RESOLVED` in Supabase AND sends a direct message to the creator's Telegram chat:
   > `💬 FROM YAGA SYSTEM OWNER: Hi Elena, re: ISS-94821: "New asset link has been uploaded..."`

---

## 📊 Summary of Owner Controls

| Action | Location | Mechanism |
| :--- | :--- | :--- |
| Register as Owner | Telegram | Send `/owner` → reply with name |
| View All Owners | CRM Web UI | `Creators & Accounts` → `System Owners` tab |
| Add Owner via Web | CRM Web UI | Click `+ Add System Owner` button |
| Resolve Creator Issue | CRM Web UI | `Issue Resolution Desk` → type response & click Resolve |
| Toggle Phase / Pause | CRM Web UI | Top Navbar News Ticker & Settings |

---
*YAGA CALLS OPERATIONS SYSTEM • CHIEF SYSTEM ENGINEERING TEAM*
