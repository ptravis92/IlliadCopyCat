import { isItemPage, scrapeWorldCatItem } from './scraper';
import { injectButton, removeButton } from './button';
import { getSettings } from '../shared/storage';

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  if (!isItemPage()) {
    removeButton();
    return;
  }

  const [metadata, settings] = await Promise.all([
    scrapeWorldCatItem(),
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
