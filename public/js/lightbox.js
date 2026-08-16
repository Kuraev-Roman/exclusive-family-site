(function () {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = '<button type="button" class="lightbox-close" aria-label="Закрыть">✕</button><img alt="Фото в полный размер">';
  document.body.appendChild(overlay);

  const img = overlay.querySelector('img');
  const closeBtn = overlay.querySelector('.lightbox-close');

  function open(src, alt) {
    img.src = src;
    img.alt = alt || 'Фото в полный размер';
    overlay.classList.add('show');
    document.body.classList.add('nav-locked');
  }
  function close() {
    overlay.classList.remove('show');
    document.body.classList.remove('nav-locked');
    img.src = '';
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  document.querySelectorAll('.lightbox-trigger').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      open(el.getAttribute('src') || el.getAttribute('href'), el.getAttribute('alt'));
    });
  });
})();
