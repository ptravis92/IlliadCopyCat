import type { WorldCatMetadata } from './types';

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

type ILLiadForm = 'loan' | 'article';

/**
 * Guesses whether the item is a book loan or an article/photocopy request.
 *
 * Heuristic priority:
 *  1. WorldCat format field (most explicit)
 *  2. Presence of ISSN-only vs ISBN — journals have ISSNs, books have ISBNs
 *  3. Default to loan (most common WorldCat use-case)
 */
function detectForm(metadata: WorldCatMetadata): ILLiadForm {
  const fmt = metadata.format.toLowerCase();
  if (fmt.includes('article') || fmt.includes('journal') || fmt.includes('periodical')) {
    return 'article';
  }
  if (metadata.issns.length > 0 && metadata.isbns.length === 0) {
    return 'article';
  }
  return 'loan';
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Builds an ILLiad OpenURL (Z39.88 KEV format) request URL from WorldCat metadata.
 *
 * ILLiad interprets these standard parameters:
 *   Action=10  → submit a new ILL request
 *   Form=30    → book loan
 *   Form=20    → article / photocopy
 *
 * @param baseUrl  The institution's ILLiad dll URL, e.g.
 *                 https://yourlib.illiad.oclc.org/illiad/illiad.dll
 * @param metadata Scraped WorldCat metadata
 */
export function buildILLiadUrl(baseUrl: string, metadata: WorldCatMetadata): string {
  const form = detectForm(metadata);
  const params = new URLSearchParams();

  // ILLiad action and form codes
  params.set('Action', '10');
  params.set('Form', form === 'loan' ? '30' : '20');

  // OpenURL genre
  params.set('rft.genre', form === 'loan' ? 'book' : 'article');

  // Title — rft.btitle is the preferred key for monographs; rft.title as fallback
  if (metadata.title) {
    params.set('rft.title', metadata.title);
    if (form === 'loan') params.set('rft.btitle', metadata.title);
  }

  // First author only — ILLiad's rft.au field
  if (metadata.authors.length > 0) {
    params.set('rft.au', metadata.authors[0]);
  }

  if (metadata.publisher) params.set('rft.pub', metadata.publisher);
  if (metadata.year)      params.set('rft.date', metadata.year);
  if (metadata.edition)   params.set('rft.edition', metadata.edition);

  // Identifiers
  if (form === 'loan') {
    // Prefer ISBN-13 over ISBN-10 when both are present
    const isbn = metadata.isbns.find((i) => i.length === 13) ?? metadata.isbns[0];
    if (isbn) params.set('rft.isbn', isbn);
  } else {
    if (metadata.issns[0]) params.set('rft.issn', metadata.issns[0]);
  }

  // OCLC number — ILLiad-specific ESPNumber field + standard OpenURL rft_id
  if (metadata.oclcNumber) {
    params.set('ESPNumber', metadata.oclcNumber);
    params.set('rft_id', `info:oclcnum/${metadata.oclcNumber}`);
  }

  const base = baseUrl.replace(/\/?$/, '');
  return `${base}?${params.toString()}`;
}
