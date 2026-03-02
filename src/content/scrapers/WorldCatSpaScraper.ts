import type { WorldCatMetadata } from '../types';
import type { IScraper } from './IScraper';
import {
  getText,
  getAllText,
  getFieldByLabel,
  getAllFieldsByLabel,
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
  // NOTE: selector strings should be verified against the live DOM. WorldCat
  // may restructure the page; update selectors here if so.
  // ---------------------------------------------------------------------------

  scrapeTitle(): string {
    return getText('h1');
  }

  scrapeAuthors(): string[] {
    for (const sel of [
      '[data-testid="author-link"]',
      'a[href*="creator="]',
      'a[href*="au="]',
    ]) {
      const found = getAllText(sel);
      if (found.length > 0) return found;
    }
    // XPath fallback
    const byLabel = getAllFieldsByLabel('Author').concat(getAllFieldsByLabel('Authors'));
    return byLabel.length > 0 ? byLabel : [];
  }

  scrapePublisher(): string {
    return (
      getText('[data-testid="publisher"]') ||
      getFieldByLabel('Publisher') ||
      getFieldByLabel('Published')
    );
  }

  scrapeYear(): string {
    const raw =
      getText('[data-testid="publication-date"]') ||
      getFieldByLabel('Date') ||
      getFieldByLabel('Year') ||
      getFieldByLabel('Publication date');
    const match = raw.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    return match ? match[1] : raw;
  }

  scrapeEdition(): string {
    return getText('[data-testid="edition"]') || getFieldByLabel('Edition');
  }

  scrapeFormat(): string {
    return (
      getText('[data-testid="format"]') ||
      getText('[aria-label*="Format"]') ||
      getFieldByLabel('Format')
    );
  }

  scrapeLanguage(): string {
    return getText('[data-testid="language"]') || getFieldByLabel('Language');
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
    console.log('[IlliadCopyCat] waitForElement(h1) resolved:', titleEl ? `"${titleEl.textContent?.trim().slice(0, 60)}"` : 'null (timed out)');
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
