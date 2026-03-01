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

  // All loan forms (book, video, spoken, music) share the same native ILLiad
  // field names: LoanTitle, LoanAuthor, LoanDate, ISSN (holds ISBN), ESPNumber.
  // rft.* OpenURL parameters are NOT reliably mapped by this ILLiad installation.
  if (form === 'book' || form === 'video' || form === 'spoken' || form === 'music') {
    if (metadata.title)          params.set('LoanTitle', metadata.title);
    if (metadata.authors.length) params.set('LoanAuthor', metadata.authors.join('; '));
    if (metadata.year)           params.set('LoanDate', metadata.year);
    // ISSN is the ILLiad schema field name; the form labels it "ISBN (if known)"
    const isbn = metadata.isbns.find((i) => i.length === 13) ?? metadata.isbns[0];
    if (isbn)                    params.set('ISSN', isbn);
    // LoanEdition is a free-text input on the book form (unlike the video form
    // where it is a <select> that can't be pre-filled with arbitrary text)
    if (form === 'book' && metadata.edition) params.set('LoanEdition', metadata.edition);
  } else if (form === 'article') {
    // Copies form (Form=22) native ILLiad field names.
    // Two cases depending on record type:
    //   Article record: "In:" row present → source = journal title, title = article title.
    //   Serial record:  no "In:" row → title = journal title, article title unknown.
    if (metadata.source) {
      params.set('PhotoJournalTitle', metadata.source);
      if (metadata.title) params.set('PhotoArticleTitle', metadata.title);
    } else {
      if (metadata.title) params.set('PhotoJournalTitle', metadata.title);
    }
    if (metadata.authors[0])     params.set('PhotoArticleAuthor', metadata.authors[0]);
    if (metadata.year)           params.set('PhotoJournalYear', metadata.year);
    if (metadata.pages)          params.set('PhotoJournalInclusivePages', metadata.pages);
    if (metadata.issns[0])       params.set('ISSN', metadata.issns[0]);
  }

  // OCLC number — native ILLiad field (works for all form types)
  if (metadata.oclcNumber) {
    params.set('ESPNumber', metadata.oclcNumber);
    params.set('rft_id', `info:oclcnum/${metadata.oclcNumber}`);
  }

  const base = baseUrl.replace(/\/?$/, '');
  return `${base}?${params.toString()}`;
}
