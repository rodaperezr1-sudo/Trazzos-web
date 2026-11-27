/* =========================================================
   TRAZZO · Comportamiento común del sitio (todas las páginas)
   header por sección, menú móvil, acordeón, comparador, timelapse,
   cifras, pasos, filtros de proyectos y formulario (solo front).
   En WordPress: tema-trazzo/assets/js/sitio.js
   ========================================================= */
(function () {
  'use strict';
  const TZ = window.TZ = window.TZ || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const movil = () => matchMedia('(max-width:860px)').matches;
  /* Base única de rutas (I-10): <html data-base="../"> en el prototipo; window.TRAZZO_BASE en WordPress.
     (secuencias.js la define igual; aquí se repite para las páginas que no cargan el motor) */
  if (!TZ.url) {
    const BASE = String(window.TRAZZO_BASE || document.documentElement.dataset.base || '../').replace(/\/?$/, '/');
    TZ.base = BASE; TZ.url = p => BASE + String(p).replace(/^\.?\//, '');
  }

  /* ---------- Loader (solo Home): se quita cuando el recorrido tiene su primer fotograma ---------- */
  const loader = $('.loader');
  TZ.quitarLoader = () => { if (loader) loader.classList.add('fuera'); };
  if (loader) setTimeout(TZ.quitarLoader, 4000);   // tope por si la red está lenta

  /* ---------- Header: se adapta a la sección que tiene debajo ----------
     Cada sección lleva data-tono="oscuro|claro"; data-header="transparente" deja el header sin fondo. */
  const header = $('#header');
  const secciones = $$('[data-tono]');
  function headerSegunSeccion() {
    if (!header) return;
    const y = header.offsetHeight / 2;
    let sec = null;
    for (const s of secciones) { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) { sec = s; break; } }
    if (!sec) return;
    /* Al soltarse el stage fijo, el título y el isologo suben y cruzan el header.
       Si el header sigue transparente, se leen encima del logo. Ahí pasa a sólido. */
    const rec = document.getElementById('recorrido');
    let despegado = false;
    if (rec && sec.id === 'recorrido') {
      const rr = rec.getBoundingClientRect();
      despegado = rr.top < -1 && rr.bottom < innerHeight - 1;
    }
    header.classList.toggle('claro', !despegado && sec.dataset.tono === 'claro');
    header.classList.toggle('solid', despegado || sec.dataset.header !== 'transparente');
  }
  addEventListener('scroll', headerSegunSeccion, { passive: true });
  addEventListener('resize', headerSegunSeccion);
  headerSegunSeccion();
  TZ.headerSegunSeccion = headerSegunSeccion;

  /* En el Home el menú no está al cargar: entra con el primer scroll. */
  if (header && header.classList.contains('header-espera')) {
    const menuSegunScroll = () => {
      header.classList.toggle('header-listo', (window.scrollY || 0) > 28);
    };
    addEventListener('scroll', menuSegunScroll, { passive: true });
    menuSegunScroll();
  }

  /* ---------- Menú móvil ---------- */
  const burger = $('#burger'), menu = $('#mobileMenu');
  if (burger && menu) {
    const cerrar = () => { document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menú'); menu.setAttribute('aria-hidden', 'true'); window.lenis && window.lenis.start(); };
    burger.addEventListener('click', () => {
      const o = document.body.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', o); burger.setAttribute('aria-label', o ? 'Cerrar menú' : 'Abrir menú'); menu.setAttribute('aria-hidden', !o);
      if (window.lenis) o ? window.lenis.stop() : window.lenis.start();
      if (o) { const a = $('a', menu); a && a.focus(); }
    });
    $$('a', menu).forEach(a => a.addEventListener('click', cerrar));
    addEventListener('keydown', e => {
      if (!document.body.classList.contains('menu-open')) return;
      if (e.key === 'Escape') { cerrar(); burger.focus(); return; }
      // M-8: el foco queda dentro del menú (enlaces + botón de cerrar)
      if (e.key === 'Tab') {
        const f = [burger, ...$$('a', menu)], i = f.indexOf(document.activeElement);
        const j = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
        f[j].focus(); e.preventDefault();
      }
    });
  }

  /* ---------- Acordeón de la galería: hover en escritorio, toque en móvil ---------- */
  const cards = $$('#acordeon .card');
  const abrir = c => cards.forEach(x => x.classList.toggle('is-open', x === c));
  cards.forEach(c => {
    c.addEventListener('mouseenter', () => { if (!movil()) abrir(c); });
    c.addEventListener('focus', () => abrir(c));
    c.addEventListener('click', e => { if (!c.classList.contains('is-open')) { e.preventDefault(); abrir(c); } });
  });

  /* ---------- Comparador (día/noche, antes/después) ---------- */
  $$('[data-comparador]').forEach(comp => {
    const r = $('input[type=range]', comp);
    r.addEventListener('input', () => comp.style.setProperty('--pos', r.value + '%'));
  });
  // Pestañas del Home: cambian la escena. Ajuste de encuadre por escena (object-position de la imagen de noche):
  // en "Lateral" el día y la noche no son la misma toma; la noche está ~80 px más abajo -> 50% 76 % (sistema.md §8).
  const AJUSTE_NOCHE = { 'fachada-lateral': '50% 76%' };
  const tabs = $$('.dn-tabs [role=tab]');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => { x.setAttribute('aria-selected', x === t); x.tabIndex = x === t ? 0 : -1; });
    const s = t.dataset.scene, dia = $('#dnDia'), noche = $('#dnNoche');
    dia.src = TZ.url(`assets/_web/dia-noche/${s}-dia.jpg`);
    noche.src = TZ.url(`assets/_web/dia-noche/${s}-noche.jpg`);
    const panel = $('#dn-panel'); if (panel) panel.setAttribute('aria-labelledby', t.id);
    dia.alt = t.dataset.altDia || dia.alt; noche.alt = t.dataset.altNoche || noche.alt;
    noche.style.objectPosition = AJUSTE_NOCHE[s] || '';
  }));
  const tl = $('.dn-tabs');
  if (tl) tl.addEventListener('keydown', e => {
    const i = tabs.indexOf(document.activeElement); if (i < 0) return;
    const j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : -1;
    if (j >= 0) { tabs[j].focus(); tabs[j].click(); e.preventDefault(); }
  });

  /* ---------- Timelapse día -> noche controlado por scroll (frames/dianoche) ---------- */
  const tlBox = $('#timelapse');
  if (tlBox && window.gsap && TZ.Lienzo) {
    const lz = new TZ.Lienzo($('#tl-lienzo'));
    let seq = null, prog = 0;
    const barra = $('#tl-bar');
    const pintar = () => { if (seq) lz.poner(lz.capasDe(seq, prog * (seq.n - 1), 1).filter(c => c.img)); };
    async function preparar(man) {
      const s = new TZ.Secuencia('dianoche', TZ.urlsDe('dianoche', man));
      await Promise.all([s.ya(0), s.ya(s.n - 1)]);
      s.alCargar = () => { lz.sucio = true; pintar(); };
      seq = s; [8, 4, 2, 1].forEach(p => s.encolar(p)); pintar();
      return s.real;
    }
    let preparado = null;
    // I-2: no se descarga nada del timelapse hasta que faltan ~1 pantalla y media para llegar
    ScrollTrigger.create({ trigger: tlBox, start: 'top 250%', once: true, onEnter: async () => {
      preparado = preparar(await TZ.cargarManifest());
      if (!(await preparado)) {
        const reloj = setInterval(async () => { const m = await TZ.cargarManifest(); if (m) { clearInterval(reloj); preparar(m); } }, 20000);
      }
    }});
    ScrollTrigger.create({ trigger: tlBox, start: 'top top', end: 'bottom bottom', scrub: REDUCE ? false : .4,
      onUpdate: s => { prog = s.progress; if (barra) barra.style.transform = 'scaleX(' + prog.toFixed(4) + ')'; pintar(); } });
  }

  /* ---------- Cifras (contador 0 -> valor en 1,6 s al entrar) ---------- */
  const cifras = $('#cifras');
  function contar() {
    cifras.classList.add('on');
    $$('[data-to]', cifras).forEach((el, i) => {
      const to = +el.dataset.to;
      if (REDUCE || !window.gsap) { el.textContent = to; return; }
      const o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.6, delay: .15 * i, ease: 'power2.out', onUpdate: () => el.textContent = Math.round(o.v) });
    });
  }
  if (cifras) {
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); contar(); } }, { rootMargin: '0px 0px -30% 0px' });
    io.observe(cifras);
  }

  /* ---------- Cómo trabajamos: la línea de progreso avanza paso a paso ---------- */
  const pasos = $$('.paso .linea-prog');
  if (pasos.length && window.gsap && !REDUCE) {
    gsap.to(pasos, { scaleX: 1, duration: 1, stagger: .35, ease: 'power2.inOut',
      scrollTrigger: { trigger: '.pasos', start: 'top 75%', once: true } });
  } else pasos.forEach(p => p.style.transform = 'scaleX(1)');

  /* ---------- Contacto: solo front, sin envío real ---------- */
  const form = $('#form-contacto');
  /* I-7: cada campo obligatorio tiene su mensaje (<p class="error" id="e-…">, enlazado con aria-describedby).
     El grupo "Tipo de proyecto" se marca en el <fieldset>. Textos PENDIENTES de aprobación (ver contacto.html). */
  if (form) {
    const validar = el => {
      const radio = el.type === 'radio';
      const bad = radio ? !$$(`[name="${el.name}"]`, form).some(r => r.checked) : !el.checkValidity();
      const cont = radio ? el.closest('fieldset') : el;
      cont.setAttribute('aria-invalid', bad);
      const msg = $('#' + (cont.dataset.error || ''));
      if (msg) msg.hidden = !bad;
      return !bad;
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      const vistos = new Set(); let primero = null;
      $$('[required]', form).forEach(el => {
        const k = el.type === 'radio' ? el.name : el.id; if (vistos.has(k)) return; vistos.add(k);
        if (!validar(el) && !primero) primero = el;
      });
      if (primero) { primero.focus(); return; }
      form.classList.add('enviado');
      const g = $('.gracias', form); g.setAttribute('tabindex', '-1'); g.focus();
    });
    // Al corregir, el mensaje se quita
    $$('[required]', form).forEach(el => el.addEventListener(el.type === 'radio' ? 'change' : 'input', () => {
      const cont = el.type === 'radio' ? el.closest('fieldset') : el;
      if (cont.getAttribute('aria-invalid') === 'true') validar(el);
    }));
  }
})();
