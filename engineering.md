\# Yaga Calls Operations System



\## Final System Builder Blueprint and Implementation Plan



\---



\# 1. Final Operating Architecture



Yaga Calls will use:



1\. \*\*Yaga Master Operations File\*\*

2\. \*\*Yaga Platform Onboarding File\*\*

3\. \*\*Yaga Content Studio File\*\*

4\. \*\*Yaga Google Drive Asset Library\*\*

5\. \*\*One Yaga Team Telegram Bot\*\*

6\. \*\*One central Google Apps Script automation engine\*\*



The files have different purposes, but permanent operational data ultimately connects to the Master File.



Employees will not need individual spreadsheet files.



Employees will use Telegram for:



\* Platform onboarding

\* Receiving content

\* Receiving images

\* Receiving engagement prompts

\* Confirming publication

\* Submitting links

\* Reporting problems



The owner will mainly use:



\* The Platform Onboarding File during the initial setup phase

\* The Content Studio during daily operations

\* The Master File for management, reporting and control



\---



\# 2. Overall Workflow



\## Phase One: Platform Onboarding



```text

Platform requirements prepared

&#x20;       ↓

Creator-platform assignments created

&#x20;       ↓

Telegram bot sends complete setup instructions

&#x20;       ↓

Employee creates and configures account

&#x20;       ↓

Bot collects minimal credentials

&#x20;       ↓

Onboarding File is updated

&#x20;       ↓

Account is activated in Master File

&#x20;       ↓

All required accounts become active

&#x20;       ↓

Owner activates Content Operations

```



\## Phase Two: Daily Content Operations



```text

Owner creates new date in Content Studio

&#x20;       ↓

Owner adds platform content

&#x20;       ↓

Owner adds creator-specific captions

&#x20;       ↓

Owner adds optional Google Drive image links

&#x20;       ↓

Owner presses Send to Team

&#x20;       ↓

Master File creates assignments

&#x20;       ↓

Telegram bot delivers work

&#x20;       ↓

Employees publish and submit links

&#x20;       ↓

Master File updates automatically

&#x20;       ↓

Owner receives completion summaries

```



\---



\# 3. The Central Rule



The entire system follows one hierarchy:



> \*\*The Master File is the database.

> The Onboarding File builds accounts.

> The Content Studio creates daily work.

> Google Drive stores media.

> Telegram is the employee interface.\*\*



There must be no circular syncing where several files overwrite one another.



Each kind of information has one authoritative location.



\---



\# 4. File One: Yaga Master Operations



The Master File is the permanent source of truth.



It should remain private.



\## Recommended access



\* Yaga owner

\* One trusted administrator

\* Automation account



Regular employees should not open this file.



\## Master File tabs



\### 00 — Settings



Stores system-level configuration:



\* Company name

\* System phase

\* Time zone

\* Owner Telegram chat ID

\* Telegram bot username

\* Content Studio file ID

\* Platform Onboarding file ID

\* Drive root folder ID

\* Active creator count

\* Active platform count

\* Content operations status

\* Automation switches

\* Status dropdown values

\* Default reminder times

\* Current content date



\## System phases



\* Setup

\* Platform Onboarding

\* Onboarding Review

\* Content Locked

\* Content Active

\* Paused



The initial phase is:



```text

PLATFORM ONBOARDING

```



The Content Studio cannot distribute work while the system phase is not `Content Active`.



\---



\### 01 — Team Members



One row per creator.



Columns:



\* Creator ID

\* Real name

\* Public creator name

\* Yaga title

\* Telegram username

\* Telegram chat ID

\* Gmail address

\* Phone number

\* Active status

\* Start date

\* Assigned platforms

\* Creator voice ID

\* Owner or employee role

\* Last activity



Example creator IDs:



```text

CR-001

CR-002

CR-003

```



\---



\### 02 — Platform Master



One row per platform.



Columns:



\* Platform ID

\* Platform name

\* Platform category

\* Platform status

\* Main use case

\* Main audience

\* Daily posting requirement

\* Article frequency

\* Daily engagement requirement

\* Account creation URL

\* Public profile required

\* Profile image required

\* Cover image required

\* Website link allowed

\* Introduction post required

\* Security key field required

\* Default CTA type

\* Platform playbook ID

\* Notes



Example platform IDs:



```text

PL-X

PL-CMC

PL-TG

PL-LINKEDIN

PL-INSTAGRAM

PL-FACEBOOK

PL-BINANCE

PL-TRADINGVIEW

PL-MEDIUM

PL-SUBSTACK

```



\---



\### 03 — Account Database



One row per creator-platform account.



Columns:



\* Account ID

\* Creator ID

\* Platform ID

\* Public display name

\* Public username

\* Profile URL

\* Login identifier

\* Credential record ID

\* Account status

\* Onboarding status

\* Public profile confirmed

\* Bio confirmed

\* Required follows confirmed

\* Introduction published

\* Posting ready

\* Activation date

\* Last update

\* Current issue



Example account ID:



