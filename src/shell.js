// Shared explorer chrome: panel drawer, play-button sync, status line, Space.
export function initShell({ playButtons = [], statusEls = [], getStatus } = {}) {
  const toggle = document.getElementById('panelToggle');
  const backdrop = document.getElementById('panelBackdrop');
  const narrow = () => window.matchMedia('(max-width: 800px)').matches;

  function setPanel(open) {
    document.body.classList.toggle('panel-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (toggle) toggle.textContent = open ? 'Close' : 'Panel';
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      setPanel(!document.body.classList.contains('panel-open'));
    });
  }
  if (backdrop) backdrop.addEventListener('click', () => setPanel(false));

  setPanel(!narrow());
  let wasNarrow = narrow();
  window.addEventListener('resize', () => {
    const n = narrow();
    if (wasNarrow && !n) setPanel(true);
    if (!wasNarrow && n) setPanel(false);
    wasNarrow = n;
  });

  const buttons = playButtons.filter(Boolean);
  function setPlayLabel(running) {
    const label = running ? 'Pause' : 'Play';
    for (const b of buttons) b.textContent = label;
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
    if (ev.code === 'Space') {
      ev.preventDefault();
      if (buttons[0]) buttons[0].click();
    } else if (ev.key === 'p' || ev.key === 'P') {
      setPanel(!document.body.classList.contains('panel-open'));
    } else if (ev.key === 'Escape') {
      if (narrow()) setPanel(false);
    }
  });

  return {
    setPlayLabel,
    setPanel,
    updateStatus(running) {
      if (!getStatus) return;
      const text = getStatus(running);
      for (const el of statusEls) {
        if (el) el.textContent = text;
      }
    },
  };
}
