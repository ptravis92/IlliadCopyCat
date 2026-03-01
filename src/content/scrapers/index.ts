import { FirstSearchScraper } from './FirstSearchScraper';
import { WorldCatSpaScraper } from './WorldCatSpaScraper';
import type { IScraper } from './IScraper';

/**
 * Returns the appropriate scraper for the current page.
 * Called once at content-script load time to select between the legacy
 * FirstSearch interface and the new search.worldcat.org SPA.
 */
export function createScraper(): IScraper {
  if (document.title.includes('FirstSearch')) {
    return new FirstSearchScraper();
  }
  return new WorldCatSpaScraper();
}

export type { IScraper };
export { FirstSearchScraper } from './FirstSearchScraper';
export { WorldCatSpaScraper } from './WorldCatSpaScraper';