```text

AC-X-CR001

```



The Master File does not need to duplicate passwords. It stores the Credential Record ID that points to the restricted credentials table in the Platform Onboarding File.



\---



\### 04 — Creator Voice Profiles



All creators communicate the same Yaga purpose.



They are not assigned separate subjects such as “risk creator” or “profit creator.”



Every creator can discuss:



\* Market intelligence

\* Opportunities

\* Results

\* Gains

\* Losses

\* Financial ambition

\* Work frustration

\* Social mobility

\* Personal hunger

\* Yaga’s growth

\* Community stories

\* Trading decisions

\* Market psychology



The difference is expression.



Columns:



\* Creator ID

\* Yaga relationship

\* Personal background

\* Reason for joining Yaga

\* Tone

\* Sentence length

\* Vocabulary style

\* Humour level

\* Emotional intensity

\* Technical depth

\* Storytelling style

\* Typical opening style

\* Typical closing style

\* CTA style

\* Phrases to avoid

\* Example market post

\* Example personal post

\* Example result post



\---



\### 05 — Platform Playbooks



Each platform needs its own strategy.



Columns:



\* Platform ID

\* Platform purpose

\* Audience condition

\* Yaga message on the platform

\* Suitable subjects

\* Unsuitable subjects

\* Content formats

\* Caption length

\* Image guidance

\* Hashtag guidance

\* Link placement

\* CTA style

\* Posting frequency

\* Article frequency

\* Engagement requirement

\* Comment purpose

\* GPT prompt

\* Submission proof required



\## Platform positioning examples



\### X



Used for:



\* Live market observations

\* Short market stories

\* Results

\* Setups

\* Reactions

\* Urgency

\* Market discussions

\* Memes

\* Threads



\### CoinMarketCap



Used for:



\* Asset-specific discussion

\* Coin trends

\* Market sentiment

\* Results

\* Market observations

\* Crypto-native conversations



\### Telegram



Used for:



\* Free-group value

\* Market updates

\* Calls and previews

\* Community trust

\* VIP conversion

\* Results

\* Member discussions



\### LinkedIn



Used for:



\* Office frustration

\* Salary dependence

\* Professional ambition

\* Social class movement

\* Financial capability

\* Building Yaga while working

\* The need for more control over income and time



\### Instagram



Used for:



\* Emotional storytelling

\* Visual market stories

\* Result designs

\* Work frustration

\* Ambition

\* Memes

\* Yaga building updates

\* Carousels



\### Facebook



Used for:



\* Longer relatable stories

\* Community discussion

\* Beginner market awareness

\* Family and financial pressure

\* Results

\* Ambition

\* Broader audience education



\### Binance Square



Used for:



\* Crypto-native market observations

\* Market updates

\* Asset movements

\* Results

\* Market discussions



\### TradingView



Used for:



\* Chart-driven market intelligence

\* Scenarios

\* Entries and invalidation

\* Market structure

\* Post-result analysis



\### Medium



Used for:



\* Long-form authority

\* Market stories

\* Trading psychology

\* Financial ambition

\* Professional frustration

\* One article every two days

\* Two meaningful article responses daily



\### Substack



Used for:



\* Building Yaga publicly

\* Yaga development updates

\* Founder and creator observations

\* Weekly and long-form stories

\* Market lessons

\* One long article every two days when active

\* Short Notes according to its platform plan



All frequencies remain editable in the Platform Master.



\---



\### 06 — Profile Blueprints



One row per account.



Columns:



\* Account ID

\* Platform ID

\* Creator ID

\* Display name

\* Preferred username option 1

\* Preferred username option 2

\* Preferred username option 3

\* Bio

\* Long description

\* Yaga affiliation line

\* Profile image Drive link

\* Cover image Drive link

\* Website or Telegram link

\* Public-profile instruction

\* Introduction post

\* Introduction image

\* Profile approved

\* Last updated



\---



\### 07 — Follow and Community Directory



Stores accounts, publications, channels and communities relevant to Yaga.



Columns:



\* Platform ID

\* Name

\* Type

\* Link

\* Category

\* Why it matters

\* Required or optional

\* Minimum follow requirement

\* Applicable creators

\* Active status



Categories may include:



\* Crypto analysts

\* Trading educators

\* Market news accounts

\* Exchanges

\* Trading psychology writers

\* Financial-freedom writers

\* Professional-development writers

\* Crypto publications

\* Relevant communities



During onboarding, creators will normally be instructed to follow at least five relevant accounts.



The exact accounts can be:



\* Specified directly in the sheet

\* Selected by the creator from a relevant category

\* A mixture of both



\---



\### 08 — Content Days



One row per date created in the Content Studio.



Columns:



\* Day ID

\* Date

\* Content Studio tab name

\* Status

\* Created time

\* Base content count

\* Creator assignment count

\* Image-backed assignment count

\* Article assignment count

\* Engagement assignment count

\* Distributed time

\* Distribution result

\* Completion percentage



Example Day ID:



