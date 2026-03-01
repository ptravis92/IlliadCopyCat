import { createScraper } from './scrapers';
import { injectButton, removeButton } from './button';
import { getSettings } from '../shared/storage';

// Decided once at module load — FirstSearch vs. WorldCat SPA.
const scraper = createScraper();

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  if (!scraper.isItemPage()) {
    removeButton();
    return;
  }

  const [metadata, settings] = await Promise.all([
    scraper.scrape(),
    getSettings(),
  ]);

  if (!metadata) {
    console.warn('[IlliadCopyCat] Could not scrape page metadata');
    return;
  }

  console.log('[IlliadCopyCat] Scraped metadata:', metadata);
  injectButton(metadata, settings.illiadBaseUrl);
}

// ---------------------------------------------------------------------------
// SPA navigation handling
//
// WorldCat uses client-side routing (pushState). The content script only fires
// once on initial page load, so we monkey-patch history.pushState and listen
// for popstate to re-run whenever the URL changes.
// ---------------------------------------------------------------------------

const _originalPushState = history.pushState.bind(history);
history.pushState = function (...args) {
  _originalPushState(...args);
  run();
};

window.addEventListener('popstate', run);

// ---------------------------------------------------------------------------
// Initial run
// ---------------------------------------------------------------------------

run();
