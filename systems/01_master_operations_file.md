# File One: Yaga Master Operations File

The Master Operations File is the permanent source of truth and database for the operation. It remains private and accessible only to the Yaga owner, one trusted administrator, and the automation account. Regular employees do not open this file.

---

## 1. Schema & Tab Breakdown

### Tab 00 — Settings
Stores system-level configuration parameters:
- Company name
- System phase (`Setup`, `Platform Onboarding`, `Onboarding Review`, `Content Locked`, `Content Active`, `Paused`)
- Time zone
- Owner Telegram chat ID
- Telegram bot username
- Content Studio file ID
- Platform Onboarding file ID
- Drive root folder ID
- Active creator count
- Active platform count
- Content operations status
- Automation switches
- Status dropdown values
- Default reminder times
- Current content date

*Note: Initial System Phase is `PLATFORM ONBOARDING`. Content Studio cannot distribute work while system phase is not `Content Active`.*

---

### Tab 01 — Team Members
One row per creator.
**Columns:**
- Creator ID (e.g. `CR-001`, `CR-002`, `CR-003`)
- Real name
- Public creator name
- Yaga title
- Telegram username
- Telegram chat ID
- Gmail address
- Phone number
- Active status
- Start date
- Assigned platforms
- Creator voice ID
- Owner or employee role
- Last activity

---

### Tab 02 — Platform Master
One row per platform.
**Columns:**
- Platform ID (e.g., `PL-X`, `PL-CMC`, `PL-TG`, `PL-LINKEDIN`, `PL-INSTAGRAM`, `PL-FACEBOOK`, `PL-BINANCE`, `PL-TRADINGVIEW`, `PL-MEDIUM`, `PL-SUBSTACK`)
- Platform name
- Platform category
- Platform status
- Main use case
- Main audience
- Daily posting requirement
- Article frequency
- Daily engagement requirement
- Account creation URL
- Public profile required
- Profile image required
- Cover image required
- Website link allowed
- Introduction post required
- Security key field required
- Default CTA type
- Platform playbook ID
- Notes

---

### Tab 03 — Account Database
One row per creator-platform account.
**Columns:**
- Account ID (e.g., `AC-X-CR001`)
- Creator ID
- Platform ID
- Public display name
- Public username
- Profile URL
- Login identifier
- Credential record ID
- Account status
- Onboarding status
- Public profile confirmed
- Bio confirmed
- Required follows confirmed
- Introduction published
- Posting ready
- Activation date
- Last update
- Current issue

*Note: Does not duplicate passwords. Stores `Credential Record ID` pointing to Restricted Credentials table in Platform Onboarding File.*

---

### Tab 04 — Creator Voice Profiles
All creators communicate the same Yaga purpose (Market intelligence, Opportunities, Results, Gains, Losses, Financial ambition, Work frustration, Social mobility, Personal hunger, Yaga's growth, Community stories, Trading decisions, Market psychology). They differ in expression style.

**Columns:**
- Creator ID
- Yaga relationship
- Personal background
- Reason for joining Yaga
- Tone
- Sentence length
- Vocabulary style
- Humour level
- Emotional intensity
- Technical depth
- Storytelling style
- Typical opening style
- Typical closing style
- CTA style
- Phrases to avoid
- Example market post
- Example personal post
- Example result post

---

### Tab 05 — Platform Playbooks
Platform-specific strategy definitions.
**Columns:**
- Platform ID
- Platform purpose
- Audience condition
- Yaga message on the platform
- Suitable subjects
- Unsuitable subjects
- Content formats
- Caption length
- Image guidance
- Hashtag guidance
- Link placement
- CTA style
- Posting frequency
- Article frequency
- Engagement requirement
- Comment purpose
- GPT prompt
- Submission proof required

---

### Tab 06 — Profile Blueprints
One row per account blueprint.
**Columns:**
- Account ID
- Platform ID
- Creator ID
- Display name
- Preferred username option 1
- Preferred username option 2
- Preferred username option 3
- Bio
- Long description
- Yaga affiliation line
- Profile image Drive link
- Cover image Drive link
- Website or Telegram link
- Public-profile instruction
- Introduction post
- Introduction image
- Profile approved
- Last updated

---

### Tab 07 — Follow and Community Directory
Accounts, publications, channels, and communities relevant to Yaga.
**Columns:**
- Platform ID
- Name
- Type
- Link
- Category (Crypto analysts, Trading educators, Market news accounts, Exchanges, Trading psychology writers, Financial-freedom writers, Professional-development writers, Crypto publications, Relevant communities)
- Why it matters
- Required or optional
- Minimum follow requirement (Default: at least 5 relevant accounts during onboarding)
- Applicable creators
- Active status

---

### Tab 08 — Content Days
One row per date created in Content Studio.
**Columns:**
- Day ID (e.g., `DAY-20260731`)
- Date
- Content Studio tab name
- Status
- Created time
- Base content count
- Creator assignment count
- Image-backed assignment count
- Article assignment count
- Engagement assignment count
- Distributed time
- Distribution result
- Completion percentage

---

### Tab 09 — Base Content
One row per central content package.
**Columns:**
- Content ID (e.g., `CNT-20260731-001`)
- Day ID
- Platform ID
- Content type
- Slot
- Publishing time
- Shared topic
- Shared context
- Drive asset link
- Shared instruction
- Status

---

### Tab 10 — Creator Content
One row for each creator's personalized version of base content.
**Columns:**
- Content ID
- Creator ID
- Account ID
- Caption (Must be unique for every creator)
- Article or document link
- CTA
- Creator-specific instruction
- Validation status

---

### Tab 11 — Assignment Queue
Primary table read by Telegram bot.
**Columns:**
- Assignment ID
- Day ID
- Content ID
- Creator ID
- Platform ID
- Account ID
- Content type
- Scheduled time
- Caption or article
- Asset link
- CTA
- Status (`Pending`, `Ready`, `Delivered`, `Viewed`, `Posted`, `Submitted`, `Completed`, `Problem`, `Cancelled`)
- Delivery time
- Telegram message ID
- Submission required
- Submission link
- Completion time
- Problem status

---

### Tab 12 — Engagement Requirements
Recurring tasks auto-generated from Platform Master.
**Columns:**
- Engagement ID
- Date
- Creator ID
- Platform ID
- Activity
- Required quantity
- GPT prompt
- Proof type
- Submitted links
- Completion status

---

### Tab 13 — Submissions
Records all proof links submitted via Telegram.
**Columns:**
- Submission ID
- Assignment ID
- Engagement ID
- Creator ID
- Platform ID
- Submission type
- Public link
- Submitted time
- Validation result
- Notes

---

### Tab 14 — Issues
Tracks reported employee/account issues.
**Columns:**
- Issue ID
- Creator ID
- Platform ID
- Account ID
- Assignment ID
- Issue type
- Employee description
- Screenshot or link
- Created time
- Status
- Owner response
- Resolution

---

### Tab 15 — Dashboard
Owner oversight view containing:
- Current system phase
- Platform onboarding percentage
- Active accounts / Incomplete accounts / Blocked accounts
- Today's base content & total assignments
- Delivered / Completed / Missing assignments
- Engagement completion
- Reported problems
- Creator completion rates & Platform completion rates

---

### Hidden Technical Tabs
- Bot Users
- Bot Message Log
- Error Log
- Sync Log
- ID Generator
- Dropdown Lists
- Audit Log