```text

DAY-20260731

```



\---



\### 09 — Base Content



One row per central content package.



Columns:



\* Content ID

\* Day ID

\* Platform ID

\* Content type

\* Slot

\* Publishing time

\* Shared topic

\* Shared context

\* Drive asset link

\* Shared instruction

\* Status



Example:



```text

CNT-20260731-001

```



\---



\### 10 — Creator Content



One row for each creator’s version of a base content package.



Columns:



\* Content ID

\* Creator ID

\* Account ID

\* Caption

\* Article or document link

\* CTA

\* Creator-specific instruction

\* Validation status



The image may be shared.



The caption must be unique for every creator.



\---



\### 11 — Assignment Queue



This is the main table used by the Telegram bot.



Columns:



\* Assignment ID

\* Day ID

\* Content ID

\* Creator ID

\* Platform ID

\* Account ID

\* Content type

\* Scheduled time

\* Caption or article

\* Asset link

\* CTA

\* Status

\* Delivery time

\* Telegram message ID

\* Submission required

\* Submission link

\* Completion time

\* Problem status



Assignment statuses:



\* Pending

\* Ready

\* Delivered

\* Viewed

\* Posted

\* Submitted

\* Completed

\* Problem

\* Cancelled



\---



\### 12 — Engagement Requirements



Recurring engagement requirements are generated automatically from the Platform Master.



Columns:



\* Engagement ID

\* Date

\* Creator ID

\* Platform ID

\* Activity

\* Required quantity

\* GPT prompt

\* Proof type

\* Submitted links

\* Completion status



Examples:



\* Medium: two article responses daily

\* LinkedIn: two meaningful comments daily

\* X: two relevant replies daily

\* CoinMarketCap: two market interactions daily



The bot does not automatically select the posts or articles.



Employees find relevant posts themselves.



\---



\### 13 — Submissions



Records everything submitted through Telegram.



Columns:



\* Submission ID

\* Assignment ID

\* Engagement ID

\* Creator ID

\* Platform ID

\* Submission type

\* Public link

\* Submitted time

\* Validation result

\* Notes



\---



\### 14 — Issues



Columns:



\* Issue ID

\* Creator ID

\* Platform ID

\* Account ID

\* Assignment ID

\* Issue type

\* Employee description

\* Screenshot or link

\* Created time

\* Status

\* Owner response

\* Resolution



\---



\### 15 — Dashboard



The owner should see:



\* Current system phase

\* Platform onboarding percentage

\* Active accounts

\* Incomplete accounts

\* Blocked accounts

\* Today’s base content

\* Today’s total assignments

\* Delivered assignments

\* Completed assignments

\* Missing assignments

\* Engagement completion

\* Problems

\* Creator completion rates

\* Platform completion rates



\---



\### Hidden Technical Tabs



\* Bot Users

\* Bot Message Log

\* Error Log

\* Sync Log

\* ID Generator

\* Dropdown Lists

\* Audit Log



\---



\# 5. File Two: Yaga Platform Onboarding



This file controls the entire initial onboarding operation.



Employees do not open it.



The Telegram bot reads instructions from this file and writes collected account information into it.



\## Onboarding File tabs



\### 01 — Platform Instructions



One row per platform.



Columns:



\* Platform ID

\* Platform name

\* Account creation link

\* Login method

\* Complete setup instruction

\* Display-name instruction

\* Username instruction

\* Bio source

\* Profile image source

\* Cover image source

\* Public-status instruction

\* Website-link instruction

\* Follow requirement

\* Follow-list source

\* Introduction-post requirement

\* Security key required

\* Activation requirements

\* Active status



The bot will combine these fields into one complete onboarding message.



\---



\### 02 — Creator-Platform Assignments



One row per assigned account.



Columns:



\* Creator ID

\* Platform ID

\* Account ID

\* Required

\* Priority

\* Assigned date

\* Onboarding status

\* Instruction sent

\* Credentials received

\* Setup confirmed

\* Activated

\* Current problem



Statuses:



\* Not Started

\* Instruction Ready

\* Instruction Sent

\* Waiting for Credentials

\* Waiting for Completion

\* Active

\* Blocked



\---



\### 03 — Restricted Credentials



This contains only the minimum information needed by the company.



Columns:



\* Credential Record ID

\* Account ID

\* Creator ID

\* Platform ID

\* Login email, phone or username

\* Password

\* Public account username

\* Security key or backup key, only when required

\* Credential updated date

\* Credential status



The employee will not be asked for:



\* Date of birth used

\* Country used

\* Account creation date

\* Recovery phone

\* Additional personal information

\* Unnecessary profile information



The bot already knows:



\* Creator

\* Platform

\* Assigned display name

\* Assigned bio

\* Assigned images

\* Assigned links

\* Required follows



It only needs to collect:



1\. Login identifier

2\. Password

3\. Actual public username

4\. Security key, only when applicable



The Restricted Credentials tab should only be accessible to the owner and automation account.



Passwords and security keys must never appear in:



