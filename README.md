# Wera for Chrome

[![CI](https://github.com/wera-jobs/wera-extension/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wera-jobs/wera-extension/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/wera-jobs/wera-extension/badges/coverage.json)](https://github.com/wera-jobs/wera-extension/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/wera-jobs/wera-extension?sort=semver&display_name=tag)](https://github.com/wera-jobs/wera-extension/releases)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?logo=googlechrome&logoColor=white)](manifest.json)
[![Tested with Playwright](https://img.shields.io/badge/e2e-Playwright-2EAD33?logo=playwright&logoColor=white)](e2e)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-fe5196?logo=conventionalcommits&logoColor=white)](https://www.conventionalcommits.org)
[![License: proprietary](https://img.shields.io/badge/license-proprietary-lightgrey)](LICENSE)

Chrome extension for [Wera](https://github.com/wera-jobs/Wera). Save jobs from any page, see fit scores and H-1B data, tailor your resume, draft answers, and fill applications. **Wera never clicks Submit.** You review and submit yourself.

## What it does

- **On-page panel:** Opens docked on application forms and waits as a movable right-edge tab on job postings (toggle anytime with `Alt+Shift+W`). Shows the job, pay, posting age, fit score, keyword coverage, and sponsorship/H-1B data.
- **Job pages only:** Activates only on positive evidence (known ATS URLs, schema.org job data, embedded application forms, or careers pages). Never appears in email, chat, docs, or shopping sites, and can be disabled per site.
- **Autofill with guardrails:** Attaches your tailored (or main) resume and cover letter first, fills known details and saved answers, then asks Wera's AI in parallel for remaining fields. Anything needing your judgment (required blanks, consents, salary, low-confidence yes/no, or drafts) stays in **Needs you**.
- **Strict accuracy:** Matches degrees, schools, addresses, and self-identification faithfully rather than guessing. Work authorization for other countries and salary are never guessed; self-identification is never sent to the AI.
- **AI-trap defense:** Ignores hidden text and honeypot inputs, strips prompt-injection lines aimed at AI tools before reading, and leaves human-check questions to you.
- **Multi-page forms & learning:** Follows multi-step applications (never pressing Submit), remembers answers you enter for reuse, and automatically marks the job **Applied** on confirmation with an undo toast.
- **Wera button & referrals:** Focus any open question to draft or rework answers (`Shorter`, `Longer`, `Again`, or custom instructions). Open LinkedIn referral searches and draft a short connection note from your profile.
- **My details:** One-tap copy of any saved application detail right from the panel.

### Supported systems

Dedicated site rules for **Workday**, **Greenhouse** (including embedded boards), **Lever**, **Ashby**, **Jobvite**, and **Workable**, plus general form detection for **iCIMS**, **Oracle**, **Rippling**, **SmartRecruiters**, **Teamtailor**, **Breezy**, **Personio**, **Pinpoint**, **JazzHR**, **Recruitee**, **Dover**, **Eightfold**, and LinkedIn Easy Apply dialogs.

## Architecture

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-dark.svg">
  <img alt="Wera for Chrome architecture: the Wera panel in the job site tab reads and fills the page through the page script; the service worker relays its calls to the Wera API, with a bearer token, and to the page's frames; the API keeps hashed tokens in PostgreSQL and is the only part that calls the LLM API" src="docs/architecture.svg">
</picture>

- `src/page/`: Runs in every frame to detect job pages, mount the panel, handle the Wera button, and watch for confirmations.
- `src/content/`: Pure DOM form engine (`fields`, `hidden`, `classify`, `entries`, `values`, `match`, `places`, `plan`, `fill`, and `sites/` rules).
- `src/panel/`: React UI mounted inside a closed shadow root on the top frame.
- `src/background/`: Service worker relaying API calls and cross-frame form actions.
- `src/bridge/`: Runs on your Wera dashboard to hand off job links, sync changes, and share theme.
- `src/shared/`: API client, typed RPC, storage, settings, trap filters, errors, and logging.

## Privacy & permissions

- **Permissions:** `storage`, `activeTab`, `scripting`, `contextMenus`, and site access (needed to detect job pages and fill embedded forms). Non-job pages are checked locally and nothing is sent.
- **Auth:** Connects from the dashboard or signs in once to store a revocable bearer token in `chrome.storage.local`.
- **Isolation:** Panel UI lives in a closed shadow root; page text sent to the AI is scrubbed of traps and fenced as data; self-ID answers never reach the AI.

## Install

Wera for Chrome is in private pilot (Chrome Web Store submission pending). Download and unzip the latest release from [Releases](https://github.com/wera-jobs/wera-extension/releases/latest), or build locally:

```sh
npm install
npm run build       # builds to dist/
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `dist/`. Use `npm run dev` to rebuild on change.

## Quality checks

```sh
npm run lint        # ESLint (zero warnings)
npm run typecheck   # TypeScript
npm test            # Vitest unit tests
npm run coverage    # Coverage report
npm run e2e         # Playwright in Chromium against a Wera API
npm run package     # Build zip for release / Web Store
```

Enable **Debug log** in panel Settings to trace `[wera:*]` logs in the page and service-worker consoles, or use **Report a problem** after a fill to send diagnostics to Wera Admin.

Commits follow [Conventional Commits](https://www.conventionalcommits.org); [release-please](https://github.com/googleapis/release-please) cuts releases and attaches `wera-extension-<version>.zip`.

## License

Copyright (c) 2026 Wera. All rights reserved. This code is proprietary: it is visible here, but that grants no right to use, copy, modify or distribute it (see [LICENSE](LICENSE)). The Wera name and logo are trademarks of Wera. Third-party packages keep their own licenses, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); regenerate it with `node scripts/third-party-notices.mjs` after changing dependencies.
