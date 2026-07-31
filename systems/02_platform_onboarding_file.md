# File Two: Yaga Platform Onboarding File

This file controls the entire initial onboarding operation. Employees do not open it. The Telegram bot reads instructions from this file and writes collected account information into it.

---

## 1. Schema & Tab Breakdown

### Tab 01 — Platform Instructions
One row per platform.
**Columns:**
- Platform ID
- Platform name
- Account creation link
- Login method
- Complete setup instruction
- Display-name instruction
- Username instruction
- Bio source
- Profile image source
- Cover image source
- Public-status instruction
- Website-link instruction
- Follow requirement
- Follow-list source
- Introduction-post requirement
- Security key required
- Activation requirements
- Active status

---

### Tab 02 — Creator-Platform Assignments
One row per assigned account setup.
**Columns:**
- Creator ID
- Platform ID
- Account ID
- Required
- Priority
- Assigned date
- Onboarding status (`Not Started`, `Instruction Ready`, `Instruction Sent`, `Waiting for Credentials`, `Waiting for Completion`, `Active`, `Blocked`)
- Instruction sent
- Credentials received
- Setup confirmed
- Activated
- Current problem

---

### Tab 03 — Restricted Credentials
Restricted credential vault accessible ONLY to Owner and Automation Account. Never accessed by general logs, UI dashboards, or notifications.

**Columns:**
- Credential Record ID
- Account ID
- Creator ID
- Platform ID
- Login email, phone or username
- Password
- Public account username
- Security key or backup key (Only when required)
- Credential updated date
- Credential status

#### Data Exclusions (What is NOT collected)
- Date of birth used
- Country used
- Account creation date
- Recovery phone
- Unnecessary personal/profile data

---

### Tab 04 — Onboarding Progress
Tracks stage confirmation for each account.
**Columns:**
- Account ID
- Creator ID
- Platform ID
- Instruction delivered
- Credentials saved
- Public status confirmed
- Bio confirmed
- Profile image confirmed
- Cover image confirmed
- Required follows confirmed
- Introduction post confirmed
- Activation status
- Activation time

---

### Tab 05 — Activation Log
System record of account activations.
**Columns:**
- Account ID
- Creator ID
- Platform ID
- Activated time
- Master File sync status
- Owner notified
- Employee notified
- Errors

---

### Tab 06 — Onboarding Issues
Logs onboarding roadblocks:
- Username unavailable
- Gmail cannot be used
- Platform requires verification
- Bio too long
- Image upload failures
- Account restricted
- Security key unavailable
