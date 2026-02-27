import { proxyUrlFromSubdomain } from './storage';

const DYNAMIC_SCRIPT_ID = 'illiad-copycat-proxy-script';

/**
 * Registers (or re-registers) the content script for a library's EZproxy URL.
 *
 * Called by the background service worker on install/startup and whenever
 * `librarySubdomain` changes in storage.
 *
 * chrome.scripting.registerContentScripts() persists across browser restarts,
 * so we only need to call this when the setting changes or on extension reload.
 */
export async function syncProxyContentScript(subdomain: string): Promise<void> {
  // Always unregister first so we don't accumulate stale registrations
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [DYNAMIC_SCRIPT_ID] });
  } catch {
    // Not yet registered — safe to ignore
  }

  const baseUrl = proxyUrlFromSubdomain(subdomain);
  if (!baseUrl) return;

  const matchPattern = `${new URL(baseUrl).origin}/*`;

  await chrome.scripting.registerContentScripts([
    {
      id: DYNAMIC_SCRIPT_ID,
      matches: [matchPattern],
      js: ['content/index.js'],
      runAt: 'document_idle',
    },
  ]);

  console.log(`[IlliadCopyCat] Registered content script for ${matchPattern}`);
}
