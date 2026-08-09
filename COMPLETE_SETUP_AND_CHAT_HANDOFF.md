# Job Application Assistant: Complete Setup and Chat Handoff

This document is the practical handoff from the debugging session completed on
August 8-9, 2026. It is written so the repository can be cloned into a brand-new
VS Code installation and used without an advanced Copilot model.

The automation itself does not depend on Copilot. Copilot was only used to edit
and debug the source code. Once the files are committed and pushed, Node.js and
Google Chrome are all that are needed to run it.

## 1. Current Working Behavior

The project now:

- opens the Wellfound jobs feed in a visible Chrome window;
- uses a saved local browser profile, so login is normally needed only once;
- finds job titles matching the configured keywords;
- skips blocked titles such as senior, principal, director, manager, and lead;
- no longer excludes matching jobs merely because they are more than 14 days old;
- opens the real application form rather than confusing it with the sidebar;
- handles location-mismatch applications by selecting `I can relocate to...`;
- opens the associated location dropdown and selects the offered job location;
- refreshes DOM references after Wellfound/React rerenders the modal;
- fills the long cover letter and verifies it again immediately before submit;
- refuses to submit if the live cover-letter textarea is empty;
- supports final buttons labelled either `Send application` or form-level `Apply`;
- confirms submission before counting an application;
- writes submitted applications to both CSV and XLSX;
- enforces a 50-applications-per-day Wellfound cap;
- waits 40-100 seconds between attempts;
- scrolls the Wellfound job-feed container to load additional cards;
- remembers attempted job URLs in the tab session so reinjection does not retry
  the same job repeatedly.

Known successful live sequence from the debugging session:

```text
chose "I can relocate to..." (checked=true)
opening dropdown: <input>
location: Raipur
cover letter verified before submit
clicked Apply, waiting for confirmation...
application sent (confirmed)
```

Noida, Navi Mumbai, Raipur, and Gurgaon relocation flows were exercised during
the session. The Raipur and Gurgaon runs also verified the cover letter before
submitting.

## 2. Important: Push This Working Copy Before Moving

A clone only contains committed and pushed files. At the time this handoff was
created, the important fixes were local changes, and `backfill-xlsx.js` was a new
untracked source file.

Do not use `git add .` until the new `.gitignore` is committed. The repository
contains private/local files such as `.env`, the Chrome profile, and application
history. The `.gitignore` added with this guide protects them.

From the current machine, run:

```powershell
git status --short
git add .gitignore COMPLETE_SETUP_AND_CHAT_HANDOFF.md README.md `
  auto-apply-runner.js wellfound-auto-apply.js config.js `
  package.json package-lock.json .env.example backfill-xlsx.js
git diff --cached --check
git status --short
git commit -m "Complete Wellfound relocation flow and setup handoff"
git push
```

Before committing, confirm that these paths are not staged:

```text
.env
.wellfound-chrome-profile/
node_modules/
applications.csv
applications.xlsx
apply-state-wellfound.json
blocked-step-wellfound.png
```

Never commit `.env`. It contains personal information and may contain credentials
or API keys. Never commit `.wellfound-chrome-profile`; it contains a saved login
session.

## 3. Fresh Computer Requirements

Install these programs manually:

1. Git: <https://git-scm.com/download/win>
2. Node.js 20 LTS or newer: <https://nodejs.org/>
3. Google Chrome: <https://www.google.com/chrome/>
4. Visual Studio Code: <https://code.visualstudio.com/>

Open PowerShell and verify them:

```powershell
git --version
node --version
npm --version
```

Node.js 18 or newer should work, but Node.js 20 LTS or newer is the recommended
choice for a new installation.

No special VS Code extension is required. No paid or advanced Copilot model is
required. A normal PowerShell terminal inside VS Code is sufficient.

## 4. Clone and Install

Use the URL of the repository containing the commit from section 2:

```powershell
git clone <YOUR_REPOSITORY_URL>
cd job-application-assistant
code .
npm ci
```

Use `npm ci`, not separate package-install commands. It reads `package-lock.json`
and installs the exact dependency tree used by the project.

The installed runtime packages are:

| Package | Purpose |
|---|---|
| `playwright-core` | Controls the locally installed Google Chrome browser. |
| `playwright-extra` | Adds Playwright plugin support. |
| `puppeteer-extra-plugin-stealth` | Reduces obvious automation fingerprinting. |
| `exceljs` | Creates and updates the real `.xlsx` application log. |

