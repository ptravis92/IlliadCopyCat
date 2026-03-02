import type { WorldCatMetadata } from '../types';
import type { IScraper } from './IScraper';
import {
  getText,
  getAllText,
  extractIsbns,
  waitForElement,
} from './utils';

export class WorldCatSpaScraper implements IScraper {

  // ---------------------------------------------------------------------------
  // Page detection
  // ---------------------------------------------------------------------------

  isItemPage(): boolean {
    // search.worldcat.org uses /title/NUMBER (e.g. /title/930058725)
    // www.worldcat.org uses /oclc/NUMBER (legacy format)
    return /\/title\/\d+/.test(location.href) || /\/oclc\/\d+/.test(location.href);
  }

  // ---------------------------------------------------------------------------
  // OCLC number
  //
  // search.worldcat.org: number follows /title/ in the path.
  // www.worldcat.org:    number follows /oclc/ in the path.
  // ---------------------------------------------------------------------------

  getOclcNumber(): string | null {
    const titleMatch = location.href.match(/\/title\/(\d+)/);
    if (titleMatch) return titleMatch[1];
    const oclcMatch = location.href.match(/\/oclc\/(\d+)/);
    return oclcMatch ? oclcMatch[1] : null;
  }

  // ---------------------------------------------------------------------------
  // Field scrapers
  //
  // NOTE: data-testid and aria-labelledby values are dynamic — they include
  // the OCLC number (e.g. "publisher-930058725"). Use attribute prefix
  // matching ([attr^="prefix"]) rather than exact values.
  //
  // Update selectors here if WorldCat restructures the page.
  // ---------------------------------------------------------------------------

  scrapeTitle(): string {
    return getText('h1');
  }

  scrapeAuthors(): string[] {
    // Author links carry au= in the search href, e.g. /search?q=au=%22...%22
    return getAllText('a[href*="au="]');
  }

  scrapePublisher(): string {
    // data-testid="publisher-{oclcNumber}" — prefix match to avoid hardcoding
    return getText('[data-testid^="publisher-"]');
  }

  scrapeYear(): string {
    // Year is embedded in the publisher text: "Scout Press, New York, 2016"
    const raw = getText('[data-testid^="publisher-"]');
    const match = raw.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    return match ? match[1] : '';
  }

  scrapeEdition(): string {
    // span[aria-labelledby^="edition-"] contains the edition text followed by
    // a "View all formats and editions" link — strip the link text.
    const full = getText('[aria-labelledby^="edition-"]');
    return full.replace(/\s*View all formats and editions\s*$/, '').trim();
  }

  scrapeFormat(): string {
    // data-testid="format-{oclcNumber}" — the span contains an aria-hidden SVG
    // followed by plain text (e.g. "Print Book"). textContent omits SVG path
    // data (no text nodes), leaving just the human-readable format label.
    return getText('[data-testid^="format-"]');
  }

  scrapeLanguage(): string {
    // The format/language/year line:
    //   <span data-testid="format-...">Print Book</span>, <span>English</span>, 2016
    // Language is the plain <span> immediately after the format span.
    const formatEl = document.querySelector('[data-testid^="format-"]');
    return formatEl?.nextElementSibling?.textContent?.trim() ?? '';
  }

  scrapeSource(): string {
    // The new SPA does not have an "In:" equivalent for article records yet.
    return '';
  }

  scrapePages(): string {
    // The new SPA does not have a "Description:" equivalent for article records yet.
    return '';
  }

  scrapeIsbns(): string[] {
    // ISBNs are listed in a labeled section whose span has aria-labelledby^="isbn-"
    const isbnText = getText('[aria-labelledby^="isbn-"]');
    if (isbnText) return extractIsbns(isbnText);
    // Fallback: scan entire body text
    return extractIsbns(document.body.innerText);
  }

  scrapeIssns(): string[] {
    // Require an explicit "ISSN" label before the number to avoid false matches
    // from catalog numbers, dates, and other patterns in page body text.
    // Books don't display an ISSN label; serial records do.
    const bodyText = document.body.innerText;
    const matches: string[] = [];
    const labeledPattern = /\bISSN\b[:\s]+(\d{4}-\d{3}[\dX])/gi;
    let match;
    while ((match = labeledPattern.exec(bodyText)) !== null) {
      matches.push(match[1]);
    }
    return [...new Set(matches)];
  }

  // ---------------------------------------------------------------------------
  // Top-level orchestrator
  // ---------------------------------------------------------------------------

  async scrape(): Promise<WorldCatMetadata | null> {
    if (!this.isItemPage()) return null;

    // Wait for React to hydrate the title before scraping.
    const titleEl = await waitForElement('h1');
    if (!titleEl) {
      console.warn('[IlliadCopyCat] Timed out waiting for page content');
      return null;
    }

    const oclcNumber = this.getOclcNumber();
    if (!oclcNumber) return null;

    return {
      oclcNumber,
      title: this.scrapeTitle(),
      authors: this.scrapeAuthors(),
      isbns: this.scrapeIsbns(),
      issns: this.scrapeIssns(),
      publisher: this.scrapePublisher(),
      year: this.scrapeYear(),
      edition: this.scrapeEdition(),
      format: this.scrapeFormat(),
      language: this.scrapeLanguage(),
      source: this.scrapeSource(),
      pages: this.scrapePages(),
    };
  }
}
