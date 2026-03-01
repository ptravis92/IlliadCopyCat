// ---------------------------------------------------------------------------
// Shared DOM utilities
// ---------------------------------------------------------------------------

/** Returns trimmed text content of the first matching element, or ''. */
export function getText(selector: string, root: Document | Element = document): string {
  return root.querySelector(selector)?.textContent?.trim() ?? '';
}

/** Returns trimmed text of all matching elements, filtering empty strings. */
export function getAllText(selector: string, root: Document | Element = document): string[] {
  return Array.from(root.querySelectorAll(selector))
    .map((el) => el.textContent?.trim() ?? '')
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// XPath label-based lookup
//
// FirstSearch uses a two-column table layout: left <td> holds the label,
// right <td> holds the value. Labels end with a colon, e.g. "Author(s):".
// ---------------------------------------------------------------------------

/**
 * Returns the value element immediately following the label element, or null.
 * Label must match exactly including any trailing colon, e.g. 'Author(s):'.
 */
export function getFieldElementByLabel(label: string): Element | null {
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
export function getFieldByLabel(label: string): string {
  return getFieldElementByLabel(label)?.textContent?.trim() ?? '';
}

/** Returns all sibling element texts after a label (for multi-value fields). */
export function getAllFieldsByLabel(label: string): string[] {
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
// Regex-based identifier extraction
// ---------------------------------------------------------------------------

const ISBN_13_RE = /\b97[89]\d{10}\b/g;
const ISBN_10_RE = /\b\d{9}[\dX]\b/g;
const ISSN_RE = /\b\d{4}-\d{3}[\dX]\b/g;

export function extractIsbns(text: string): string[] {
  const isbn13s = text.match(ISBN_13_RE) ?? [];
  const isbn10s = text.match(ISBN_10_RE) ?? [];
  return [...new Set([...isbn13s, ...isbn10s])];
}

export function extractIssns(text: string): string[] {
  return [...new Set(text.match(ISSN_RE) ?? [])];
}

// ---------------------------------------------------------------------------
// SPA DOM waiter
// ---------------------------------------------------------------------------

/**
 * Waits for a CSS selector to match an element.
 * Used only for the new WorldCat SPA (React needs time to hydrate).
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