Do not run `npx playwright install` unless Chrome is unavailable. The runner uses
the installed Google Chrome channel rather than downloading a Playwright browser.

Check the installation:

```powershell
npm run check
npm ls --depth=0
```

## 5. Create the Personal Configuration

Create `.env` from the safe template:

```powershell
Copy-Item .env.example .env
code .env
```

Fill these fields:

```dotenv
NAME=Your Name
EMAIL=you@example.com
PHONE=+91 ...
LOCATION=City, Country
CURRENT_ROLE=Your current title at Company
COMPANY=Your current company
EDUCATION=Your degree and institute
YEARS_EXPERIENCE=Your experience summary
SKILLS=JavaScript, TypeScript, Python, React, Node.js, ...
HIGHLIGHTS=First achievement||Second achievement||Third achievement
NOTICE_PERIOD=30 days
CURRENT_CTC=0
EXPECTED_CTC=0
DOB=DD/MM/YYYY
GENDER=Prefer not to say
WORK_AUTH=Authorized to work in my country of residence.
GITHUB_URL=https://github.com/...
LINKEDIN_URL=https://www.linkedin.com/in/...
PORTFOLIO_URL=https://...
GEMINI_KEY=
```

Notes:

- Separate resume highlights with `||`.
- `GEMINI_KEY` is optional. Leave it empty to use the built-in answer bank.
- `GOOGLE_EMAIL`, `GOOGLE_PASSWORD`, and `NAUKRI_PROFILE_URL` remain in the
  shared template but are not required for this Wellfound-only runner.
- The long generic cover letter is generated from these values. It was explicitly
  preserved during the debugging session; do not replace it with a shorter version
  unless that is intentional.

## 6. Log In to Wellfound Once

The browser profile is intentionally not stored in Git, so every new computer
must perform a fresh login once:

```powershell
npm run wellfound:login
```

A Chrome window opens.

1. Log in to Wellfound manually.
2. Complete any email, captcha, or DataDome verification.
3. Confirm the jobs page is accessible.
4. Close the Chrome window opened by the command.

The session is saved locally under `.wellfound-chrome-profile/`.

Do not open two runners at the same time. Chrome permits only one process to own
that profile. If a command appears stuck before printing `Starting`, close the
previous automation Chrome window and stop the previous terminal with `Ctrl+C`,
then try again.

## 7. Set Wellfound Search Filters

The project uses the cards shown by <https://wellfound.com/jobs>. Wellfound saves
the account's search/filter choices.

Before a long run, open the jobs page and choose the desired location, remote,
experience, compensation, and role filters. The script then performs its own title
keyword and blocklist filtering on the visible feed.

The title lists are near the top of `wellfound-auto-apply.js`:

- `TITLE_KEYWORDS`: roles that are allowed;
- `TITLE_BLOCKLIST`: roles that are rejected.

Examples from the screenshot discussed in the chat:

- `Software Engineer (AI Agents)`: allowed by `software engineer`;
- `Senior Software Engineer - 2 (SSE-2)`: rejected by `senior`;
- `Software Engineer - AI Platform`: allowed even when posted two months ago.

Posting age is no longer a rejection rule.

## 8. Test Safely, Then Run Live

Always start with a dry run on a new machine:

```powershell
npm run wellfound:dry
```

Dry run fills forms but does not submit them. Watch at least one normal form and
one relocation form.

Start live mode only after the dry run looks correct:

```powershell
npm run wellfound:live
```

Keep the automation Chrome tab open and do not navigate it manually while a job
is being processed. The browser is headed because Wellfound's bot checks tend to
block headless sessions.

Equivalent direct commands are:

```powershell
node auto-apply-runner.js wellfound
node auto-apply-runner.js wellfound --live
```

Stop a run with `Ctrl+C` in its terminal.

## 9. How to Read the Logs

Healthy relocation application:

```text
real apply modal already open
chose "I can relocate to..." (checked=true)
opening dropdown: <input>
location: Gurgaon
cover letter verified before submit
clicked Apply, waiting for confirmation...
application sent (confirmed)
```

Only `application sent (confirmed)` increments the daily count and writes a log
row. A click without confirmation is not counted.

Some messages are informational:

