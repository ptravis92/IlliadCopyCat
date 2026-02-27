import type { WorldCatMetadata } from './types';
import { buildILLiadUrl } from './illiad';

export const BUTTON_CONTAINER_ID = 'illiad-copycat-root';

// ---------------------------------------------------------------------------
// Styles (inline to avoid conflicts with WorldCat's Material-UI CSS)
// ---------------------------------------------------------------------------

const BASE_BTN: Partial<CSSStyleDeclaration> = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  backgroundColor: '#1a56a0',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '0.5rem 1.25rem',
  fontSize: '0.9rem',
  fontWeight: '600',
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  textDecoration: 'none',
  transition: 'background-color 0.15s ease',
};

const NOTICE: Partial<CSSStyleDeclaration> = {
  display: 'inline-block',
  margin: '0.75rem 0',
  padding: '0.5rem 1rem',
  backgroundColor: '#fff3cd',
  border: '1px solid #ffc107',
  borderRadius: '4px',
  fontSize: '0.85rem',
  fontFamily: 'system-ui, sans-serif',
  color: '#333',
};

function applyStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles);
}

// ---------------------------------------------------------------------------
// Element builders
// ---------------------------------------------------------------------------

function buildRequestButton(illiadUrl: string): HTMLElement {
  const btn = document.createElement('a');
  btn.textContent = 'Request via ILL';
  btn.href = illiadUrl;
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.title = 'Open an Interlibrary Loan request for this item';
  applyStyles(btn, BASE_BTN);

  btn.addEventListener('mouseover', () => {
    btn.style.backgroundColor = '#14407e';
  });
  btn.addEventListener('mouseout', () => {
    btn.style.backgroundColor = '#1a56a0';
  });

  return btn;
}

function buildUnconfiguredNotice(): HTMLElement {
  const wrapper = document.createElement('div');
  applyStyles(wrapper, NOTICE);

  const optionsUrl = chrome.runtime.getURL('options/index.html');
  wrapper.innerHTML =
    '<strong>IlliadCopyCat:</strong> ' +
    `<a href="${optionsUrl}" target="_blank" rel="noopener noreferrer" ` +
    'style="color:#1a56a0">Configure your ILLiad URL</a> to enable one-click ILL requests.';

  return wrapper;
}

function buildContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = BUTTON_CONTAINER_ID;
  applyStyles(container, { margin: '0.75rem 0' });
  return container;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Injects a "Request via ILL" button (or a setup notice) into the WorldCat
 * item page, immediately after the <h1> title element.
 *
 * Safe to call multiple times — removes any existing injection first.
 */
export function injectButton(metadata: WorldCatMetadata, illiadBaseUrl: string): void {
  // Remove any stale injection from a previous SPA navigation
  document.getElementById(BUTTON_CONTAINER_ID)?.remove();

  const anchor = document.querySelector('h1');
  if (!anchor) return;

  const container = buildContainer();

  if (illiadBaseUrl) {
    const url = buildILLiadUrl(illiadBaseUrl, metadata);
    container.appendChild(buildRequestButton(url));
  } else {
    container.appendChild(buildUnconfiguredNotice());
  }

  anchor.insertAdjacentElement('afterend', container);
}

/** Removes the injected UI, e.g. when navigating away from an item page. */
export function removeButton(): void {
  document.getElementById(BUTTON_CONTAINER_ID)?.remove();
}
