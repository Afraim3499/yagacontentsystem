# Central Automation Engine Architecture

## 1. Google Apps Script Architecture

The entire system is powered by one central Google Apps Script project:

```text
Yaga Operations Engine
```

The engine runs script logic serving all three Google Spreadsheet files, Google Drive, and the Telegram Bot API.

---

## 2. Technical Module Breakdown

The Apps Script project is modularly structured into separate internal code files/modules:

1. **Master Database Module:** Handles read/write operations to `Yaga Master Operations File`.
2. **Onboarding Module:** Controls platform assignment logic, onboarding state transitions, and instruction formatting.
3. **Credential Collection Module:** Manages input validation and writing to the isolated `Restricted Credentials` table.
4. **Account Activation Module:** Executes activation rules, updates posting readiness, and updates master records.
5. **Content Studio Module:** Generates daily tabs, reads platform cadences, and builds creator columns.
6. **Assignment Generation Module:** Transforms daily content rows into individualized creator assignments.
7. **Telegram Delivery Module:** Sends direct messages, inline keyboard menus, images, and instructions via Telegram Bot API.
8. **Engagement Module:** Schedules and delivers recurring daily engagement tasks and GPT prompts.
9. **Submission Module:** Validates employee submission links, records completed tasks, and updates metrics.
10. **Owner Notification Module:** Sends phase completion alerts, distribution receipts, and daily summary reports to the Owner's Telegram chat ID.
11. **Error-Handling Module:** Catches script exceptions, logs errors to hidden technical tabs, and notifies admin.
12. **Backup Module:** Automates daily backups of operational sheets to Google Drive.