- `cover letter textarea was not ready yet; will retry before submit` is acceptable
  when it is later followed by `cover letter verified before submit`.
- `locator.click failed: Element is outside of the viewport` can be harmless when
  it is followed by `checked=true`; the trusted coordinate fallback succeeded.
- `location-blocked by company` means the employer disallows the current location
  and the application cannot be completed through relocation choices.
- `0 match filters` means cards exist but none currently pass keyword/blocklist
  filtering, or all eligible URLs have already been attempted in that tab.

The runner currently prints logs to the terminal. The CSV/XLSX files are the
persistent application records.

## 10. Generated Files

These files are local and intentionally ignored by Git:

| Path | Purpose |
|---|---|
| `.env` | Personal profile data and optional API key. |
| `.wellfound-chrome-profile/` | Saved Wellfound Chrome login. |
| `applications.csv` | Append-only submitted-application history. |
| `applications.xlsx` | Excel version of the submitted-application history. |
| `apply-state-wellfound.json` | Current day's submitted count. |
| `blocked-step-wellfound.png` | Diagnostic screenshot for a blocked form. |
| `node_modules/` | Installed npm packages. Recreated by `npm ci`. |

If application history must move to the new computer, copy `applications.csv`
and `applications.xlsx` separately using a private method. Do not put them in a
public repository.

The daily state resets automatically when the calendar date changes. On a fresh
clone with no state file, the local counter starts at zero; Wellfound itself may
still show previously submitted jobs as already applied.

## 11. Excel Logging and Backfill

Every confirmed live submission is appended to both CSV and XLSX. The columns are:

```text
Date, Site, Role, Company, CTC/Salary, Skills, Job Link, Job Description
```

To rebuild `applications.xlsx` from `applications.csv`:

```powershell
npm run xlsx:backfill
```

The workbook has a bold frozen header, filters, column widths, and clickable job
links. Close `applications.xlsx` in Excel before running if Windows reports that
the file is locked.

## 12. Architecture

### `auto-apply-runner.js`

- launches persistent Google Chrome through Playwright;
- injects `.env` data without hard-coding personal information;
- exposes trusted mouse/selector click bridges to the page script;
- reads `wellfound-auto-apply.js` from disk for each injection;
- enforces the daily cap and 100-minute runtime;
- writes confirmed applications to CSV and XLSX;
- supervises and reinjects the page script when needed.

### `wellfound-auto-apply.js`

- finds and filters job cards;
- opens job/application overlays;
- fills questions and the cover letter;
- handles relocation radio/dropdown state;
- follows live React modal replacements with refreshed DOM references;
- submits only after validating the live form;
- confirms success before reporting a submission;
- scrolls the job feed and remembers attempted URLs in `sessionStorage`.

### `config.js`

- parses `.env` without an extra dependency;
- builds the `CV` object and common application answers;
- exports the optional Gemini key.

### `backfill-xlsx.js`

- parses the existing CSV;
- rebuilds a formatted Excel workbook;
- is safe to rerun when CSV is the source of truth.

## 13. Main Bugs Fixed During This Chat

This is the technical history needed if a simpler Copilot must debug the project
later.

1. Dynamic injection
   - The runner now calls `buildInjection()` at injection time so edits are read
     from disk instead of using an undefined/stale injection variable.

2. Disabled submit button modal detection
   - A location-mismatch form is still a real form even while its submit button is
     disabled. Detection uses rendered geometry rather than requiring enabled state.

3. Relocation radio
   - Generic wrapper `<div>` clicks timed out or did nothing.
   - The script finds the actual `input[type="radio"]` by label text.
   - It uses a trusted Playwright/CDP coordinate click.
   - It re-queries the live radio and proceeds only when `checked === true`.
   - The old fake fallback that assigned `.checked = true` was removed because it
     did not update React state.

4. React modal replacement
   - Selecting a radio or location can replace the entire modal DOM subtree.
   - `refreshScope()` finds the current live modal after state-changing actions.

5. Location dropdown
   - The script supports native selects, react-select/combobox inputs, and custom
     triggers, then finds options rendered in a document-level portal.

6. Wrong Apply button
   - A broad submit matcher once clicked the sidebar `Apply` opener after selecting
     a location, reopening a blank form.
   - Submission now prefers `Send application`; a plain `Apply` is accepted only
     when it belongs to the same form as the application textarea.

