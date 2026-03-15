import { getSettings } from '../shared/storage';
import { syncProxyContentScript } from '../shared/contentScript';

async function reRegisterFromStorage(): Promise<void> {
  const { librarySubdomain } = await getSettings();
  await syncProxyContentScript(librarySubdomain);
}

// Register on first install and on extension updates/reloads
chrome.runtime.onInstalled.addListener(reRegisterFromStorage);

// Re-register on browser startup (covers the case where the service worker
// is killed and restarted — registered scripts persist, but it's cheap to
// confirm and re-register if needed)
chrome.runtime.onStartup.addListener(reRegisterFromStorage);

// React to settings changes in real time — no page reload needed
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'sync' || area === 'local') && 'librarySubdomain' in changes) {
    syncProxyContentScript(changes['librarySubdomain'].newValue ?? '');
  }
});
