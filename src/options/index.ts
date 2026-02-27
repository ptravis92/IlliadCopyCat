import { getSettings, saveSettings, proxyUrlFromSubdomain } from '../shared/storage';

async function init(): Promise<void> {
  const settings = await getSettings();

  const form = document.getElementById('settings-form') as HTMLFormElement;
  const illiadInput = document.getElementById('illiad-url') as HTMLInputElement;
  const subdomainInput = document.getElementById('library-subdomain') as HTMLInputElement;
  const proxyPreview = document.getElementById('proxy-preview') as HTMLParagraphElement;
  const status = document.getElementById('status') as HTMLSpanElement;

  illiadInput.value = settings.illiadBaseUrl;
  subdomainInput.value = settings.librarySubdomain;

  // Live preview of the constructed proxy URL
  function updatePreview(): void {
    const url = proxyUrlFromSubdomain(subdomainInput.value);
    proxyPreview.innerHTML = url
      ? `Proxy URL: <span>${url}</span>`
      : '';
  }

  updatePreview();
  subdomainInput.addEventListener('input', updatePreview);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings({
      illiadBaseUrl: illiadInput.value.trim(),
      librarySubdomain: subdomainInput.value.trim(),
    });
    status.textContent = 'Saved!';
    setTimeout(() => {
      status.textContent = '';
    }, 2500);
  });
}

document.addEventListener('DOMContentLoaded', init);
