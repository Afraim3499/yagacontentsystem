# Scope Exclusions & End-to-End Operating Experience

## 1. Out-of-Scope Definitions (What Will Not Be Built Initially)

To maintain structural simplicity, reliability, and cost efficiency in Version 1, the following elements are **explicitly excluded**:

- ❌ Separate employee spreadsheet files.
- ❌ Separate onboarding and content Telegram bots (Unified single bot used).
- ❌ Automatic web-scraping selection of articles/posts to reply to.
- ❌ Automatic public posting via social media APIs (Employees post manually).
- ❌ Automatic social media likes or engagement bots.
- ❌ Complex employee web dashboards.
- ❌ Automated web-scraping of platform analytics.
- ❌ External customer-facing bot functionality.
- ❌ Direct OpenAI/Anthropic API integration (Employees utilize GPT manually via supplied prompts).

---

## 2. End-to-End Operating Experiences

### Owner Experience
1. Configures platform requirements in Platform Master.
2. Assigns platform accounts to creators.
3. Monitors onboarding progress via Master Dashboard / Telegram.
4. Presses **[Activate Content Operations]** upon 100% onboarding completion.
5. Presses **[Add New Day]** in Content Studio to create a date tab.
6. Enters base content, unique captions, and optional Drive image links.
7. Presses **[Send to Team]** and confirms batch distribution.
8. Monitors real-time publishing completion rates and issues.

### Employee Experience — Onboarding Phase
1. Opens Telegram bot.
2. Receives 1-message complete setup instruction per assigned platform.
3. Creates/configures account on target platform.
4. Submits login credentials and public username via Telegram bot.
5. Confirms account configuration.
6. Proceeds to next assigned platform until all platforms are active.

### Employee Experience — Daily Operations Phase
1. Opens Telegram bot to receive daily work summary.
2. Views individual scheduled task cards.
3. Copies unique caption and downloads attached media from Drive.
4. Manually posts content on target social platform.
5. Submits public post link back to Telegram bot.
6. Executes daily engagement requirements using supplied GPT prompts.
7. Submits engagement proof links or reports issues directly in Telegram.

### Backend Automation Engine Experience
- Dynamically links creators to platform accounts and restricted credentials.
- Automates state transitions and updates posting readiness.
- Generates daily assignment arrays and formats Telegram task messages.
- Parses incoming proof links, validates submission status, and logs metrics.
- Dispatches automated owner summaries, error notifications, and system backups.

---

## 3. Final Architecture Summary

```text
YAGA PLATFORM ONBOARDING FILE
Stores instructions, progress and restricted credentials
        ↓
YAGA MASTER OPERATIONS FILE
Stores active creators, platforms, accounts and operational records
        ↓
YAGA CONTENT STUDIO
Allows the owner to create and distribute daily content
        ↓
YAGA TELEGRAM BOT
Handles onboarding, daily work, engagement and submissions
        ↓
EMPLOYEES
Create accounts, publish content, engage and submit links
        ↓
MASTER OPERATIONS FILE
Updates completion, account status and performance
```

### Final Execution Build Sequence
```text
1. Master database
2. Platform Onboarding File
3. Telegram bot
4. Guided account onboarding
5. Automatic account activation
6. Complete all required platforms
7. Owner activates content operations
8. Content Studio
9. Daily Telegram distribution
10. Engagement prompts
11. Reporting
12. Conversion tracking
```
