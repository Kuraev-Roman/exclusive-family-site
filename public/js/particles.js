(function () {
  const canvas = document.getElementById('bg-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles;

  const COLORS = ['#e8bf4f', '#ffe9a8', '#ff9d3d', '#8b6bff', '#ff5fa2'];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = Math.max(window.innerHeight, document.body.scrollHeight);
  }

  function makeParticles() {
    const count = Math.min(70, Math.floor((w * h) / 26000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2.2 + 0.6,
      speedY: Math.random() * 0.35 + 0.08,
      speedX: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.5 + 0.25,
      twinkle: Math.random() * 0.02 + 0.005,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }));
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.y -= p.speedY;
      p.x += p.speedX;
      p.alpha += (Math.random() > 0.5 ? p.twinkle : -p.twinkle);
      if (p.alpha < 0.1) p.alpha = 0.1;
      if (p.alpha > 0.8) p.alpha = 0.8;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      ctx.beginPath();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => { resize(); makeParticles(); });
  resize();
  makeParticles();
  tick();
})();
