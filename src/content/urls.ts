// URL and host patterns for recognizing job postings, applicant tracking
// systems, and sites that are never job pages (mail, chat, docs, feeds).
// Kept free of DOM/field-engine imports so the lightweight detector script
// (detector.js) stays tiny on non-job pages.

// One job's page or its application, on the systems and boards people apply
// through. Tested on the host and path, so a link to one in another page's
// query (a search result, a redirect) is not one.
export const JOB_ADDRESSES: RegExp[] = [
  // Applicant tracking systems.
  /^(boards|job-boards)(\.eu)?\.greenhouse\.io\/(embed\/job_app|[^/]+\/jobs\/\d+)/,
  /^jobs(\.eu)?\.lever\.co\/[^/]+\/[0-9a-f-]{36}/,
  /^jobs\.ashbyhq\.com\/[^/]+\/[0-9a-f-]{36}/,
  /\.myworkday(jobs|site)\.com\/.*\/job\//,
  /^jobs\.smartrecruiters\.com\/(oneclick-ui\/|[^/]+\/\d+)/,
  /^apply\.workable\.com\/[^/]+\/j\/[0-9a-z]+/i,
  /^jobs\.workable\.com\/.*[?&]selectedjobid=/i,
  /^ats\.rippling\.com\/[^/]+\/jobs\/[0-9a-f-]+/,
  /\.rippling-ats\.com\/job\//,
  /\/hcmui\/candidateexperience\/.*\/(job|apply)\//i,
  /\.icims\.com\/jobs\/\d+/,
  /\/careers-home\/jobs\/\d+/,
  /^jobs\.jobvite\.com\/[^/]+\/job\//,
  /\.bamboohr\.com\/(careers|jobs)\/(\d+|view\.php)/,
  /\.taleo\.net\/.*(jobdetail|jobapply|application\.jss|flow\.jsf|requisition)/i,
  /\.successfactors\.(com|eu)\/.*(career|job)/i,
  /\.sapsf\.(com|eu)\/(career|portalcareer)/,
  /\.recruitee\.com\/o\//,
  /\.breezy\.hr\/(p\/|[^?]*\/apply)/,
  /\.teamtailor\.com\/(.*\/)?jobs\/\d+/,
  /\.applytojob\.com\/apply\//,
  /\.eightfold\.ai\/careers(\/job\/|.*[?&]pid=)/,
  /^explore\.jobs\.netflix\.net\/careers\/job\//,
  /\.jobs\.personio\.(de|com)\/job\//,
  /\.pinpointhq\.com\/(.*\/)?postings\//,
  /\.avature\.net\/.*(jobdetail|application)/i,
  /\.csod\.com\/.*(requisition|job)/i,
  /\/tgnewui\/search\//i,
  /^jobs\.dayforcehcm\.com\/.*\/jobs\/\d+/,
  /^recruiting\.paylocity\.com\/recruiting\/jobs\/(details|apply)/i,
  /\.paycomonline\.net\/.*(jobs|careers)/i,
  /^(workforcenow|recruiting|myjobs)\.adp\.com\/.*(recruitment|srccar|cx)/,
  /\.ultipro\.(com|ca)\/.*\/jobboard\/.*opportunity(detail|apply)/i,
  /^jobs\.gem\.com\/[^/]+\/[0-9a-z-]+/,
  /^app\.dover\.com\/(apply|jobs)\//,
  /\.comeet\.(com|co)\/jobs\//,
  /\.freshteam\.com\/jobs\//,
  /\.zohorecruit\.(com|eu|in)\/.*(jobs|careers)/,
  /^jobs\.gusto\.com\/postings\//,
  /^app\.trinethire\.com\/companies\/.*\/jobs\//,
  /^careers\.jobscore\.com\/(careers\/|apply_flow\/)/,
  /\.governmentjobs\.com\/(careers\/[^/]+\/)?jobs\/\d+/,
  /\.tal\.net\/.*(opp|candidate)\//,
  // Any site with an embedded application: the systems' own query marks.
  /[?&](gh_jid|ashby_jid)=[\w-]+/,
  /[?&]leverappid=/i,
  // Job boards.
  // Signed in: /jobs/view/4476983365; signed out: /jobs/view/software-engineer-at-acme-4476983365.
  /(^|\.)linkedin\.com\/jobs\/view\/([a-z0-9%-]+-)?\d+/,
  /(^|\.)linkedin\.com\/jobs\/.*[?&]currentjobid=\d+/i,
  /(^|\.)indeed\.[a-z.]+\/(viewjob|m\/viewjob|m\/basecamp\/viewjob|rc\/clk)/,
  /(^|\.)indeed\.[a-z.]+\/.*[?&]vjk=/,
  /^(smartapply|apply)\.indeed\.com\//,
  /(^|\.)glassdoor\.[a-z.]+\/(job-listing|job\/.*[?&]jl=)/i,
  /(^|\.)wellfound\.com\/jobs\/\d+/,
  /(^|\.)ziprecruiter\.com\/(c\/[^/]+\/job|jobs\/|k\/)/,
  /(^|\.)dice\.com\/job-detail\//,
  /(^|\.)builtin[a-z]*\.com\/job\//,
  /(^|\.)usajobs\.gov\/job\/\d+/,
  /(^|\.)workatastartup\.com\/jobs\/\d+/,
  /(^|\.)ycombinator\.com\/companies\/[^/]+\/jobs\//,
  /(^|\.)joinhandshake\.com\/.*(jobs|postings)\/\d+/,
  /(^|\.)welcometothejungle\.com\/.*\/jobs\//,
  /(^|\.)otta\.com\/jobs\//,
  /(^|\.)seek\.(com|com\.au|co\.nz)\/job\/\d+/,
  /(^|\.)naukri\.com\/job-listings-/,
  /(^|\.)reed\.co\.uk\/jobs\//,
  /(^|\.)totaljobs\.com\/job\//,
  /(^|\.)monster\.[a-z.]+\/job-openings\//,
  /(^|\.)careerbuilder\.com\/job\//,
  /(^|\.)simplyhired\.[a-z.]+\/job\//,
  // Employers with their own systems.
  /(^|\.)amazon\.jobs\/[a-z-]+\/jobs\/\d+/,
  /^(www\.)?google\.com\/about\/careers\/applications\/(jobs\/results\/\d+|apply\/)/,
  /^careers\.google\.com\/jobs\/results\/\d+/,
  /^jobs\.apple\.com\/([a-z-]+\/details\/\d+|app\/[a-z-]+\/apply\/)/,
  /(^|\.)careers\.microsoft\.com\/.*\/job\/\d+/,
  /(^|\.)(metacareers|facebookcareers)\.com\/(jobs\/\d+|profile\/)/,
  /(^|\.)tesla\.com\/careers\/search\/job\//,
  /^careers\.ibm\.com\/(job\/|apply\/)/,
  /(^|\.)uber\.com\/careers\/(list\/\d+|apply)/,
  /^(www\.)?lifeattiktok\.com\/(position\/|resume\/)/,
];

