// Wires Preview / Share / Copy text / Copy link to one assemble() callback.
import { generateShareCardSVG, previewCard, shareCard, slugFilename } from './share-card.js';
import { buildShareText } from './share-text.js';
import { generateShareUrl } from './share-url.js';

function setStatus(el, message, kind) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('ok', 'err');
  if (kind) el.classList.add(kind);
}

export function bindShareControls({ assemble, statusEl, buttons }) {
  const { preview, share, copyText, copyLink } = buttons;

  if (preview) {
    preview.addEventListener('click', () => {
      try {
        previewCard(generateShareCardSVG(assemble()));
      } catch (e) {
        setStatus(statusEl, `Could not preview: ${e.message}`, 'err');
      }
    });
  }

  if (share) {
    share.addEventListener('click', async () => {
      try {
        const data = assemble();
        const svg = generateShareCardSVG(data);
        const outcome = await shareCard(svg, data.title || 'Hex Automaton', buildShareText(data), slugFilename(data));
        if (outcome === 'downloaded') setStatus(statusEl, 'Card downloaded.', 'ok');
        else if (outcome === 'shared') setStatus(statusEl, 'Shared.', 'ok');
      } catch (e) {
        setStatus(statusEl, `Could not share: ${e.message}`, 'err');
      }
    });
  }

  if (copyText) {
    copyText.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(buildShareText(assemble()));
        setStatus(statusEl, 'Share text copied.', 'ok');
      } catch {
        setStatus(statusEl, 'Clipboard permission denied.', 'err');
      }
    });
  }

  if (copyLink) {
    copyLink.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(generateShareUrl(assemble()));
        setStatus(statusEl, 'Link copied.', 'ok');
      } catch {
        setStatus(statusEl, 'Clipboard permission denied.', 'err');
      }
    });
  }
}