\* Owner Telegram notifications

\* Employee confirmation messages

\* General activity logs

\* Dashboard

\* Master File account tables



The Master File stores only the Credential Record ID.



\---



\### 04 — Onboarding Progress



Columns:



\* Account ID

\* Creator ID

\* Platform ID

\* Instruction delivered

\* Credentials saved

\* Public status confirmed

\* Bio confirmed

\* Profile image confirmed

\* Cover image confirmed

\* Required follows confirmed

\* Introduction post confirmed

\* Activation status

\* Activation time



Most setup items are confirmed through one final button rather than individual bot questions.



\---



\### 05 — Activation Log



Columns:



\* Account ID

\* Creator ID

\* Platform ID

\* Activated time

\* Master File sync status

\* Owner notified

\* Employee notified

\* Errors



\---



\### 06 — Onboarding Issues



Used when:



\* Username is unavailable

\* Gmail cannot be used

\* Platform requires verification

\* Bio is too long

\* Image cannot be uploaded

\* Account is restricted

\* Security key is unavailable



\---



\# 6. Final Telegram Onboarding Experience



The bot gives the complete platform setup instruction in one response.



It does not question the employee about every profile setting.



\## Example onboarding message



```text

YAGA PLATFORM ONBOARDING



Platform: Medium

Account owner: \[Creator Name]



Complete the following setup:



1\. Create or open your Medium account:

\[Open Medium]



2\. Use this display name:

\[Approved Display Name]



3\. Try these usernames in order:

• \[Username Option 1]

• \[Username Option 2]

• \[Username Option 3]



4\. Add this bio:

\[Complete Medium Bio]



5\. Set the profile to public wherever applicable.



6\. Add this profile image:

\[Open Profile Image]



7\. Add this cover or supporting image where applicable:

\[Open Cover Image]



8\. Add this Yaga link:

\[Assigned Link]



9\. Follow at least five relevant accounts or publications related to:

• Cryptocurrency

• Trading

• Market analysis

• Investing

• Financial ambition



Recommended accounts:

1\. \[Account Link]

2\. \[Account Link]

3\. \[Account Link]

4\. \[Account Link]

5\. \[Account Link]



10\. Publish this introduction where applicable:

\[Introduction Content]



Image:

\[Optional Drive Link]



After completing the account setup, press:



\[Submit Account Details]

\[Report a Problem]

```



The onboarding instruction is generated from the Platform Onboarding File.



The employee receives everything in one place.



\---



\# 7. Minimal Credential Collection



After pressing \*\*Submit Account Details\*\*, the bot asks only the necessary questions.



\## Question One



```text

Send the email, phone number or username used to log in to this account.

```



\## Question Two



```text

Send the current account password.

```



After successful storage:



```text

Password saved.

```



The bot does not repeat the password.



\## Question Three



```text

Send the final public username or handle used for the account.

```



\## Question Four



Only when the Platform Master says a security key is required:



```text

Send the security key, backup key or platform security code that must be stored for this account.

```



\## Final confirmation



```text

Confirm that you completed the following:



• Added the assigned bio

• Added the assigned profile image

• Set the profile to public where applicable

• Followed at least five relevant accounts

• Added the assigned Yaga link

• Published the introduction where required



\[Confirm Setup Complete]

\[Go Back]

\[Report a Problem]

```



Once confirmed, the account is activated automatically.



\---



\# 8. Automatic Account Activation



The account becomes active when:



```text

Login identifier received

\+

Password received

\+

Public username received

\+

Security key received when required

\+

Setup completion confirmed

=

ACCOUNT ACTIVE

```



The automation then:



1\. Creates or updates the account in the Master File.

2\. Assigns the permanent Account ID.

3\. Connects the account to the creator.

4\. Connects the account to the platform.

5\. Connects the credential record.

6\. Sets `Account Status = Active`.

7\. Sets `Posting Ready = Yes`.

8\. Records the activation date.

9\. Notifies the employee.

10\. Notifies the owner.



\## Employee notification



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



\[Continue to Next Platform]

\[View My Accounts]

```



\## Owner notification



```text

YAGA ACCOUNT ACTIVATED



Creator:

\[Creator Name]



Platform:

Medium



Username:

@creatorname



Active accounts:

14 of 30



Remaining accounts:

16

```



No passwords or security keys appear in the owner notification.



\---



\# 9. Global Onboarding Gate



The Master File calculates:



\* Total required creator-platform accounts

\* Active accounts

\* Incomplete accounts

\* Blocked accounts

\* Completion percentage



Example:



```text

Creators: 3

Required platforms per creator: 10

Required accounts: 30

Active accounts: 27

Remaining accounts: 3

```



The Content Studio remains locked.



\## Locked message



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



When all required accounts are active, the owner receives:



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



\[Activate Content Operations]

```



Content operations begin only after the owner presses \*\*Activate Content Operations\*\*.



\---



\# 10. File Three: Yaga Content Studio



This is the owner’s daily working file.



