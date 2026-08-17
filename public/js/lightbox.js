(function () {
  let overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = '<span class="lightbox-close">✕</span><img class="lightbox-img" alt="">';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', close);
    return overlay;
  }

  function open(src) {
    const ov = ensureOverlay();
    ov.querySelector('.lightbox-img').src = src;
    ov.classList.add('show');
    document.body.classList.add('nav-locked');
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('show');
    document.body.classList.remove('nav-locked');
  }

  document.addEventListener('click', function (e) {
    const img = e.target.closest('[data-lightbox]');
    if (img) {
      e.preventDefault();
      open(img.getAttribute('data-lightbox') || img.src);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();
