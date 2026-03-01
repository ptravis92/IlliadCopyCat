export interface WorldCatMetadata {
  oclcNumber: string;
  title: string;
  authors: string[];
  isbns: string[];
  issns: string[];
  publisher: string;
  year: string;
  edition: string;
  format: string;
  language: string;
  source: string;   // FirstSearch "In:" row — journal/periodical title for article records
  pages: string;    // FirstSearch "Description:" row — page range for article records
}