It should be simple enough that the owner rarely needs to open the Master File.



\## Visible tabs



\* Dashboard

\* Daily Template

\* Date tabs

\* Content Archive



\## Buttons and controls



\* Add New Day

\* Validate Day

\* Send to Team

\* View Distribution

\* Cancel Unsent Day



For mobile reliability, the same controls should also exist as dropdown actions or checkboxes in the Dashboard.



\---



\# 11. Add New Day Workflow



The owner presses \*\*Add New Day\*\*.



The system asks for the date.



Example:



```text

2026-07-31

```



The automation:



1\. Checks whether the date already exists.

2\. Reads active platforms from the Master File.

3\. Reads the posting cadence for each platform.

4\. Reads active creators.

5\. Copies the Daily Template.

6\. Names the tab using the date.

7\. Creates the required platform rows.

8\. Creates one caption column per active creator.

9\. Registers the date in the Master File.

10\. Sets the day status to `Draft`.



Nothing is sent to Telegram.



\---



\# 12. Daily Content Tab



\## Header



\* Date

\* Day status

\* Base content count

\* Total creator assignments

\* Text assignment count

\* Image-backed assignment count

\* Article assignment count

\* Missing creator content

\* Distribution status



\## Main table



| Platform | Content Type | Slot | Publish Time | Shared Topic | Creator 1 Content | Creator 2 Content | Creator 3 Content | Drive Link | Notes |

| -------- | ------------ | ---: | ------------ | ------------ | ----------------- | ----------------- | ----------------- | ---------- | ----- |



\## Content types



\* Text Post

\* Image Post

\* Article

\* Thread

\* Carousel

\* Telegram Post

\* Story

\* Market Idea

\* Other



\---



\# 13. Content Volume Logic



For platforms that support regular posting:



\* Minimum two posts per day

\* Two base content rows per platform

\* One creator-specific caption per active creator



For article platforms:



\* One article every two days by default

\* The frequency remains configurable

\* Each creator receives their own version

\* One shared image may be used

\* Images remain optional



For Medium:



\* One article every two days

\* Two meaningful article responses per creator every day



\## Example with three creators



Suppose there are:



\* Nine regular posting platforms

\* One Medium account per creator



Daily publishing:



```text

9 platforms × 2 base posts = 18 base posts

18 base posts × 3 creators = 54 creator assignments

```



On a Medium article day:



```text

1 Medium article topic × 3 creators = 3 article assignments

```



Daily Medium engagement:



```text

2 responses × 3 creators = 6 response assignments

```



The owner summary would show:



```text

Base social content:

18



Creator social assignments:

54



Medium article assignments:

3



Medium response assignments:

6



Total employee actions:

63

```



The totals remain dynamic depending on active platforms and cadence.



\---



\# 14. Image Workflow



The owner uploads images into Google Drive.



The Drive link is pasted into the same content row.



\## When an image is provided



\* The same image may be used by every creator.

\* Every creator still receives a different caption.

\* The Telegram bot sends the image or provides the Drive link.

\* Image-backed assignment counts update automatically.



\## When no image is provided



\* The task becomes text-only.

\* The image field remains blank.

\* The Telegram bot does not request an image.

\* Nothing fails.



One base image can therefore support three creator posts without requiring three separate designs.



\---



\# 15. Send to Team Workflow



When the owner finishes the daily content, they press \*\*Send to Team\*\*.



The system validates:



\* The date is valid.

\* The day has not already been sent.

\* The system phase is `Content Active`.

\* Every assigned creator is active.

\* Every creator has an active account for the platform.

\* Required captions or articles are present.

\* Publishing times are present.

\* Drive links are valid when supplied.

\* Telegram chat IDs exist.

\* No duplicate assignments exist.



\## Confirmation summary



```text

READY TO DISTRIBUTE



Date:

July 31, 2026



Creators:

3



Platforms:

10



Base content:

19



Creator publishing assignments:

57



Text posts:

30



Image-backed posts:

24



Articles:

3



Engagement tasks:

6



Send to team?

```



The owner confirms once.



\---



\# 16. What Happens After Send to Team



The automation:



1\. Copies the date’s content into the Master File.

2\. Creates base content records.

3\. Creates one creator-content record per filled creator cell.

4\. Matches each creator to the correct platform account.

5\. Retrieves the account username.

6\. Retrieves the Telegram chat ID.

7\. Retrieves the platform-specific instruction.

8\. Retrieves the assigned CTA.

9\. Creates Telegram assignments.

10\. Sends each creator a daily summary.

11\. Delivers or schedules individual work messages.

12\. Generates recurring engagement tasks.

13\. Marks the date as `Sent`.

14\. Sends the owner a distribution report.



\---



\# 17. Employee Daily Telegram Experience



\## Daily summary



```text

YOUR YAGA WORK IS READY



Date:

July 31, 2026



Publishing assignments:

19



Text posts:

10



Image posts:

8



Articles:

1



Engagement requirements:

2



First scheduled post:

10:00 AM



\[View Today’s Work]

\[View Next Task]

\[Report a Problem]

```



