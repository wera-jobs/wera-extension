// Injected into the page's MAIN world on job pages only (when Wera shows
// the panel), so Wera detects completed ATS submit requests in addition to
// thank-you pages.
import { installSubmitWatcher } from '../content/submitRequest';

if (typeof window !== 'undefined') installSubmitWatcher(window);
