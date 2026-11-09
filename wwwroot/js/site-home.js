(() => {
  const stripHeight = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue('--site-home-height')) || 44;
  window.MindGoblinHome ??= Object.freeze({
    get viewportHeight() { return Math.max(1, window.innerHeight - stripHeight); }
  });

  function mount() {
    if (document.querySelector('.site-home')) return;

    const link = document.createElement('a');
    link.className = 'site-home';
    link.href = '/';
    link.title = 'Mind Goblin';
    link.setAttribute('aria-label', 'Mind Goblin home');

    const icon = document.createElement('img');
    icon.src = '/img/home/favicon.png';
    icon.alt = '';
    icon.width = icon.height = 28;
    link.append(icon);

    const bar = document.createElement('nav');
    bar.className = 'site-home-bar';
    bar.setAttribute('aria-label', 'Site navigation');
    bar.append(link);
    // Navigation gestures must not trigger the game beneath the strip.
    for (const event of ['pointerdown', 'mousedown', 'click', 'keydown', 'keyup']) {
      bar.addEventListener(event, event => event.stopPropagation());
    }
    document.body.prepend(bar);
  }

  if (document.body) {
    mount();
  } else {
    // Mount before application modules perform expensive startup work.
    const bodyReady = new MutationObserver(() => {
      if (!document.body) return;
      bodyReady.disconnect();
      mount();
    });
    bodyReady.observe(document.documentElement, { childList: true });
  }
})();
