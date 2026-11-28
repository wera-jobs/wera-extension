import { SELF_ID } from '../shared/selfId';
import type { FieldPurpose } from '../shared/types';
import { ENTRY_PURPOSES, entryPurpose } from './entries';
import type { Field } from './fields';
import { siteFor } from './sites';
import { pattern, remoteRules } from '../shared/remoteRules';

// Browser autocomplete tokens say exactly what a field is.
const AUTOCOMPLETE: Record<string, FieldPurpose> = {
  'given-name': 'first_name', 'family-name': 'last_name', name: 'full_name', nickname: 'preferred_name',
  email: 'email', tel: 'phone', 'tel-national': 'phone', 'street-address': 'address', 'address-line1': 'address',
  'additional-name': 'middle_name', 'address-line2': 'address_line2',
  'address-level2': 'city', 'address-level1': 'state', 'postal-code': 'postal_code', country: 'country',
  'country-name': 'country', organization: 'current_company', 'organization-title': 'current_title',
};

// Ordered: the first match wins, so specific patterns come before general
// ones. A rule is read against the sentence that asks (see asked), and says
// what asks for that one detail and nothing else: what a label merely
// mentions ("our Mexico City office", "the military") or asks with a
// condition ("years of urgent care experience") is for the AI, which knows
// the whole of the user's background.
const RULES: [FieldPurpose, RegExp][] = [
  ['cover_letter', /cover\s*letter|anschreiben|motivationsschreiben|lettre de motivation|carta de presentacion|motivatiebrief|sollicitatiebrief/],
  ['resume', /\b(resume|résumé|cv|curriculum|lebenslauf|hoja de vida|curriculo)\b/],
  ['preferred_name', /preferred (first )?name|nick ?name|goes by|name (you('|’)?d|you would) prefer|prefer(red)? to be called|what should we call you|what would you like (us )?to call you|rufname|roepnaam|nom d.?usage/],
  ['middle_name', /middle[\s_-]*(name|initial)|tussenvoegsel|segundo nombre/],
  ['first_name', /first[\s_-]*name|given[\s_-]*name|forename|\bfname\b|\bvorname\b|\bprenom\b|\bvoornaam\b|primer nombre/],
  ['last_name', /last[\s_-]*name|surname|family[\s_-]*name|\blname\b|\bnachname\b|\bfamilienname\b|nom de famille|\bapellidos?\b|\bachternaam\b/],
  ['full_name', /^(please (state|enter|provide|list) )?(your )?(full |legal |your )*name\b|full[\s_-]*name|legal[\s_-]*name|vollstandiger name|vor-? und nachname|nom complet|nombre completo|nombre y apellidos|volledige naam|^(vor-? und )?name$|^nom$|^nombre$/],
  ['email', /e-?mail|courriel|correo electronico/],
  // "Have you worked at or consulted for GitLab?": the resume says (only when it names this company, see plan.ts).
  ['previously_employed', /(have|did) you (ever )?(previously |formerly |already )?(been )?(work(ed)?|employed|been employed|consulted|interned)\b.{0,40}\b(at|for|by|with)\b|(current|former|previous|past) (employee|employment)|previously (been )?(worked|employed)|ever been employed by|worked (here|for us) before/],
  ['phone_type', /(phone )?device type|phone type|type of phone/],
  ['phone_code', /(country )?(phone|dialing|calling) code|country code|phone (number )?(country|prefix)|landesvorwahl|indicatif|prefijo|landnummer/],
  ['phone', /phone|mobile|cell\b|telephone|telefon|handynummer|mobilnummer|numero de telephone|portable|celular|movil|telefoonnummer|mobiel/],
  // Before the links: "How did you hear about us? LinkedIn, a friend..." is no LinkedIn profile.
  ['how_heard', /how (did )?you (first |initially )?(hear|heard|find|found|learn|learned|come across)|where (did )?you (first )?(hear|heard|find|found|learn)|referral source|^source\b|how were you referred|hear about (us|this)|wie haben sie von (uns|dieser stelle) erfahren|wie sind sie auf uns aufmerksam|comment avez-vous (connu|entendu parler)|como (nos conociste|te enteraste)|hoe heb je (ons|deze vacature) gevonden|waar heb je deze vacature gezien/],
  // Who referred the user: only they know.
  ['referral', /referred (you|by)|refer you\b|who referred|referr(al|er)('s)? (name|email)|name of (the )?(person|employee|individual) who referred|employee referral|were you referred/],
  ['linkedin', /linked\s*in/],
  ['github', /git\s*hub/],
  ['twitter', /twitter|\bx\.com\b|\bx \(twitter\)|^x( profile| handle| url)?$/],
  ['portfolio', /portfolio|personal (web)?site|website|personal url|other (link|url|website)|^url\b|webseite|site web|sitio web/],
  ['needs_sponsorship', /sponsor|parrainage|patrocinio/],
  // "Will you require a work permit?", "Will you need us to support your immigration case?"; holding one is being authorized.
  ['authorized_to_work', /\b(hold|have|possess)\b.{0,12}\b(valid )?(work|working) permit/],
  ['needs_sponsorship', /\b(require|need)s?\b.{0,30}\b(work permit|working permit|immigration (case|support|assistance|sponsorship)|visa support)|support (for )?your immigration|visumsunterstutzung|besoin d.?un visa|requiere patrocinio/],
  ['visa_status', /visa (status|type)|immigration status|current (work )?visa|type of (work )?visa/],
  ['needs_sponsorship', /visa|h-?1b|visum/],
  ['authorized_to_work', /(authori[sz]ed|eligible|legally (able|permitted)) to work|work authori[sz]ation|right to work|arbeitserlaubnis|autorisation de travail|permis de travail|autorizacion de trabajo|permiso de trabajo|werkvergunning|recht om te werken/],
  // Only the plain question: "live within commuting distance?" or "plans to relocate this year?" ask more.
  ['willing_to_relocate', /^(are|would|will|can) you (be )?(willing|open|able|prepared)( and able)? to relocate\b|^(i am |i'm )?(willing|open) to relocate\b|^(open to )?relocation\??$|umzugsbereit|pret a demenager|dispuesto a reubicarse|bereid te verhuizen/],
  // "Are you a Singapore citizen?" (not "citizen or permanent resident": that is about authorization).
  ['citizen_of', /^(?!.*(permanent resident|green card|or resident)).*(are you an? .{0,30}\bcitizen\b|\bcitizen of (the )?[a-z .]+\?)/],
  // "Are you currently located in the US?": the details' country says.
  ['in_country', /^(are you|do you) (currently |presently |now )?(located|based|living|live|reside|residing|working) (in|within)\b/],
  ['over_18', /\b(18|eighteen)\b.{0,20}(years|older|age)|at least 18|legal (working )?age|over (the age of )?18/],
  ['willing_to_travel', /^(?!.*percent).*((willing|able|open) to travel|travel (requirement|up to|is required)|\d+ ?% (of the time )?travel)/],
  ['security_clearance', /clearance/],
  ['citizenship', /^(your |what is your |what are your |country of )?(citizenship|nationality)\b|^(what|which) (citizenships?|nationalit(y|ies)|country)\b.*\b(citizen|hold|national)|country of (citizen|nationality)|^passport country\b|staatsangehorigkeit|staatsburgerschaft|nationalite|nacionalidad|nationaliteit/],
  ['work_preference', /work (arrangement|preference|setting|model|style)|(remote|hybrid|on-?site) (or|preference)|prefer to work remotely|preferred work (mode|type|arrangement)/],
  ['notice_period', /notice period|weeks.? notice|how much notice|kundigungsfrist|delai de preavis|\bpreavis\b|periodo de preaviso|\bpreaviso\b|opzegtermijn/],
  // What the applicant wants: "our compensation is standardized..." is a notice.
  ['salary_expectation', /^(desired |expected |target |your )?(salary|compensation|pay)( expectations?| range| requirements?)?$|(salary|compensation|pay) (expectation|requirement|range you)|(desired|expected|target|minimum) (annual |base |total )?(salary|compensation|pay)|gehaltsvorstellung|gehaltswunsch|jahresgehalt|pretentions salariales|salaire souhaite|expectativa salarial|salario deseado|pretension salarial|salarisindicatie|salarisverwachting/],
  ['today', /today'?s date|date (signed|of signature)|signature date|^date$/],
  ['start_date', /^(?!.*\b(school|college|university|degree|program|current (job|role|position|employer|company))\b).*(start date|available to (start|begin)|availab(le|ility) (for|to) (full|part|work)|earliest (possible |available )?(start|availability)|earliest .{0,30}\b(start|begin)\b|soonest available|when can you start|date available|availability date|when (are|would) you (be )?available|eintrittstermin|startdatum|verfugbarkeit|date de disponibilite|date de debut|fecha de inicio|disponibilidad|beschikbaarheid|beschikbaar per)/],
  ['lgbtq', /lgbt|queer community/],
  ['skills', /^(technical |key |relevant |your )?skills\b|^skill set|list (your )?skills|\bkenntnisse\b|competences|habilidades|vaardigheden/],
  ['languages', /language skill|^languages?\b|^(?!.*programming).*(languages? (do you )?(speak|spoken|fluent)|which languages|language proficiency|fluent in|languages you speak|(preferred|select|choose|application|communication|your|consent) language\b)|sprachkenntnisse|\bsprachen?\b|\blangues?\b|\bidiomas?\b|\btalen\b|taalkennis/],
  ['pronouns', /pronoun/],
  ['transgender', /transgender|identify as trans\b|gender identity (is )?(the same|different)/],
  ['sexual_orientation', /sexual orientation/],
  ['hispanic', /hispanic|latin[oaxe]/],
  ['race', /\brace\b|ethnic/],
  ['gender', /gender|\bsex\b|geschlecht|\bgenre\b|\bsexe\b|\bgenero\b|geslacht/],
  ['veteran', /veteran|served in the (u\.?s\.? )?(military|armed forces)|military (service|status)|active duty/],
  ['disability', /disabilit/],
  // High school is not the degree the details hold.
  ['graduation_year', /^(?!.*\b(high school|secondary)\b).*\bgraduat|abschlussjahr|annee d.?obtention|ano de graduacion|afstudeerjaar/],
  ['gpa', /\bgpa\b|grade point|notendurchschnitt/],
  ['major', /^(?!.*\bminor\b).*(\bmajor\b|field of study|discipline|concentration|area of study|studienfach|fachrichtung|domaine d.?etudes|campo de estudio|studierichting)/],
  ['degree', /^(?!.*\b(pursuing|working toward)\b).*(\bdegree\b|level of education|highest education|studienabschluss|\babschluss\b|\bdiplome\b|niveau d.?etudes|nivel de estudios|opleidingsniveau|\bdiploma\b)/],
  // The school itself, not something at it ("the grading scale used by your current school").
  ['school', /^(?!.*\b(minor|grading|start date|high school|year|district|type|level)\b).*(^(your |name of (your )?|current |most recent )?(school|university|college|institution)\b|(which|what|select a) (school|university|college|institution)|(school|university|college) (name|attended)|name of (your )?(school|university|college)|hochschule|universitat|universite|universidad|universiteit|hogeschool|opleidingsinstelling)/],
  ['years_experience', /^(how many )?(total )?years of (professional |relevant |work |working |industry |full[- ]time |total )?experience( do you have)?( in total)?\??$|jahre berufserfahrung|berufserfahrung \(jahre\)|annees d.?experience|anos de experiencia|jaren (werk)?ervaring/],
  ['current_title', /current (job )?(title|role|position)|job title|^title\b|aktuelle position|berufsbezeichnung|poste actuel|intitule du poste|cargo actual|puesto actual|huidige functie|functietitel/],
  ['current_company', /current (\(?or (most recent|latest)\)? )?(company|employer)|(most recent|latest) (company|employer)|^company( name)?\b|^employer\b|aktueller arbeitgeber|unternehmen|entreprise actuelle|employeur|empresa actual|empleador|huidige werkgever|\bbedrijf\b/],
  ['postal_code', /zip|postal|postleitzahl|\bplz\b|code postal|codigo postal|postcode/],
  ['address_line2', /address (line )?2|\bapt\b|apartment|^suite\b/],
  // "City, State" asks for a place; its parts may sit inside an address label: "Current Address (Country)".
  ['location', /\bcity\b.{0,14}\b(state|province|country)\b|^(what|which) (city|town)\b|^where do you (currently )?(live|reside)\b/],
  ['country', /\(country\)/],
  ['state', /\((state|province)\b/],
  ['address', /street|address|strasse|adresse|direccion|calle|\badres\b|straat/],
  ['city', /\bcity\b|\btown\b|\bstadt\b|\bwohnort\b|\bville\b|\bciudad\b|woonplaats|\bplaats\b/],
  // "State", not the verb ("Please state why...").
  ['state', /\bstate\b(?! (your|why|how|what|the|any|briefly|that|whether))|province|region|bundesland|departement|provincia|provincie/],
  // The country they live in, not one of birth or of a passport (those are not in the details).
  ['country', /^(?!.*\b(birth|born|passport|authori[sz]\w*|citizen\w*|national\w*)\b).*(\bcountry\b|\bland\b|\bpays\b|\bpais\b)/],
  // Where they are, not which of the employer's places they apply to.
  ['location', /^(?!.*\b(applying|apply|office|interested in|prefer)\b).*(location|where are you (currently )?(located|based)|where do you (currently )?(live|reside)|where (do|will|would) you (plan|intend|expect) (on |to )?(work|be working)|(plan|intend) (on |to )?work(ing)? from|from where (do|will) you (intend to )?work|\bstandort\b|localisation|ubicacion|\blocatie\b)/],
];

// Details a yes/no question can ask; other details named in one ("...with your current employer?") are not what it asks.
const YES_NO_PURPOSES = new Set<FieldPurpose>(['authorized_to_work', 'needs_sponsorship', 'authorized_no_sponsorship', 'willing_to_relocate', 'willing_to_travel',
  'over_18', 'security_clearance', 'visa_status', 'hispanic', 'transgender', 'veteran', 'disability', 'gender', 'race', 'work_preference', 'consent',
  'previously_employed', 'in_country', 'citizen_of', 'lgbtq', 'referral']);

export { SELF_ID };

/** Kinds whose answer is one of their options. */
const CHOICE_KINDS = new Set(['select', 'radio', 'buttons', 'listbox']);

const CONSENT = /\b(i agree|agree|consent|acknowledge|certify|privacy|terms|confirm that|i understand|process(ing)? (of )?(my|your) personal (data|information)|personal (data|information) (processing|policy)|datenschutz\w*|einverstandnis\w*|ich stimme|politique de confidentialite|j.?accepte|consentement|politica de privacidad|acepto|consentimiento|privacyverklaring|ik ga akkoord|toestemming)\b/;
// A statement to accept, whatever the widget ("I have read and understand...", "By selecting I agree..."): the user's to give.
const ACCEPTS = /^(i (hereby )?(have read|understand|acknowledge|confirm|certify|agree|consent|attest|authorize|accept)\b|i understand$|by (checking|selecting|clicking|ticking|submitting|providing|signing)\b|please (read and )?(acknowledge|confirm|certify)\b|do you (consent|agree|acknowledge|authorize)\b)/;

// Contact details asked inside a job or school block are that job's or school's, not the applicant's.
const CONTACT = new Set<FieldPurpose>(['city', 'state', 'country', 'location', 'postal_code', 'address', 'address_line2', 'phone', 'email']);
// What a site rule may name that is about the applicant, never about a block they list.
const ABOUT_APPLICANT = new Set<FieldPurpose>([...CONTACT, 'first_name', 'last_name', 'full_name', 'start_date', 'cover_letter', 'resume', 'linkedin', 'salary_expectation']);

/** What a field asks for, or null when Wera cannot tell. */
export function classify(f: Field): FieldPurpose | null {
  // The site's own name for the field says it best (Workday's "legalNameSection_firstName").
  const site = siteFor(f.el.ownerDocument);
  const named = site?.purpose?.(f);
  // A site's name for a personal detail ("phone", "startdate", "summary") inside a job, school or
  // reference block is that block's: the supervisor's phone, the job's start, the role's summary.
  const blockOwn = !site?.blockAware && f.section && named && ABOUT_APPLICANT.has(named) && !ENTRY_PURPOSES.has(named);
  // Another document named like the resume ("document", "attachment"): a transcript is no resume.
  const otherFile = named === 'resume' && /transcript|portfolio|cover|certificat|reference|zeugnis|anschreiben|writing sample/i.test(`${f.label} ${f.hints}`);
  if (named !== undefined && !blockOwn && !otherFile) return named;
  if (otherFile && !f.section) return generic(f);
  if (f.section) {
    const e = f.section === 'reference' ? null : entryPurpose(f, f.section);
    if (e) return e;
    const p = generic(f);
    // A reference's name and email, a supervisor's phone: never the applicant's own.
    return p && ABOUT_APPLICANT.has(p) ? null : p;
  }
  return generic(f);
}

const YES_NO_WORD = /^(are|do|does|did|have|has|had|will|would|is|can|could|were|was|should|may)\b/;
const YES_NO_CHOICE = /^(yes|no|ja|nein|oui|non|si|nee|n\/a|maybe|not sure|prefer not|decline)\b/i;

// Dots that end no sentence: "(e.g. H-1B)", "in the U.S. today".
const ABBREVIATED = /\b(?:e\.g|i\.e|etc|vs|u\.s\.a|u\.s|u\.k)\./gi;

/** The sentence of a label that asks: its question when it has one ("Based in Austin. Are you nearby?"), else all of it. */
function asked(label: string): string {
  const question = label.replace(ABBREVIATED, (m) => m.replace(/\./g, '')).match(/[^.?!:]*\?/g)?.map((q) => q.trim()).find((q) => q.split(/\s+/).length >= 2);
  return question ?? label;
}

/** Whether the field's own choices are yes and no: then it asks a yes/no question, whatever its label mentions. */
function yesNoChoices(f: Field): boolean {
  const real = f.options.map((o) => o.label).filter((l) => l && !/^(select|choose|please|--)/i.test(l));
  return real.length >= 2 && real.length <= 4 && real.every((l) => YES_NO_CHOICE.test(l));
}

// Details that are one fact, typed or picked: a long statement mentions them, it does not ask for them.
const LONG_ASK = 90;
// Short answers a form may give a big box: the box's size does not make them essays.
const SHORT_ANSWERS = new Set<FieldPurpose>(['start_date', 'salary_expectation', 'notice_period', 'major', 'how_heard', 'referral']);
const SELF_ID_LONG = new Set<FieldPurpose>(['hispanic', 'race', 'gender', 'veteran', 'disability', 'transgender', 'sexual_orientation', 'lgbtq', 'needs_sponsorship', 'authorized_to_work', 'authorized_no_sponsorship', 'over_18', 'consent', 'previously_employed', 'cover_letter', 'resume', 'work_preference', 'willing_to_travel']);

function generic(f: Field): FieldPurpose | null {
  // Aliases from the remote rules (#143): a label the built-in rules misread, fixed without a release.
  for (const [src, p] of remoteRules()?.aliases ?? []) {
    if (pattern(src)?.test(f.label)) return p;
  }
  if (f.autocomplete) {
    for (const tok of f.autocomplete.split(/\s+/)) {
      const p = AUTOCOMPLETE[tok];
      if (p) return p;
    }
  }
  // Accents dropped (and German ß folded to ss), so "Résumé" reads as "resume" and "Straße" as "strasse".
  const label = f.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').toLowerCase();
  // A follow-up to another answer ("If yes, please mention your Acme email address") asks
  // something only the user knows, not the detail it names.
  if (/^\(?if (yes|no|so|applicable|you answered|you selected|other)\b/.test(label)) return f.kind === 'textarea' ? 'question' : null;
  // A site's search box asks for words to look up, never a detail ("Search the FSA Website").
  if (f.inputType === 'search' || f.el.getAttribute('role') === 'searchbox' || /^search\b.*\b(site|website|jobs|help|faq|articles)\b|^search$/.test(label)) return null;
  if (f.inputType === 'email') return 'email';
  if (f.inputType === 'tel') return 'phone';
  if (f.kind === 'checkbox' && CONSENT.test(label)) return 'consent';
  if (f.kind !== 'text' && f.kind !== 'textarea' && f.kind !== 'file' && ACCEPTS.test(label)) return 'consent';
  // A choice between consenting or not (SMS updates, an AI notetaker): the user's to make.
  if (CHOICE_KINDS.has(f.kind) && f.options.some((o) => /\b(i )?(do not |don.?t )?(consent|agree)\b/i.test(o.label))) return 'consent';
  // An upload that only reads a resume to fill the form (Ashby's "Autofill from resume", Breezy's "Fill in with Resume")
  // would redo Wera's work; a form's one resume field may say it is read too (Rippling's).
  if (f.kind === 'file' && (/pars(e|er)|auto-?fill/.test(f.hints) || (/auto-?fill|fill in (with|the data)|pars(e|ed|es)\b|import (from|your)/.test(label) && !/^(your )?(resume|cv|curriculum)\b/.test(label)))) return null;
  // Other names they have gone by: the details hold only the legal one.
  if (/\(other\)|other names?\b|previous (last )?name|former name|maiden/.test(label)) return null;
  // "Authorized to work without sponsorship?" asks both things at once.
  if (/without (the )?(need (for|of) |requiring )?(any )?(employer |visa )?sponsor/.test(label)) return 'authorized_no_sponsorship';
  // Pronouncing a name, or a yes/no question that mentions a detail ("...with your current employer?"), asks something else.
  if (/pronounc/.test(label)) return f.kind === 'textarea' || label.length > 40 ? 'question' : null;
  // Asked only when it differs ("Legal name (if different)"): the user knows.
  if (/if (it is |it's )?different|if applicable.*name/.test(label)) return null;
  // A choice list of races is the race question, whatever its heading says first ("Race: Hispanic or Latino - ...").
  if (f.options.length >= 3 && (f.options.map((o) => o.label.toLowerCase()).join('|').match(/\bwhite\b|\bblack\b|\basian\b|hawaiian|two or more/g) ?? []).length >= 2) return 'race';
  // An open box that asks a question about a detail ("How are you using AI in your current role?") wants an answer, not the detail.
  const ask = asked(label);
  const essay = f.kind === 'textarea' && (label.includes('?') || label.length > 60);
  const yesNo = YES_NO_WORD.test(ask) || yesNoChoices(f);
  for (const text of [ask, f.hints.replace(/[_\-.]+/g, ' ')]) {
    if (!text) continue;
    for (const [purpose, re] of RULES) {
      if (!re.test(text)) continue;
      if (purpose === 'resume' && f.kind !== 'file' && !/upload|attach|link|url/.test(text)) continue;
      if (yesNo && !YES_NO_PURPOSES.has(purpose)) break;
      // A lone tick box is a yes/no ("How did you hear: [x] LinkedIn" is not the LinkedIn URL).
      if (f.kind === 'checkbox' && !YES_NO_PURPOSES.has(purpose) && purpose !== 'consent') break;
      if (essay && purpose !== 'cover_letter' && !SHORT_ANSWERS.has(purpose)) break;
      if (text.length > LONG_ASK && !SELF_ID_LONG.has(purpose)) break;
      return purpose;
    }
  }
  // An unrecognized long question or free-text box is for the person (AI can draft it).
  if (f.kind === 'textarea' || (f.kind === 'text' && (label.includes('?') || label.length > 60))) return 'question';
  return null;
}
