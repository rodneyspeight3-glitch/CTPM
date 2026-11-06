(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  for (const host of document.querySelectorAll('[data-building-scene]')) {
    const button = host.querySelector('.building-motion-toggle');
    if (!button) continue;
    let manuallyPaused = false;
    function update() {
      const reduced = preference.matches || document.documentElement.dataset.motion === 'reduced';
      const paused = reduced || manuallyPaused;
      host.classList.toggle('scene-paused', paused);
      button.hidden = false;
      button.disabled = reduced;
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute('aria-label', reduced ? 'Building animation is off for reduced motion' : paused ? 'Play building animation' : 'Pause building animation');
      button.textContent = reduced ? 'Motion off' : paused ? 'Play motion' : 'Pause motion';
    }
    button.addEventListener('click', () => { manuallyPaused = !manuallyPaused; update(); });
    preference.addEventListener('change', update);
    new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    update();
  }
})();
