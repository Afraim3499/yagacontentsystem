# Permanent ID Structure & System Status Standards

## 1. Permanent ID Structure

The system relies on immutable, standardized ID strings across all Google Sheets and Telegram payloads rather than names or usernames, ensuring system integrity when handles or display names change.

### Standard ID Formats
```text
Creator:              CR-001, CR-002, CR-003
Platform:             PL-X, PL-CMC, PL-TG, PL-LINKEDIN, PL-INSTAGRAM, PL-FACEBOOK, PL-BINANCE, PL-TRADINGVIEW, PL-MEDIUM, PL-SUBSTACK
Account:              AC-MEDIUM-CR001
Credential Record:    CRED-MEDIUM-CR001
Content Day:          DAY-20260731
Base Content:         CNT-20260731-001
Assignment:           ASN-20260731-001-CR001
Engagement:           ENG-20260731-MEDIUM-CR001-01
Issue:                ISS-20260731-001
```

---

## 2. System Status Standards

### A. System Phases (Master Settings)
- `Setup`
- `Platform Onboarding` *(Initial system state)*
- `Onboarding Review`
- `Content Locked`
- `Content Active`
- `Paused`

### B. Platform Onboarding Statuses
- `Not Assigned`
- `Not Started`
- `Instruction Ready`
- `Instruction Sent`
- `Waiting for Credentials`
- `Waiting for Completion` / `Waiting for Confirmation`
- `Active`
- `Blocked`

### C. Account Statuses
- `Onboarding`
- `Active`
- `Restricted`
- `Paused`
- `Closed`

### D. Content Day Statuses
- `Draft`
- `Ready`
- `Sent`
- `Partially Delivered`
- `Completed`
- `Cancelled`

### E. Assignment Statuses
- `Pending`
- `Ready`
- `Delivered`
- `Viewed`
- `Posted`
- `Submitted`
- `Completed`
- `Problem`
- `Cancelled`