\## Individual post task



```text

YAGA POSTING TASK



Platform:

LinkedIn



Account:

\[Creator Account]



Publish time:

10:00 AM



CAPTION



\[Complete creator-specific caption]



IMAGE



\[Image appears here or Drive link]



INSTRUCTION



Use the assigned account.

Keep the paragraph spacing.

Review the caption before publishing.

Do not add guaranteed-return claims.



\[Open Account]

\[Open Image]

\[Mark as Posted]

\[Report a Problem]

```



When the employee presses \*\*Mark as Posted\*\*, the bot asks:



```text

Send the public post link.

```



The submitted link updates:



\* Assignment status

\* Publication time

\* Public URL

\* Creator completion

\* Platform completion

\* Owner dashboard



\---



\# 18. Medium Daily Engagement



The bot does not choose the articles.



The employee finds two recent and relevant articles.



\## Final Medium engagement message



```text

MEDIUM DAILY ENGAGEMENT



Account:

@creatorname



Today’s requirement:



Find two recent Medium articles related to:



• Markets

• Cryptocurrency

• Investing

• Trading psychology

• Financial ambition

• Professional frustration

• Income growth

• Financial freedom



For each article:



1\. Read the article properly.

2\. Copy the full article or the relevant sections.

3\. Give the article to GPT using the prompt below.

4\. Review the response.

5\. Correct anything that feels unnatural or inaccurate.

6\. Publish the response from the assigned Medium account.

7\. Submit the public response link to this bot.



GPT PROMPT



Read the Medium article provided below and write a thoughtful response that I can publish under it.



The response must:



• Address one specific argument, observation or example from the article  

• Add a useful market observation, interpretation or perspective  

• Add personal experience only when it is true and relevant  

• Sound like a natural market observer and experienced writer  

• Show knowledge without sounding arrogant or excessively technical  

• Avoid generic praise such as “Great article” or “Very informative”  

• Avoid directly promoting Yaga Calls  

• Avoid asking readers to join a group or click a link  

• Avoid guaranteed-return language or exaggerated financial claims  

• Create enough intellectual curiosity for readers to naturally visit the writer’s profile  

• Be between 100 and 180 words  

• Return only the finished response  



ARTICLE:



\[Paste the article or relevant sections here]



After publishing both responses:



\[Submit Response 1]

\[Submit Response 2]

\[Report a Problem]

```



The profile performs the conversion.



The comment itself attracts attention through quality and intelligence.



The intended path is:



```text

Useful response

&#x20;   ↓

Profile visit

&#x20;   ↓

Creator articles

&#x20;   ↓

Understanding Yaga

&#x20;   ↓

Free Yaga community

```



\---



\# 19. GPT Prompt Library



The Master File should contain platform-specific GPT prompts for:



\* Medium responses

\* LinkedIn comments

\* X replies

\* CoinMarketCap comments

\* Binance Square comments

\* Reddit comments

\* Quora answers

\* Creator-specific caption rewriting

\* Article personalization



Employees should not write their own prompts.



The Telegram bot sends the correct prompt according to:



\* Platform

\* Activity type

\* Creator

\* Platform strategy



\---



\# 20. Telegram Bot Menus



Use one bot.



\## During onboarding



```text

YAGA TEAM OPERATIONS



\[Continue Platform Onboarding]

\[View Assigned Platforms]

\[View Active Accounts]

\[Report a Problem]

```



\## After content operations are activated



```text

YAGA TEAM OPERATIONS



\[Today’s Work]

\[Engagement Tasks]

\[My Accounts]

\[Submit Work]

\[Report a Problem]

```



\## Owner controls



```text

YAGA OWNER CONTROLS



\[Onboarding Status]

\[Active Accounts]

\[Today’s Distribution]

\[Today’s Completion]

\[Problems]

\[Creator Performance]

```



\---



\# 21. Google Drive Structure



```text

YAGA OPERATIONS

│

├── 00 Master Operations

├── 01 Platform Onboarding

├── 02 Content Studio

│

├── 03 Daily Content Assets

│   ├── 2026

│   │   ├── 07

│   │   │   ├── 2026-07-30

│   │   │   └── 2026-07-31

│

├── 04 Platform Profile Assets

│   ├── X

│   ├── CoinMarketCap

│   ├── LinkedIn

│   ├── Instagram

│   ├── Medium

│   └── Other Platforms

│

├── 05 Articles

├── 06 Results and Proof

├── 07 Onboarding Assets

├── 08 Introduction Posts

└── 09 Archive and Backups

```



Recommended content asset naming:



```text

CNT-20260731-001.png

CNT-20260731-002.jpg

```



\---



\# 22. Central Automation Engine



Use one central Apps Script project:



```text

Yaga Operations Engine

```



It should contain separate internal modules:



\* Master database module

\* Onboarding module

\* Credential collection module

\* Account activation module

\* Content Studio module

\* Assignment generation module

\* Telegram delivery module

