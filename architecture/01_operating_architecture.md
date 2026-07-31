# Operating Architecture & Core Principles

## 1. Operating Components
Yaga Calls operates using six core infrastructure components:

1. **Yaga Master Operations File** (Google Sheets): The permanent database and single source of truth.
2. **Yaga Platform Onboarding File** (Google Sheets): Setup instructions, onboarding progress, and restricted credential vault.
3. **Yaga Content Studio File** (Google Sheets): Owner's daily working file for generating and queueing content.
4. **Yaga Google Drive Asset Library** (Google Drive): Storage repository for visual media, articles, and proof assets.
5. **One Yaga Team Telegram Bot** (Telegram Bot API): The single employee interface for onboarding, receiving daily tasks, and submitting proof links.
6. **Central Google Apps Script Automation Engine** (Google Apps Script): The central logic layer executing data validation, distribution, state transitions, and Telegram API communication.

---

## 2. Structural Authority & The Central Rule

The entire system follows one strict architectural hierarchy:

> **The Master File is the database.**  
> **The Onboarding File builds accounts.**  
> **The Content Studio creates daily work.**  
> **Google Drive stores media.**  
> **Telegram is the employee interface.**

### Circular Syncing Restriction
- There must be **no circular syncing** where several files overwrite one another.
- Each kind of information has exactly **one authoritative location**.
- Employees never receive individual spreadsheet files; their interaction is 100% confined to Telegram.

---

## 3. High-Level System Workflows

### Phase One Workflow: Platform Onboarding
```text
Platform requirements prepared
        ↓
Creator-platform assignments created
        ↓
Telegram bot sends complete setup instructions
        ↓
Employee creates and configures account
        ↓
Bot collects minimal credentials
        ↓
Onboarding File is updated
        ↓
Account is activated in Master File
        ↓
All required accounts become active
        ↓
Owner activates Content Operations
```

### Phase Two Workflow: Daily Content Operations
```text
Owner creates new date in Content Studio
        ↓
Owner adds platform content
        ↓
Owner adds creator-specific captions
        ↓
Owner adds optional Google Drive image links
        ↓
Owner presses Send to Team
        ↓
Master File creates assignments
        ↓
Telegram bot delivers work
        ↓
Employees publish and submit links
        ↓
Master File updates automatically
        ↓
Owner receives completion summaries
```
