// Lightweight submission-confirmation helpers shared by the page detector
// (page.js, loaded on every page) and the full page watcher (engine.js,
// loaded only on job pages).

const SUBMITTED = [
  /thank(s| you) for (applying|your application|submitting)/i,
  /application (has been |was )?(successfully )?(submitted|received|sent)/i,
  /we('ve| have) received your application/i,
  /your application is (complete|in)/i,
  /successfully applied/i,
  /vielen dank f[uü]r ihre bewerbung|bewerbung (erfolgreich )?(gesendet|eingegangen|abgeschickt)/i,
  /merci pour votre candidature|votre candidature a (bien )?[eé]t[eé] (envoy[eé]e|re[cç]ue)/i,
  /gracias por (postularte|tu solicitud|tu candidatura)|tu solicitud ha sido enviada/i,
  /bedankt voor je sollicitatie|uw sollicitatie is ontvangen/i,
];

// Where ATSs send the browser once an application went through.
const SUBMITTED_PATH = /\/(thank[-_]?you|thanks|confirmation|application[-_]?(submitted|received|complete)|submitted|success)(\/|$|\?|#)/i;

/** Whether the address is a "thank you for applying" page. */
export function submittedAddress(url: string): boolean {
  try {
    const u = new URL(url);
    return SUBMITTED_PATH.test(u.pathname + (u.pathname.endsWith('/') ? '' : '/'));
  } catch {
    return false;
  }
}

/** Whether the document has room on screen: a frame that is not shown has a window of no size. */
export function shown(doc: Document): boolean {
  const view = doc.defaultView;
  return !!view && view.innerWidth > 0 && view.innerHeight > 0;
}

function textOutsideScripts(el: Element): string {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest('script, style, noscript, template') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let out = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out += `${n.nodeValue ?? ''} `;
  return out;
}

/**
 * The text a person can read on the page. A document that is not shown
 * (an ATS form in a hidden tab, Airbnb's) has none: there the browser's
 * innerText is every text, scripts included, and Greenhouse's page data
 * holds its own "Thank you for applying" message. Where innerText is
 * missing (jsdom), the text outside scripts and styles.
 */
export function bodyText(doc: Document): string {
  const body = doc.body;
  if (!body) return '';
  if (!shown(doc)) return '';
  return body.innerText || textOutsideScripts(body);
}

/** Whether the page text says the application went through. */
export function looksSubmitted(text: string): boolean {
  return SUBMITTED.some((re) => re.test(text.slice(0, 20000)));
}
