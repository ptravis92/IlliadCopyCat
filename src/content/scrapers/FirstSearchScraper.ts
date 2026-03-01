import type { WorldCatMetadata } from '../types';
import type { IScraper } from './IScraper';
import {
  getText,
  getAllText,
  getFieldElementByLabel,
  getFieldByLabel,
  getAllFieldsByLabel,
  extractIsbns,
  extractIssns,
} from './utils';

export class FirstSearchScraper implements IScraper {

  // ---------------------------------------------------------------------------
  // Page detection
  // ---------------------------------------------------------------------------

  isItemPage(): boolean {
    return document.title.includes('Detailed Record');
  }

  // ---------------------------------------------------------------------------
  // OCLC number
  //
  // FirstSearch does not put the OCLC number in the URL. It appears in the
  // "Cite This Item" anchor: <a href="http://worldcat.org/oclc/123456?page=citation">
  // ---------------------------------------------------------------------------

  getOclcNumber(): string | null {
    const link = document.querySelector<HTMLAnchorElement>('a[href*="worldcat.org/oclc/"]');
    if (!link) return null;
    const match = link.href.match(/\/oclc\/(\d+)/);
    return match ? match[1] : null;
  }

  // ---------------------------------------------------------------------------
  // Field scrapers
  // ---------------------------------------------------------------------------

  scrapeTitle(): string {
    return getFieldByLabel('Title:');
  }

  scrapeAuthors(): string[] {
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

  scrapePublisher(): string {
    // "Publication:" row contains "Place : Publisher, Year"
    return getFieldByLabel('Publication:');
  }

  scrapeYear(): string {
    const raw = getFieldByLabel('Year:');
    const match = raw.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    return match ? match[1] : raw;
  }

  scrapeEdition(): string {
    return getFieldByLabel('Edition:');
  }

  scrapeFormat(): string {
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

  scrapeLanguage(): string {
    // "Language:" row may contain extra info after a semicolon, e.g.
    // "English; Closed-captioned." — return only the language portion.
    const raw = getFieldByLabel('Language:');
    return raw.split(';')[0].trim();
  }

  scrapeSource(): string {
    // Article records have an "In:" row containing the journal/periodical title.
    // Strip trailing MARC period, e.g. "Extrapolation." → "Extrapolation".
    return getFieldByLabel('In:').replace(/\.$/, '').trim();
  }

  scrapePages(): string {
    // "Description:" row contains the page range, e.g. "pages 53-64".
    // Strip leading "pages " / "p. " prefix to leave just the numbers.
    const raw = getFieldByLabel('Description:');
    return raw.replace(/^p(?:ages?)?\.\s*/i, '').trim();
  }

  scrapeIsbns(): string[] {
    // Restrict to "Standard No:" row only — searching all page text causes false
    // matches (e.g. author date ranges like "1892-1973" match the ISSN pattern).
    return extractIsbns(getFieldByLabel('Standard No:'));
  }

  scrapeIssns(): string[] {
    return extractIssns(getFieldByLabel('Standard No:'));
  }

  // ---------------------------------------------------------------------------
  // Top-level orchestrator
  // ---------------------------------------------------------------------------

  scrape(): Promise<WorldCatMetadata | null> {
    if (!this.isItemPage()) return Promise.resolve(null);

    const oclcNumber = this.getOclcNumber();
    if (!oclcNumber) {
      console.warn('[IlliadCopyCat] Could not find OCLC number on FirstSearch page');
      return Promise.resolve(null);
    }

    return Promise.resolve(this.buildMetadata(oclcNumber));
  }

  private buildMetadata(oclcNumber: string): WorldCatMetadata {
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