\* Engagement module

\* Submission module

\* Owner notification module

\* Error-handling module

\* Backup module



The software can be technically sophisticated, but the visible controls remain simple.



\---



\# 23. Permanent ID Structure



Use permanent IDs rather than names.



```text

Creator:

CR-001



Platform:

PL-MEDIUM



Account:

AC-MEDIUM-CR001



Credential:

CRED-MEDIUM-CR001



Content Day:

DAY-20260731



Content:

CNT-20260731-001



Assignment:

ASN-20260731-001-CR001



Engagement:

ENG-20260731-MEDIUM-CR001-01



Issue:

ISS-20260731-001

```



Usernames and display names may change.



Permanent IDs do not.



\---



\# 24. Status Structure



\## Platform onboarding



\* Not Assigned

\* Not Started

\* Instruction Sent

\* Waiting for Credentials

\* Waiting for Confirmation

\* Active

\* Blocked



\## Account



\* Onboarding

\* Active

\* Restricted

\* Paused

\* Closed



\## Content day



\* Draft

\* Ready

\* Sent

\* Partially Delivered

\* Completed

\* Cancelled



\## Assignment



\* Pending

\* Delivered

\* Posted

\* Submitted

\* Completed

\* Problem

\* Cancelled



\---



\# 25. Implementation Plan



\## Phase 0 — Final Business Configuration



Finalize:



\* Initial creators

\* Initial platforms

\* Creator titles

\* Platform cadence

\* Article frequency

\* Engagement requirements

\* Username rules

\* Profile disclosure

\* Main Telegram destination

\* Initial follow lists

\* Creator voice profiles



\### Completion requirement



Every creator-platform combination is clearly defined.



\---



\## Phase 1 — File and Drive Foundation



Create:



\* Master Operations File

\* Platform Onboarding File

\* Content Studio File

\* Google Drive folder structure

\* Central Apps Script project

\* Internal Telegram bot



Set permissions.



\### Completion requirement



All file IDs and folder IDs are registered in the Master File.



\---



\## Phase 2 — Master Database



Build:



\* Team Members

\* Platform Master

\* Account Database

\* Creator Voices

\* Platform Playbooks

\* Profile Blueprints

\* Follow Directory

\* Settings

\* Status values

\* Permanent ID generation



\### Completion requirement



The Master File can represent every creator, platform and future account.



\---



\## Phase 3 — Platform Onboarding Database



Build:



\* Platform Instructions

\* Creator-Platform Assignments

\* Restricted Credentials

\* Onboarding Progress

\* Activation Log

\* Issues



Prepare the complete onboarding message for each platform.



\### Completion requirement



The Onboarding File contains everything the bot needs to onboard one creator onto one platform.



\---



\## Phase 4 — Telegram Bot Foundation



Build:



\* Employee registration

\* Telegram chat ID mapping

\* Employee menu

\* Owner menu

\* Button handling

\* Message logging

\* Problem reporting

\* Creator authorization



\### Completion requirement



The bot can identify each employee and owner correctly.



\---



\## Phase 5 — One-Message Platform Onboarding



Build:



\* Complete platform instruction delivery

\* Profile blueprint retrieval

\* Bio delivery

\* Asset delivery

\* Public-status instruction

\* Follow-at-least-five instruction

\* Introduction-post delivery

\* Minimal credential collection

\* Setup confirmation



\### Completion requirement



An employee can complete one platform without opening any spreadsheet.



\---



\## Phase 6 — Automatic Account Activation



Build:



\* Credential storage

\* Security-key conditional question

\* Account ID creation

\* Master File sync

\* Posting-ready activation

\* Employee confirmation

\* Owner confirmation

\* Duplicate-account protection



\### Completion requirement



A completed onboarding automatically creates an active Master File account.



\---



\## Phase 7 — Pilot Test



Test with:



\* One creator

\* One platform

\* One complete account onboarding



Verify:



\* Instructions are clear

\* Credentials are recorded

\* Profile information is correct

\* Account activates

\* Master File updates

\* Owner receives confirmation



Then test:



\* Three creators

\* One platform



Then:



\* One creator

\* All platforms



\### Completion requirement



The onboarding flow works without manual spreadsheet correction.



\---



\## Phase 8 — Complete Initial Platform Onboarding



Onboard every required account.



The dashboard tracks:



\* Required accounts

\* Active accounts

\* Remaining accounts

\* Blocked accounts



\### Completion requirement



Every required creator-platform account is active.



\---



\## Phase 9 — Activate Content Operations



When onboarding reaches 100%, the owner receives the activation control.



The owner presses:



```text

ACTIVATE CONTENT OPERATIONS

```



The Master File changes:



```text

System Phase = Content Active

```



\### Completion requirement



The Content Studio is unlocked.



\---



\## Phase 10 — Build Content Studio



Build:



\* Dashboard

\* Daily Template

\* Add New Day

\* Dynamic date-tab generation

\* Dynamic creator columns

\* Platform cadence loading

