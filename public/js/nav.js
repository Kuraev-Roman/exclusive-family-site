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
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
  window.addEventListener('resize', () => { if (window.innerWidth > 900) closeNav(); });
})();
