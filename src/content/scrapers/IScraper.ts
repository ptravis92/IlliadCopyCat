import type { WorldCatMetadata } from '../types';

export interface IScraper {
  /** Returns true when the current page is a WorldCat item detail page. */
  isItemPage(): boolean;

  /** Returns the OCLC number for this page, or null if not found. */
  getOclcNumber(): string | null;

  scrapeTitle(): string;
  scrapeAuthors(): string[];
  scrapePublisher(): string;
  scrapeYear(): string;
  scrapeEdition(): string;
  scrapeFormat(): string;
  scrapeLanguage(): string;

  /** Journal/periodical title for article records (from "In:" row). Returns '' if N/A. */
  scrapeSource(): string;

  /** Page range for article copy requests (from "Description:" row). Returns '' if N/A. */
  scrapePages(): string;

  scrapeIsbns(): string[];
  scrapeIssns(): string[];

  /** Top-level orchestrator — scrapes all fields and returns a WorldCatMetadata object. */
  scrape(): Promise<WorldCatMetadata | null>;
}
