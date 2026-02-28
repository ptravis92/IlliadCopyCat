import type { WorldCatMetadata } from './types';

// ---------------------------------------------------------------------------
// Interface detection
// ---------------------------------------------------------------------------

/**
 * Returns true when running inside the legacy OCLC FirstSearch interface.
 * FirstSearch pages are server-rendered HTML; the new search.worldcat.org is
 * a React SPA. The two require different selector strategies throughout.
 */
function isFirstSearch(): boolean {
  return document.title.includes('FirstSearch');
}

// ---------------------------------------------------------------------------
// OCLC number extraction
// ---------------------------------------------------------------------------

/** New WorldCat SPA: OCLC number appears directly in the URL path. */
function oclcFromUrlPath(url = location.href): string | null {
  const match = url.match(/\/oclc\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * FirstSearch: OCLC number is not in the page URL.
 * It appears in the "Cite This Item" anchor:
 *   <a href="http://worldcat.org/oclc/123960495?page=citation">Cite This Item</a>
 */
function oclcFromCiteLink(): string | null {
  const link = document.querySelector<HTMLAnchorElement>('a[href*="worldcat.org/oclc/"]');
  if (!link) return null;
  const match = link.href.match(/\/oclc\/(\d+)/);
  return match ? match[1] : null;
}

/** Exported for use in index.ts isItemPage check. */
export function getOclcFromUrl(url = location.href): string | null {
  return oclcFromUrlPath(url);
}

/**
 * Returns true if the current page is a WorldCat item detail page in either
 * the new SPA or the legacy FirstSearch interface.
 */
export function isItemPage(): boolean {
  if (oclcFromUrlPath() !== null) return true;
  if (isFirstSearch() && document.title.includes('Detailed Record')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// DOM utilities
// ---------------------------------------------------------------------------

/**
 * Waits for a CSS selector to match an element.
 * Used only for the new SPA (React needs time to hydrate).
 * FirstSearch is server-rendered, so no waiting is needed.
 */
export function waitForElement(
  selector: string,
  timeoutMs = 10_000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const immediate = document.querySelector(selector);
    if (immediate) {
      resolve(immediate);
      return;
    }

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

/** Returns trimmed text content of the first matching element, or ''. */
function getText(selector: string, root: Document | Element = document): string {
  return root.querySelector(selector)?.textContent?.trim() ?? '';
}

/** Returns trimmed text of all matching elements, filtering empty strings. */
function getAllText(selector: string, root: Document | Element = document): string[] {
  return Array.from(root.querySelectorAll(selector))
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// XPath label-based lookup
//
// FirstSearch uses a two-column table layout: left <td> holds the label,
// right <td> holds the value. The labels end with a colon, e.g. "Author(s):".
//
// XPath strategy: find any element whose normalised text equals the full
// label string, then take its first following sibling element (the value td).
//
// This also serves as a fallback for the new SPA if data-testid attrs change.
// ---------------------------------------------------------------------------

/**
 * Returns the value element immediately following the label element, or null.
 * Label must match exactly including any trailing colon, e.g. 'Author(s):'.
 */
function getFieldElementByLabel(label: string): Element | null {
  const xpath = `//*[normalize-space(.)="${label}"]/following-sibling::*[1]`;
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  } catch {
    return null;
  }
}

/** Returns the trimmed text of the value element following a label. */
function getFieldByLabel(label: string): string {
  return getFieldElementByLabel(label)?.textContent?.trim() ?? '';
}

/** Returns all sibling element texts after a label (for multi-value fields). */
function getAllFieldsByLabel(label: string): string[] {
  const xpath = `//*[normalize-space(.)="${label}"]/following-sibling::*`;
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.ORDERED_NODE_ITERATOR_TYPE,
      null
    );
    const values: string[] = [];
    let node = result.iterateNext();
    while (node) {
      const text = (node as Element).textContent?.trim();
      if (text) values.push(text);
      node = result.iterateNext();
    }
    return values;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Regex-based extraction (layout-agnostic)
// ---------------------------------------------------------------------------

const ISBN_13_RE = /\b97[89]\d{10}\b/g;
const ISBN_10_RE = /\b\d{9}[\dX]\b/g;
const ISSN_RE = /\b\d{4}-\d{3}[\dX]\b/g;

function extractIsbns(text: string): string[] {
  const isbn13s = text.match(ISBN_13_RE) ?? [];
  const isbn10s = text.match(ISBN_10_RE) ?? [];
  return [...new Set([...isbn13s, ...isbn10s])];
}

function extractIssns(text: string): string[] {
  return [...new Set(text.match(ISSN_RE) ?? [])];
}

// ---------------------------------------------------------------------------
// Field-specific scrapers
//
// Each function tries the interface-specific approach first, then falls back
// to the other interface's approach as a safety net.
//
// FirstSearch label strings confirmed from ExampleWorldCatPage.html:
//   Title:, Author(s):, Corp Author(s):, Publication:, Year:,
//   Language:, Standard No:, Edition: (when present)
// ---------------------------------------------------------------------------

function scrapeTitle(): string {
  if (isFirstSearch()) {
    // FirstSearch: title is in the "Title:" labeled row
    return getFieldByLabel('Title:');
  }
  // New SPA: title is in <h1>
  // NOTE: verify against live DOM; update if WorldCat restructures the page
  return getText('h1');
}

function scrapeAuthors(): string[] {
  if (isFirstSearch()) {
    // Author names are <a> links in the "Author(s):" value cell.
    // Trailing period is a MARC artifact — strip it.
    const cell = getFieldElementByLabel('Author(s):');
    if (cell) {
      const authors = Array.from(cell.querySelectorAll('a'))
        .map((a) => a.textContent?.trim().replace(/\.$/, '') ?? '')
        .filter(Boolean);
      if (authors.length > 0) return authors;
    }
    return [];
  }

  // New SPA: try data-testid and href-based selectors
  // NOTE: verify selector strings against live DOM
  for (const sel of [
    '[data-testid="author-link"]',
    'a[href*="creator="]',
    'a[href*="au="]',
  ]) {
    const found = getAllText(sel);
    if (found.length > 0) return found;
  }

  // XPath fallback for SPA
  const byLabel = getAllFieldsByLabel('Author').concat(getAllFieldsByLabel('Authors'));
  return byLabel.length > 0 ? byLabel : [];
}

function scrapePublisher(): string {
  if (isFirstSearch()) {
    // "Publication:" row contains "Place : Publisher, Year"
    return getFieldByLabel('Publication:');
  }
  return (
    getText('[data-testid="publisher"]') ||
    getFieldByLabel('Publisher') ||
    getFieldByLabel('Published')
  );
}

function scrapeYear(): string {
  let raw: string;

  if (isFirstSearch()) {
    raw = getFieldByLabel('Year:');
  } else {
    raw =
      getText('[data-testid="publication-date"]') ||
      getFieldByLabel('Date') ||
      getFieldByLabel('Year') ||
      getFieldByLabel('Publication date');
  }

  // Extract the first 4-digit year from potentially longer strings
  const match = raw.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return match ? match[1] : raw;
}

function scrapeEdition(): string {
  if (isFirstSearch()) {
    return getFieldByLabel('Edition:');
  }
  return getText('[data-testid="edition"]') || getFieldByLabel('Edition');
}

function scrapeFormat(): string {
  if (isFirstSearch()) {
    // FirstSearch shows the broad document type as the title attribute on the
    // format icon span: <span title="Sound Recording"><img ...></span>
    // "Sound Recording" is too broad — it covers both music AND non-musical
    // (spoken) recordings. The "Material Type:" labeled row contains the
    // specific MARC type, e.g. "Non-musical recording (nsr)", which we append
    // so that detectForm() can distinguish spoken from music recordings.
    const iconType = document.querySelector<HTMLElement>('span[title]')?.getAttribute('title') ?? '';
    const materialType = getFieldByLabel('Material Type:');
    return [iconType, materialType].filter(Boolean).join('; ');
  }
  return (
    getText('[data-testid="format"]') ||
    getText('[aria-label*="Format"]') ||
    getFieldByLabel('Format')
  );
}

function scrapeLanguage(): string {
  if (isFirstSearch()) {
    // "Language:" row may contain extra info after a semicolon, e.g.
    // "English; Closed-captioned." — return only the language portion.
    const raw = getFieldByLabel('Language:');
    return raw.split(';')[0].trim();
  }
  return getText('[data-testid="language"]') || getFieldByLabel('Language');
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Scrapes all available bibliographic metadata from a WorldCat item detail
 * page. Supports both the legacy FirstSearch interface and the new
 * search.worldcat.org SPA.
 */
export async function scrapeWorldCatItem(): Promise<WorldCatMetadata | null> {
  if (!isItemPage()) return null;

  if (isFirstSearch()) {
    // Server-rendered — DOM is already complete, no waiting needed.
    const oclcNumber = oclcFromCiteLink();
    if (!oclcNumber) {
      console.warn('[IlliadCopyCat] Could not find OCLC number on FirstSearch page');
      return null;
    }
    return buildMetadata(oclcNumber);
  }

  // New SPA: wait for React to hydrate the title before scraping
  const titleEl = await waitForElement('h1');
  if (!titleEl) {
    console.warn('[IlliadCopyCat] Timed out waiting for page content');
    return null;
  }

  const oclcNumber = oclcFromUrlPath();
  if (!oclcNumber) return null;

  return buildMetadata(oclcNumber);
}

function buildMetadata(oclcNumber: string): WorldCatMetadata {
  const pageText = document.body.innerText;
  return {
    oclcNumber,
    title: scrapeTitle(),
    authors: scrapeAuthors(),
    isbns: extractIsbns(pageText),
    issns: extractIssns(pageText),
    publisher: scrapePublisher(),
    year: scrapeYear(),
    edition: scrapeEdition(),
    format: scrapeFormat(),
    language: scrapeLanguage(),
  };
}