7. Blank cover letter
   - Relocation changes sometimes made the textarea available only later or reset it.
   - `ensureCoverLetter()` waits, fills, refreshes, refills, and verifies the exact
     live textarea value immediately before submission.
   - A blank application is skipped rather than submitted.

8. XLSX support
   - `exceljs` was added.
   - Confirmed applications append to `.xlsx` as well as `.csv`.
   - `backfill-xlsx.js` rebuilds Excel history from CSV.

9. Title coverage
   - SDE variants and additional software/platform/cloud/SRE/language-specific role
     keywords were added.
   - The long cover letter and 40-100 second pacing were intentionally preserved.

10. Only one eligible job discovered
    - The old code rejected cards posted more than 14 days ago. That cutoff was
      removed because visible matching jobs can still accept applications.
    - The feed loader now looks for the nested scroll container instead of assuming
      `window` is the scrolling surface.
    - Attempted URLs persist in `sessionStorage` across reinjections.
    - The runner already owns the `window.__aaBusy` guard; a duplicate guard inside
      the injected script was removed because it caused immediate silent exit.

## 14. Troubleshooting

### Command prints nothing before `Starting`

Usually the Chrome profile is still owned by a previous automation process.

1. Press `Ctrl+C` in old runner terminals.
2. Close the Chrome window opened by the runner.
3. Wait for that window to close fully.
4. Run `npm run wellfound:live` again.

Do not kill every Chrome process if personal Chrome windows are open.

### `0 job cards found`

- Check whether Wellfound shows a captcha or `Verification Required`.
- Run `npm run wellfound:login`, solve it manually, close that Chrome, and restart.
- Confirm the jobs feed is actually visible while logged in.

### Cards exist but the log says `0 match filters`

- Compare card titles with `TITLE_KEYWORDS` and `TITLE_BLOCKLIST`.
- `Senior Software Engineer` is intentionally blocked by `senior`.
- Posting age is no longer a reason for exclusion in the current code.
- Look for `scrolling job feed via ...`; it shows which container is being scrolled.

### The same already-applied job is retried

- Ensure the current code includes `__aaWellfoundSeen` session storage.
- Restart once after pulling the latest commit.
- The tab-scoped seen list resets only when a new browser/tab session starts.

### `no apply overlay found`

The job may already be applied, closed, externally hosted, or its overlay may not
have rendered. It is skipped and not counted.

### Relocation radio does not select

The flow must show `checked=true`. If it says it could not select the radio, capture
the terminal lines and a screenshot. Do not restore the old `.checked = true`
assignment; it produced a false success without updating React.

### Location is selected but the form reopens blank

That was caused by clicking the sidebar's `Apply` button. The current
`findSubmitButton()` must remain anchored to the application textarea/form.

### Description/cover letter is empty

The script must print `cover letter verified before submit`. It now refuses to
submit otherwise.

### XLSX is missing

```powershell
npm ci
npm run xlsx:backfill
```

Also close Excel if it has locked the workbook.

## 15. Validation Checklist After Cloning

Run this checklist in order:

```powershell
npm ci
Copy-Item .env.example .env
# Fill .env
npm run check
npm run wellfound:login
npm run wellfound:dry
```

During dry run, verify:

- a matching normal job opens;
- the long cover letter appears;
- a relocation job gets `checked=true`;
- the offered location appears in the dropdown;
- `cover letter verified before submit` appears;
- dry run does not send the application;
- new cards load when the first visible card batch has no matches.

Then run:

```powershell
npm run wellfound:live
```

For the first live application, wait for:

```text
application sent (confirmed)
```

Finally verify that both files exist and contain the submitted role:

```text
applications.csv
applications.xlsx
```

## 16. Safe Update Routine

When making future changes:

```powershell
git pull
npm ci
npm run check
npm run wellfound:dry
```

Commit only source/configuration templates and documentation. Keep `.env`, Chrome
profiles, application history, state files, screenshots, and `node_modules` local.

## 17. Quick Command Reference

```powershell
# Install exact dependencies
npm ci

# Validate JavaScript syntax
npm run check

# Create saved Wellfound login on this computer
npm run wellfound:login

# Fill forms without submitting
npm run wellfound:dry

# Submit live applications
npm run wellfound:live

# Rebuild Excel from CSV
npm run xlsx:backfill
```

That is the complete operational and debugging handoff from this chat.