// Mail, calendars, documents, chat, AI assistants, video and social feeds:
// a job email or a recruiter's message there can hold all the evidence a
// job page does, and an inbox full of "Thank you for applying" looks like a
// confirmation, but these are never the job's own page, and neither is a
// frame inside them.
const NOT_JOB_SITES: RegExp[] = [
  /^(web)?mail\./,
  /^(inbox|calendar|docs|drive|sheets|slides|meet|chat|keep|photos|contacts|gemini|news)\.google\.com$/,
  /^(outlook\.(live|office|office365)\.com|outlook\.cloud\.microsoft|teams\.(microsoft|live)\.com|.*\.sharepoint\.com|onedrive\.live\.com)$/,
  /^(app\.fastmail\.com|(www\.)?icloud\.com|(www\.)?hey\.com|app\.hey\.com)$/,
  /^(app\.slack\.com|[^.]+\.slack\.com|web\.whatsapp\.com|(www\.)?messenger\.com|web\.telegram\.org|app\.zoom\.us)$/,
  /^(chatgpt\.com|chat\.openai\.com|claude\.ai|(www\.)?perplexity\.ai|copilot\.microsoft\.com)$/,
  /^((www|m)\.youtube\.com|(www\.)?netflix\.com|(www\.)?twitch\.tv|open\.spotify\.com|(www\.)?(x|twitter|facebook|instagram|tiktok|reddit)\.com)$/,
  /^(app\.asana\.com|trello\.com|[^.]+\.atlassian\.net)$/,
];
// Apps on a host that also has its careers pages (discord.com/careers): only these paths.
const NOT_JOB_PATHS: RegExp[] = [/^discord\.com\/(channels|app)\b/, /^(www\.)?linkedin\.com\/(messaging|feed|mynetwork|notifications)\b/];

