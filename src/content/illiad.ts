import type { WorldCatMetadata } from './types';

// ---------------------------------------------------------------------------
// Form type mapping
//
// Derived from the institution's ILLiad request menu:
//
//   Form=21                              → Book loan
//   Form=20, Value=GenericRequestVideo   → Video recording
//   Form=20, Value=GenericRequestSpoken  → Spoken / audiobook recording
//   Form=20, Value=GenericRequestMusic   → Music recording
//   Form=22                              → Copies (article, photocopy)
//   Form=29                              → Other (map, manuscript, kit, etc.)
// ---------------------------------------------------------------------------

type ILLiadForm =
  | 'book'     // Form=21
  | 'video'    // Form=20 + Value=GenericRequestVideo
  | 'spoken'   // Form=20 + Value=GenericRequestSpoken
  | 'music'    // Form=20 + Value=GenericRequestMusic
  | 'article'  // Form=22
  | 'other';   // Form=29

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/**
 * Maps WorldCat format strings (as returned by scrapeFormat) to ILLiad form types.
 *
 * FirstSearch material-type labels come from the <span title="..."> icon in
 * the record summary, e.g. "Visual Material", "Sound Recording", "Book".
 */
function detectForm(metadata: WorldCatMetadata): ILLiadForm {
  const fmt = metadata.format.toLowerCase();

  // Articles and serials → copies request
  if (fmt.includes('article') || fmt.includes('journal') || fmt.includes('periodical')) {
    return 'article';
  }
  // ISSN present with no ISBN is a strong journal/serial signal
  if (metadata.issns.length > 0 && metadata.isbns.length === 0) {
    return 'article';
  }

  // Video recordings (DVD, VHS, Blu-ray, streaming video, etc.)
  if (
    fmt.includes('visual material') ||
    fmt.includes('videorecording') ||
    fmt.includes('video recording') ||
    fmt.includes('dvd') ||
    fmt.includes('blu-ray')
  ) {
    return 'video';
  }

  // Spoken word / audiobooks (check before generic "sound recording"
  // because spoken recordings are a subset of sound recordings)
  if (
    fmt.includes('spoken word') ||
    fmt.includes('non-musical recording') || // FirstSearch: "Non-musical recording (nsr)"
    fmt.includes('nonmusical sound') ||
    fmt.includes('audiobook') ||
    fmt.includes('talking book')
  ) {
    return 'spoken';
  }

  // Music recordings
  if (fmt.includes('sound recording') || fmt.includes('music')) {
    return 'music';
  }

  // Other non-book physical items
  if (
    fmt.includes('map') ||
    fmt.includes('manuscript') ||
    fmt.includes('archival') ||
    fmt.includes('kit') ||
    fmt.includes('object') ||
    fmt.includes('computer file') ||
    fmt.includes('software')
  ) {
    return 'other';
  }

  // Explicit book formats (or unknown / empty — books are by far the most
  // common WorldCat item type so this is a safe default)
  return 'book';
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Builds an ILLiad OpenURL (Z39.88 KEV format) request URL from WorldCat metadata.
 *
 * @param baseUrl  The institution's ILLiad dll URL, e.g.
 *                 https://yourlib.illiad.oclc.org/illiad/illiad.dll
 * @param metadata Scraped WorldCat metadata
 */
export function buildILLiadUrl(baseUrl: string, metadata: WorldCatMetadata): string {
  const form = detectForm(metadata);

  console.log(`[IlliadCopyCat] Detected form type: ${form} (format: "${metadata.format}")`);

  const params = new URLSearchParams();
  params.set('Action', '10');

  // Form code and optional Value parameter
  switch (form) {
    case 'book':
      params.set('Form', '21');
      params.set('rft.genre', 'book');
      break;
    case 'video':
      params.set('Form', '20');
      params.set('Value', 'GenericRequestVideo');
      break;
    case 'spoken':
      params.set('Form', '20');
      params.set('Value', 'GenericRequestSpoken');
      break;
    case 'music':
      params.set('Form', '20');
      params.set('Value', 'GenericRequestMusic');
      break;
    case 'article':
      params.set('Form', '22');
      params.set('rft.genre', 'article');
      break;
    case 'other':
      params.set('Form', '29');
      break;
  }

  if (form === 'video' || form === 'spoken' || form === 'music') {
    // GenericRequest* forms (Form=20) do not map OpenURL rft.* parameters to
    // their fields — ILLiad only does that mapping for the standard book/article
    // forms. Pass the native ILLiad field names that match the HTML form inputs.
    if (metadata.title)            params.set('LoanTitle', metadata.title);
    if (metadata.authors.length)   params.set('LoanAuthor', metadata.authors.join('; '));
    if (metadata.year)        params.set('LoanDate', metadata.year);
    // The field is named "ISSN" in the ILLiad schema but labelled "ISBN" on the form
    const isbn = metadata.isbns.find((i) => i.length === 13) ?? metadata.isbns[0];
    if (isbn)                 params.set('ISSN', isbn);
  } else {
    // Book (Form=21) and article (Form=22) support OpenURL Z39.88 rft.* parameters.
    if (metadata.title) {
      params.set('rft.title', metadata.title);
      if (form === 'book') params.set('rft.btitle', metadata.title);
    }
    if (metadata.authors[0])  params.set('rft.au', metadata.authors[0]);
    if (metadata.publisher)   params.set('rft.pub', metadata.publisher);
    if (metadata.year)        params.set('rft.date', metadata.year);
    if (form === 'book' && metadata.edition) params.set('rft.edition', metadata.edition);
    if (form === 'article') {
      if (metadata.issns[0]) params.set('rft.issn', metadata.issns[0]);
    } else if (form === 'book') {
      const isbn = metadata.isbns.find((i) => i.length === 13) ?? metadata.isbns[0];
      if (isbn) params.set('rft.isbn', isbn);
    }
  }

  // OCLC number — native ILLiad field (works for all form types)
  if (metadata.oclcNumber) {
    params.set('ESPNumber', metadata.oclcNumber);
    params.set('rft_id', `info:oclcnum/${metadata.oclcNumber}`);
  }

  const base = baseUrl.replace(/\/?$/, '');
  return `${base}?${params.toString()}`;
}
