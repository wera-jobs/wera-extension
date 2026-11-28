# Store listing kit

Everything the Chrome Web Store (and Edge Add-ons) submission form asks for,
ready to paste. Submitting needs the owner's developer account (a one-time
registration fee), so the steps at the end are theirs.

## Item

- **Name:** Wera: job applications
- **Category:** Workflow & Planning
- **Language:** English
- **Package:** `wera-extension-<version>.zip` from the latest [release](https://github.com/wera-jobs/wera-extension/releases/latest)
- **Homepage:** https://www.wera-jobs.com
- **Support:** https://www.wera-jobs.com (Settings › Report a problem, or the panel's Feedback button)
- **Privacy policy:** https://www.wera-jobs.com/privacy

## Short description (132 characters at most)

Fill job applications from your resume on Workday, Greenhouse, Lever and more. You review every answer and press Submit yourself.

## Detailed description

Wera fills job applications from your own resume and details, on the sites
companies actually use: Workday, Greenhouse, Lever, Ashby, iCIMS,
SmartRecruiters, Jobvite, Workable and many more.

What it does
- Fills your details, work history, education and saved answers, and attaches
  your resume and cover letter.
- Drafts answers to open questions from your real experience, and leaves
  anything that needs your judgment (salary, consents, self-identification you
  have not set) for you, clearly marked.
- Follows multi-page applications, one page at a time.
- Shows how well a job fits you, pay, and visa sponsorship history, on the
  posting itself.
- Writes and tailors a cover letter and resume for the job, in the panel.

What it never does
- It never presses Submit. You read every answer and submit yourself.
- It never guesses work authorization, salary or demographic answers.
- It never sends self-identification answers to the AI.

Wera needs a free Wera account. It only appears on job postings and
application forms, never in email, chat or documents.

## Single purpose

Help the user apply to jobs: read job postings and application forms, and
fill the forms from the user's own Wera profile, for the user to review and
submit.

## Permission justifications

- **storage:** keeps the user's sign-in token, settings, and the progress of a
  multi-page application on this device.
- **scripting:** loads Wera's form filler into a page only after the
  lightweight detector has found a job posting or application form there,
  including forms embedded in another site's frame.
- **contextMenus:** adds "Fill this application with Wera" to the right-click
  menu.
- **Host permissions (all sites):** companies host their applications on
  their own domains and on hundreds of applicant systems, often inside
  frames, so Wera cannot know the site in advance. On every other page a
  small local check finds no job content and does nothing; nothing is sent.
- **Remote code:** none. All code ships in the package. Site rules fetched
  from the user's Wera server are data (patterns and CSS selectors), never
  code.

## Data use disclosures

Collected, only to provide the feature, never sold or used for anything else:
- **Personally identifiable information** and **website content**: the
  application form's questions and the job posting are sent to the user's
  Wera account to draft answers and score fit.
- **Authentication information**: a revocable sign-in token kept on the
  device. A job-site password the user chooses to keep (for Workday accounts)
  is encrypted on the device and never leaves the browser.

Certify: not sold to third parties; not used for purposes unrelated to the
item's single purpose; not used for creditworthiness or lending.

## Screenshots (1280 x 800, PNG)

1. The panel on a Workday application, filled, with "Needs you" items.
2. A Greenhouse form mid-fill, fields ticking green in the panel.
3. A job posting with the fit score, pay and sponsorship card.
4. The cover letter card: read, edit, change tone.
5. The Wera button drafting an answer to an open question.

Take them on the practice form (https://www.wera-jobs.com/practice) or a live
posting with a test account; never with a real person's details.

Small promo tile (440 x 280): the Wera mark on the brand color with
"Apply faster. Submit yourself."

## Submit (the owner)

1. Register at https://chrome.google.com/webstore/devconsole (one-time fee).
2. New item, upload the release zip, paste the fields above, add the
   screenshots and tile.
3. Submit for review (typically a few days for all-sites access).
4. Once live, link the store page from the dashboard's Settings › Chrome
   extension and the welcome page.
5. Edge: https://partner.microsoft.com/dashboard/microsoftedge, same zip and
   text. Firefox: `npm run build:firefox`, zip `dist-firefox/`, and submit at
   https://addons.mozilla.org/developers.
