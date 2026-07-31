# Platform Onboarding Experience & Account Activation

## 1. Unified 1-Message Telegram Onboarding

The bot delivers the complete setup instructions for a platform in **a single Telegram message** rather than subjecting the employee to multi-step diagnostic questions.

### Standard Onboarding Message Template
```text
YAGA PLATFORM ONBOARDING

Platform: Medium
Account owner: [Creator Name]

Complete the following setup:

1. Create or open your Medium account:
[Open Medium]

2. Use this display name:
[Approved Display Name]

3. Try these usernames in order:
• [Username Option 1]
• [Username Option 2]
• [Username Option 3]

4. Add this bio:
[Complete Medium Bio]

5. Set the profile to public wherever applicable.

6. Add this profile image:
[Open Profile Image]

7. Add this cover or supporting image where applicable:
[Open Cover Image]

8. Add this Yaga link:
[Assigned Link]

9. Follow at least five relevant accounts or publications related to:
• Cryptocurrency
• Trading
• Market analysis
• Investing
• Financial ambition

Recommended accounts:
1. [Account Link]
2. [Account Link]
3. [Account Link]
4. [Account Link]
5. [Account Link]

10. Publish this introduction where applicable:
[Introduction Content]

Image:
[Optional Drive Link]

After completing the account setup, press:

[Submit Account Details]
[Report a Problem]
```

---

## 2. Minimal Credential Collection Flow

Upon pressing **[Submit Account Details]**, the bot initiates a 4-question minimal collection flow:

- **Question 1:** `"Send the email, phone number or username used to log in to this account."`
- **Question 2:** `"Send the current account password."`  
  *(Response upon storage: `"Password saved."` — Bot never repeats the password in plaintext).*
- **Question 3:** `"Send the final public username or handle used for the account."`
- **Question 4 (Conditional):** If `Security Key Required = Yes` in Platform Master:  
  `"Send the security key, backup key or platform security code that must be stored for this account."`

### Final Confirmation Dialogue
```text
Confirm that you completed the following:

• Added the assigned bio
• Added the assigned profile image
• Set the profile to public where applicable
• Followed at least five relevant accounts
• Added the assigned Yaga link
• Published the introduction where required

[Confirm Setup Complete]
[Go Back]
[Report a Problem]
```

---

## 3. Automatic Account Activation Engine

Account activation triggers automatically upon fulfilling the criteria formula:

```text
Login Identifier Received
+ Password Received
+ Public Username Received
+ Security Key Received (when required)
+ Setup Completion Confirmed
===========================================
ACCOUNT ACTIVE
```

### Automation Actions on Activation
1. Creates/updates row in Master File `Account Database`.
2. Generates permanent `Account ID`.
3. Connects account to `Creator ID` and `Platform ID`.
4. Connects `Credential Record ID` to `Restricted Credentials`.
5. Sets `Account Status = Active` and `Posting Ready = Yes`.
6. Registers `Activation Date`.
7. Dispatches Employee Notification and Owner Notification.

### Employee Notification Text
```text
PLATFORM ONBOARDING COMPLETED

Platform:
Medium

Username:
@creatorname

Account status:
Active

Posting readiness:
Ready

Remaining platforms:
7

[Continue to Next Platform]
[View My Accounts]
```

### Owner Notification Text
```text
YAGA ACCOUNT ACTIVATED

Creator:
[Creator Name]

Platform:
Medium

Username:
@creatorname

Active accounts:
14 of 30

Remaining accounts:
16
```
*(Passwords and security keys are explicitly excluded from all notifications).*

---

## 4. Global Onboarding Gate

The system enforces a global operational lock on content distribution until all required accounts are onboarded.

### Calculation Logic
- Total Required Accounts = `Creators × Required Platforms per Creator` (e.g., `3 Creators × 10 Platforms = 30 Accounts`).
- Remaining Accounts = `Required Accounts - Active Accounts`.

### Locked Status Notification
```text
CONTENT OPERATIONS LOCKED

Required accounts:
30

Active accounts:
27

Remaining:
3

Complete platform onboarding before distributing content.
```

### 100% Completion Owner Notification
```text
YAGA INITIAL PLATFORM ONBOARDING COMPLETED

Creators:
3

Platforms:
10

Active accounts:
30

Blocked accounts:
0

All required creator accounts are ready.

[Activate Content Operations]
```
Content Operations start ONLY when the owner presses **[Activate Content Operations]**.