export const EMBEDDED_FORM = /greenhouse\.io\/embed\/job_app|jobs\.(eu\.)?lever\.co\/[^?#]+\/apply|ashbyhq\.com\/[^?#]+\/(application|embed)|apply\.workable\.com\/[^?#]+\/j\/|jobs\.smartrecruiters\.com\/oneclick-ui\/|ats\.rippling\.com\/[^?#]+\/jobs\/|jobs\.jobvite\.com\/[^?#]+\/job\/|\.(breezy\.hr|recruitee\.com|teamtailor\.com|pinpointhq\.com|bamboohr\.com)\/|app\.dover\.com\/apply\//i;

/** The address as the patterns read it: lowercased host, then path and query. */
function addressOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.pathname}${u.search}`;
  } catch {
    return '';
  }
}

/** Whether the page belongs to mail, chat, documents or the like: never a job's own page. */
export function isNotJobSite(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  return NOT_JOB_SITES.some((re) => re.test(host)) || NOT_JOB_PATHS.some((re) => re.test(host + u.pathname));
}

/** Whether the whole site is never a job site (not just some of its pages: LinkedIn's feed leads to its jobs without a load). */
export function isNotJobHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return NOT_JOB_SITES.some((re) => re.test(host));
  } catch {
    return false;
  }
}

/** Whether this document is a frame inside such a site (Gmail is full of small frames from other hosts). */
export function insideNotJobSite(doc: Document): boolean {
  const ancestors = doc.location.ancestorOrigins;
  return !!ancestors?.length && isNotJobSite(ancestors[ancestors.length - 1]!);
}

const JOB_SEARCH_LISTS: RegExp[] = [
  /(^|\.)linkedin\.com\/jobs\/(search|collections|recommended)/i,
  /(^|\.)indeed\.[a-z.]+\/(jobs|q-)/i,
  /(^|\.)glassdoor\.[a-z.]+\/job(s)?\//i,
];

/** Whether the address is a job-board search results list (LinkedIn, Indeed, Glassdoor). */
export function isJobSearchUrl(url: string): boolean {
  const address = addressOf(url);
  return !!address && JOB_SEARCH_LISTS.some((re) => re.test(address));
}

/** Whether the address is one job's page, or its application, on a system or board Wera knows. */
export function isJobUrl(url: string): boolean {
  const address = addressOf(url);
  return !!address && JOB_ADDRESSES.some((re) => re.test(address));
}

// Careers words as whole parts of the path or host ("/careers/sre", "jobs.acme.com"), not letters
// inside a tracking token, "/controller" or "/position-fixed-table".
const CAREER_PATH = /(^|[/_-])(careers?|jobs?|job-openings?|openings?|open-(roles|positions)|roles?|positions?|vacanc(y|ies)|opportunit(y|ies)|requisitions?|join-us|join-our-team|work-with-us|hiring)([/_.-]|$)/i;
const CAREER_HOST = /^(careers?|jobs?|hiring|recruiting|talent)[.-]/i;
// "/apply" alone is as likely a credit card or a college.
const APPLY_ADDRESS = /(^|[/_-])(apply|application)([/_.-]|$)/i;
// A careers site's other forms: they ask who you are, and are no application.
const NOT_APPLYING = /(^|[/_-])(alerts?|subscribe|newsletter|sign-?in|log-?in|contact)([/_.-]|$)/i;

/** Whether the address itself says careers: not proof of a job, but a job's page has one. */
export function careerAddress(url: string): boolean {
  try {
    const u = new URL(url);
    return !NOT_APPLYING.test(u.pathname) && (CAREER_HOST.test(u.hostname) || CAREER_PATH.test(u.pathname));
  } catch {
    return false;
  }
}

/** Whether the address is an application of some kind. */
export function applyAddress(url: string): boolean {
  try {
    const u = new URL(url);
    return !NOT_APPLYING.test(u.pathname) && (/^apply[.-]/i.test(u.hostname) || APPLY_ADDRESS.test(u.pathname));
  } catch {
    return false;
  }
}
