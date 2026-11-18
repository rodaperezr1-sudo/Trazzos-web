/* TRAZZO · Landing de proyecto: video del recorrido.
   - Se carga y reproduce solo cuando está en pantalla.
   - I-8: botón visible de pausa / reproducir (WCAG 2.2.2). Con prefers-reduced-motion no arranca solo.
   Textos del botón "Pausar" / "Reproducir": PENDIENTES de aprobación. */
(function () {
  'use strict';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.l-video').forEach(box => {
    const v = box.querySelector('video'), b = box.querySelector('.v-pausa');
    if (!v) return;
    let pausadoPorUsuario = REDUCE;
    const pintar = () => {
      const pausado = v.paused;
      if (!b) return;
      b.querySelector('.txt').textContent = pausado ? 'Reproducir' : 'Pausar';
      b.classList.toggle('pausado', pausado);
    };
    v.addEventListener('play', pintar); v.addEventListener('pause', pintar);
    if (b) b.addEventListener('click', () => {
      if (v.paused) { pausadoPorUsuario = false; v.preload = 'auto'; v.play().catch(() => {}); }
      else { pausadoPorUsuario = true; v.pause(); }
    });
    new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting && !pausadoPorUsuario) { v.preload = 'auto'; v.play().catch(pintar); }
      else if (!e.isIntersecting) v.pause();
    }), { threshold: .25 }).observe(v);
    pintar();
  });
})();
