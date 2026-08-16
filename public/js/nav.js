(function () {
  const burger = document.getElementById('burgerBtn');
  const nav = document.getElementById('mainNav');
  const overlay = document.getElementById('navOverlay');
  if (!burger || !nav) return;

  function closeNav() {
    nav.classList.remove('open');
    burger.classList.remove('open');
    overlay.classList.remove('show');
    document.body.classList.remove('nav-locked');
    closeAllDropdowns();
  }
  function openNav() {
    nav.classList.add('open');
    burger.classList.add('open');
    overlay.classList.add('show');
    document.body.classList.add('nav-locked');
  }

  burger.addEventListener('click', () => {
    nav.classList.contains('open') ? closeNav() : openNav();
  });
  overlay.addEventListener('click', closeNav);
  nav.querySelectorAll(':scope > a').forEach(a => a.addEventListener('click', closeNav));
  nav.querySelectorAll('.nav-dropdown a').forEach(a => a.addEventListener('click', closeNav));
  window.addEventListener('resize', () => { if (window.innerWidth > 900) closeNav(); });

  // --- Выпадающие подменю (О семье / Сообщество / Админ-панель) ---
  const dropdownItems = Array.from(nav.querySelectorAll('.nav-item.has-dropdown'));

  function closeAllDropdowns(except) {
    dropdownItems.forEach(item => {
      if (item !== except) item.classList.remove('open');
    });
  }

  dropdownItems.forEach(item => {
    const toggle = item.querySelector('.nav-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = item.classList.contains('open');
      closeAllDropdowns(item);
      item.classList.toggle('open', !isOpen);
    });
  });

  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) closeAllDropdowns();
  });
})();