\* Optional Drive-link fields

\* Validation

\* Content Archive



\### Completion requirement



The owner can prepare a complete day without opening the Master File.



\---



\## Phase 11 — Send to Team Automation



Build:



\* Day validation

\* Assignment calculations

\* Confirmation summary

\* Master File write

\* Account lookup

\* Telegram user lookup

\* Content distribution

\* Owner summary

\* Failed-delivery reporting

\* Duplicate-send protection



\### Completion requirement



One control distributes the entire day correctly.



\---



\## Phase 12 — Employee Publishing Workflow



Build:



\* Daily summary

\* Today’s assignments

\* Next-task view

\* Caption delivery

\* Image delivery

\* Posted button

\* Public-link submission

\* Problem button

\* Completion tracking



\### Completion requirement



Employees complete daily work entirely through Telegram.



\---



\## Phase 13 — Engagement Prompt Module



Build:



\* Medium response requirements

\* Platform-specific GPT prompts

\* Submission of comment links

\* Daily engagement completion

\* Missing engagement reminders



Then add:



\* LinkedIn comments

\* X replies

\* CoinMarketCap comments

\* Binance Square engagement

\* Other platform-specific activities



\### Completion requirement



The bot can assign and verify recurring engagement without the owner creating those tasks daily.



\---



\## Phase 14 — Owner Dashboard and Reporting



Build:



\* Daily distribution status

\* Employee completion

\* Platform completion

\* Missing links

\* Failed assignments

\* Engagement completion

\* Account problems

\* Onboarding status

\* Weekly totals



\### Completion requirement



The owner can understand the operation from one dashboard and Telegram summary.



\---



\## Phase 15 — Conversion Tracking



Later add:



\* Unique Telegram invite links

\* Platform source IDs

\* Creator source IDs

\* Free-group joins

\* VIP inquiries

\* Paid conversions

\* Revenue attribution



\### Completion requirement



Yaga can identify which creators, platforms and content produce meaningful growth.



\---



\## Phase 16 — Reliability and Backup



Build:



\* Daily backups

\* Failed-message retry

\* Duplicate protection

\* Error logs

\* Account access review

\* Credential update tracking

\* Archive process

\* Manual emergency controls



\### Completion requirement



A failed message, incorrect row or accidental duplicate action cannot disrupt the whole operation.



\---



\# 26. What Will Not Be Built Initially



Do not build:



\* Separate employee spreadsheet files

\* Separate onboarding and content bots

\* Automatic selection of articles to comment on

\* Automatic selection of X posts to reply to

\* Automatic public posting

\* Automatic likes

\* Automatic comments

\* Complicated employee dashboards

\* Advanced analytics scraping

\* Customer bot functionality

\* AI API integration



Employees will use GPT manually with the prompts supplied by the bot.



This keeps the first version simpler and cheaper.



\---



\# 27. Final Operating Experience



\## Owner experience



The owner will:



1\. Configure platform requirements.

2\. Assign platforms to creators.

3\. Monitor onboarding.

4\. Activate content operations.

5\. Create a date tab.

6\. Add content.

7\. Add unique creator captions.

8\. Add optional Drive links.

9\. Press Send to Team.

10\. Monitor completion.



\## Employee experience during onboarding



The employee will:



1\. Open the Telegram bot.

2\. Receive one complete platform setup message.

3\. Create and configure the account.

4\. Submit login details.

5\. Confirm setup.

6\. Move to the next platform.



\## Employee experience during daily operations



The employee will:



1\. Open Telegram.

2\. View assigned work.

3\. Copy the caption.

4\. Download the image when available.

5\. Publish.

6\. Submit the public link.

7\. Complete assigned engagement activities.

8\. Report problems through the bot.



\## Backend experience



The automation will:



\* Connect creators to platforms

\* Connect accounts to credentials

\* Activate accounts

\* Generate daily assignments

\* Deliver content

\* Collect links

\* Update statuses

\* Notify the owner

\* Maintain logs and backups



\---



\# 28. Final Architecture Summary



```text

YAGA PLATFORM ONBOARDING FILE

Stores instructions, progress and restricted credentials

&#x20;       ↓

YAGA MASTER OPERATIONS FILE

Stores active creators, platforms, accounts and operational records

&#x20;       ↓

YAGA CONTENT STUDIO

Allows the owner to create and distribute daily content

&#x20;       ↓

YAGA TELEGRAM BOT

Handles onboarding, daily work, engagement and submissions

&#x20;       ↓

EMPLOYEES

Create accounts, publish content, engage and submit links

&#x20;       ↓

MASTER OPERATIONS FILE

Updates completion, account status and performance

```



The build order is final:



```text

1\. Master database

2\. Platform Onboarding File

3\. Telegram bot

4\. Guided account onboarding

5\. Automatic account activation

6\. Complete all required platforms

7\. Owner activates content operations

8\. Content Studio

9\. Daily Telegram distribution

10\. Engagement prompts

11\. Reporting

12\. Conversion tracking

```



