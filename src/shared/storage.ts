export interface ExtensionSettings {
  illiadBaseUrl: string;
  /** Library subdomain used to construct the EZproxy URL, e.g. "metrolibrary" */
  librarySubdomain: string;
}

const DEFAULTS: ExtensionSettings = {
  illiadBaseUrl: '',
  librarySubdomain: '',
};

export function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (items) => resolve(items as ExtensionSettings));
  });
}

export function saveSettings(patch: Partial<ExtensionSettings>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(patch, resolve);
  });
}

/**
 * Derives the full FirstSearch EZproxy base URL from a library subdomain.
 * e.g. "metrolibrary" → "https://firstsearch-oclc-org.ezproxy.metrolibrary.org"
 *
 * Returns empty string if the subdomain is blank.
 */
export function proxyUrlFromSubdomain(subdomain: string): string {
  const s = subdomain.trim();
  if (!s) return '';
  return `https://firstsearch-oclc-org.ezproxy.${s}.org`;
}
