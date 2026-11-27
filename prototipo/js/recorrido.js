/* =========================================================
   TRAZZO · Recorrido "Del trazo a la obra" (Home)
   Guion: diseno/guion-motion.md (los % se mantienen; 1 unidad de la línea de tiempo = 1 % del scroll)
   Capas (de abajo arriba):
     fondo   -> #papel (G6) + #papel-blanco + canvas #lienzo (V1, V2, V3, V4, hero 0-6,5 s)
     velos   -> #sombra, #luz, #velo (oliva 50/66 %), #lectura, #lateral
     (sin capa media: la mano G5 se quitó)
     superior-> SVG de svg/ (retícula, boceto, cotas, wireframe, contorno, contador, isologo, etiquetas)
   Requiere: GSAP 3.12.5 + ScrollTrigger + CustomEase, Lenis 1.1.13, js/secuencias.js
   ========================================================= */
(async function () {
  'use strict';
  const TZ = window.TZ;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  gsap.registerPlugin(ScrollTrigger, CustomEase);
  CustomEase.create('trazzo', '.22,.61,.36,1');

  /* ---------- 0. Fondo: secuencias y precarga por partes ---------- */
  const lienzo = new TZ.Lienzo($('#lienzo'));
  const NOMBRES = ['v1-render', 'v2-obra', 'v3-obra', 'v4-obra', 'hero'];
  let S = {};               // nombre -> Secuencia
  let mapas = {};           // nombre -> función u(0..1) -> índice fraccional
  let usandoReales = false;

  /* V1: la cámara se aleja entre 1,6 s y 3 s (defecto anotado por el supervisor).
     Con fotogramas reales se salta ese tramo y el salto se reparte en una mezcla larga. */
  const V1_SALTO = [1.6, 3.0];
  const HERO_MAX_S = 6.5;   // corte antes del logo viejo (6,67 s)

  function mapaLineal(n) { return u => u * (n - 1); }
  function mapaConSalto(seq, t0, t1) {
    const n = seq.n, fps = seq.fps || 24;
    const a = Math.round(t0 * fps), b = Math.round(t1 * fps);
    if (!(a > 0 && b < n - 1 && b > a)) return mapaLineal(n);
    // Índices que se usan: 0..a y b..n-1; el paso a->b ocupa el ancho de 8 fotogramas (mezcla)
    const PASO = 8, total = a + PASO + (n - 1 - b);
    return u => {
      const x = u * total;
      if (x <= a) return x;
      if (x <= a + PASO) { const t = (x - a) / PASO; return { a, b, t }; }
      return b + (x - a - PASO);
    };
  }

  async function prepararSecuencias(man) {
    const nuevas = {};
    NOMBRES.forEach(n => {
      const info = TZ.urlsDe(n, man);
      if (n === 'hero' && info.real && info.fps) info.urls = info.urls.slice(0, Math.floor(HERO_MAX_S * info.fps) + 1);
      nuevas[n] = new TZ.Secuencia(n, info);
    });
    usandoReales = NOMBRES.some(n => nuevas[n].real);
    // Primeros fotogramas al instante: inicio y final de cada tramo (los empalmes)
    await Promise.all(NOMBRES.flatMap(n => [nuevas[n].ya(0), nuevas[n].ya(nuevas[n].n - 1)]));
    S = nuevas;
    mapas = {};
    NOMBRES.forEach(n => {
      const s = S[n];
      // El manifest v1 de tecnico-secuencias ya excluye el tramo defectuoso de V1 (fundido de 6 fotogramas);
      // el salto en código solo se aplica si una secuencia real de V1 viene completa (sin "nota" de exclusión).
      const yaRecortado = s.real && man && /exclu/i.test(JSON.stringify((man.sequences || man.secuencias || {})['v1-render'] || ''));
      mapas[n] = (n === 'v1-render' && s.real && !yaRecortado) ? mapaConSalto(s, V1_SALTO[0], V1_SALTO[1]) : mapaLineal(s.n);
      s.alCargar = () => { lienzo.sucio = true; pintarFondo(ultimoP); };
    });
    encolados = {};
    ajustarOverlays();
    asegurarVentana(ultimoP);   // el resto, por ventana (capítulo actual + siguiente)
    pintarFondo(ultimoP);
    document.documentElement.dataset.fotogramas = usandoReales ? 'secuencias' : 'sustitutos';
  }

  function capasSeq(n, u, a) {
    const s = S[n]; if (!s) return [];
    const m = mapas[n](Math.max(0, Math.min(1, u)));
    if (typeof m === 'object') {           // tramo saltado: mezcla entre a y b
      const A = s.cercano(m.a), B = s.cercano(m.b);
      return [{ img: A, a }, { img: B, a: a * m.t }];
    }
    return lienzo.capasDe(s, m, a);
  }
  /* ---------- Precarga por ventana (I-2) ----------
     Capítulo actual + siguiente. Pasadas 8, 4, 2, 1 (con Save-Data / 2g / 3g, solo hasta 2: ver secuencias.js).
     01 -> V1 · 02 -> V1..V4 · 03 -> V2..V4 + hero · 04 -> hero */
  let encolados = {};
  const VENTANAS = [['v1-render'], ['v1-render', 'v2-obra', 'v3-obra', 'v4-obra'], ['v2-obra', 'v3-obra', 'v4-obra', 'hero'], ['hero']];
  function asegurarVentana(p) {
    if (!S.hero) return;
    const cap = Math.max(0, Math.min(3, Math.floor(p / 25)));
    const nuevos = VENTANAS[cap].filter(n => !encolados[n]);
    if (!nuevos.length) return;
    nuevos.forEach(n => encolados[n] = 1);
    [8, 4, 2, 1].forEach(paso => nuevos.forEach(n => S[n].encolar(paso)));
  }

  /* ---------- Overlays (wireframe y contorno) alineados con el recorte real del fotograma ----------
     Los SVG están dibujados sobre 1920x1080. Si la secuencia (p. ej. la móvil vertical) tiene otra proporción,
     se usa su "recorte" del manifest {x, y, width, height} en unidades 1920x1080; si no viene, un recorte centrado. */
  let VB = [0, 0, 1920, 1080];
  function ajustarOverlays() {
    // Los overlays van en el 02 y el 03: se alinean con el recorte de V1–V4 (el hero móvil tiene paneo, pero no lleva overlays)
    const s = S['v2-obra'] || S['v1-render']; if (!s) return;
    const r = s.recorte, ar = (s.w && s.h) ? s.w / s.h : 16 / 9;
    if (r && r.width) VB = [+r.x || 0, +r.y || 0, +r.width, +r.height];
    else if (Math.abs(ar - 16 / 9) < 0.02) VB = [0, 0, 1920, 1080];
    else if (ar < 16 / 9) { const w = 1080 * ar; VB = [(1920 - w) / 2, 0, w, 1080]; }
    else { const h = 1920 / ar; VB = [0, (1080 - h) / 2, 1920, h]; }
    $$('.ov svg').forEach(svg => svg.setAttribute('viewBox', VB.join(' ')));
    if (typeof grosores === 'function') grosores();
  }

  /* Tramos del canvas en % de la línea de tiempo */
  /* Los tramos van en % del recorrido. El boceto se queda en el primer fotograma
     hasta el 43 %: es el scroll de «Arquitectura de precisión». Después, los mismos tramos de antes. */
  const T = {
    v1: [43.4, 54.4],
    corte: [62.1, 63.6],
    v2: [63.6, 69.5], v3: [69.5, 75.4], v4: [75.4, 81.6], hero: [81.6, 97.8]
  };
  const u = (p, r) => (p - r[0]) / (r[1] - r[0]);
  let ultimoP = 0;
  function pintarFondo(p) {
    ultimoP = p;
    if (!S.hero) return;
    let capas;
    if (p < T.corte[0]) capas = capasSeq('v1-render', u(p, T.v1), 1);
    else if (p < T.corte[1]) {
      const t = u(p, T.corte);
      capas = capasSeq('v1-render', 1, 1).concat(capasSeq('v2-obra', 0, t));
    }
    else if (p < T.v2[1]) capas = capasSeq('v2-obra', u(p, T.v2), 1);
    else if (p < T.v3[1]) capas = capasSeq('v3-obra', u(p, T.v3), 1);
    else if (p < T.v4[1]) capas = capasSeq('v4-obra', u(p, T.v4), 1);
    else capas = capasSeq('hero', u(p, T.hero), 1);
    lienzo.poner(capas.filter(c => c.img));
  }

  /* ---------- 1. SVG de motion (copias de diseno/motion en svg/) ---------- */
  await Promise.all($$('[data-svg]').map(async box => {
    const txt = await fetch(TZ.url('prototipo/svg/' + box.dataset.svg)).then(r => r.text());
    box.innerHTML = txt.replace(/<\?xml[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '');
    const svg = box.querySelector('svg');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const t = svg.querySelector('title'); if (t) t.remove();
    if (box.hasAttribute('data-slice')) svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  }));
  const etSvg = $('#etiqueta svg');
  etSvg.setAttribute('viewBox', '0 0 320 28');
  $$('.etiqueta', etSvg).forEach(g => g.setAttribute('transform', 'translate(0,20)'));

  // Primer paint: fondo de sustitutos o secuencias (lo que haya)
  const manifest0 = await TZ.cargarManifest();
  const listaInicial = prepararSecuencias(manifest0);

  /* ---------- 2. Grosor de línea constante en pantalla ---------- */
  function grosores() {
    const lam = $('#lamina'), s = lam.clientWidth / 1659;
    const r = Math.max(innerWidth / VB[2], innerHeight / VB[3]);
    const st = document.documentElement.style;
    st.setProperty('--swb', (1.35 / s).toFixed(2));
    st.setProperty('--swc', (1 / s).toFixed(2));
    st.setProperty('--swr', (1.4 / r).toFixed(2));
  }
  grosores(); addEventListener('resize', grosores);

  /* ---------- 3. Preparar trazos ---------- */
  const prep = els => els.forEach(el => { el.setAttribute('pathLength', 1); el.style.strokeDasharray = '1 2'; el.style.strokeDashoffset = 1; });
  const bPaths = $$('#boceto-trazo path');
  const wGuias = $$('#wireframe .w-guia'), wLineas = $$('#wireframe .w-linea'), oLineas = $$('#o-contorno .o-linea');
  prep([...bPaths, ...$$('#cotas path'), ...wLineas, ...oLineas, ...$$('.iso-rev'), ...$$('.e-line'), $('.m2-line')]);
  gsap.set(wGuias, { opacity: 0 });
  gsap.set(['.c-txt', '.c-dot', '.w-dot', '.w-label', '.o-dot'], { opacity: 0 });
  gsap.set('.r-cruz', { opacity: 0 });

  /* Contador m2: 1.352 m² PENDIENTE DE CONFIRMAR (docs/PENDIENTES.md). Se muestra sin rótulo.
     El número sube una sola vez y se queda en 1.352 mientras el bloque está visible.
     No se ata al scrub: si no, al bajar y subir pasa por 0, 424, 878… y no termina fijo. */
  const m2 = $('#m2-valor'), cnt = { v: 0 };
  const fmt = n => Math.round(n).toLocaleString('es-VE');
  let conteo = null, m2Listo = false;
  function contarM2(mostrar) {
    if (!m2) return;
    if (!mostrar) {
      if (conteo) { conteo.kill(); conteo = null; }
      if (tl.progress() * 100 < 56) { cnt.v = 0; m2Listo = false; m2.textContent = ''; }
      return;
    }
    if (m2Listo || cnt.v >= 1352) { m2.textContent = fmt(1352); return; }
    if (conteo) return;
    if (REDUCE) { cnt.v = 1352; m2Listo = true; m2.textContent = fmt(1352); return; }
    conteo = gsap.to(cnt, {
      v: 1352, duration: 1.35, ease: 'power1.out',
      onUpdate: () => { m2.textContent = fmt(Math.max(1, cnt.v)); },
      onComplete: () => { cnt.v = 1352; m2Listo = true; m2.textContent = fmt(1352); conteo = null; }
    });
  }

  /* ---------- 4. Línea de tiempo maestra (100 unidades) ---------- */
  const tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true });
  const et = n => $('#et-0' + n), cap = n => $('.cap-title.c' + n);
  const textoIn = (n, at) => tl.fromTo(cap(n), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 4, ease: 'trazzo' }, at);
  const textoOut = (n, at) => tl.to(cap(n), { opacity: 0, y: -16, duration: 3, ease: 'power1.in' }, at);
  const etIn = (n, at) => { tl.to(et(n), { opacity: 1, duration: 1.5 }, at); tl.to($('.e-line', et(n)), { strokeDashoffset: 0, duration: 2, ease: 'trazzo' }, at); };
  const etOut = (n, at) => tl.to(et(n), { opacity: 0, duration: 1.5 }, at);

  // --- 00: la doble Z queda al centro. Con el texto sube. Las flechas se van al empezar el texto.
  gsap.set('#logo-portada', { xPercent: -50, yPercent: -50 });
  tl.to('#scroll-hint', { autoAlpha: 0, duration: 2.2, ease: 'power1.in' }, 5.5);
  const portadaMovil = matchMedia('(max-width:860px)').matches;
  tl.to('#logo-portada', {
    yPercent: portadaMovil ? -78 : -74,
    scale: portadaMovil ? 1 : 0.64,
    duration: 5, ease: 'power1.inOut'
  }, 7);
  tl.to('#logo-portada', { opacity: 0, duration: 4, ease: 'power1.in' }, 20);

  // El boceto entra y se queda quieto un scroll entero, con el título encima.
  tl.to('#papel-blanco', { opacity: 1, duration: 4, ease: 'power1.inOut' }, 20.5);
  tl.to('#lienzo', { opacity: 1, duration: 3 }, 22.5);
  textoIn(1, 26);
  tl.to('#sombra-titulo', { opacity: 1, duration: 4, ease: 'trazzo' }, 26);
  textoOut(1, 58);
  tl.to('#sombra-titulo', { opacity: 0, duration: 3, ease: 'power1.in' }, 58);

  // --- 02 RENDER: lo que iba en 24–99 se corre 36 unidades para dejar ese scroll. ---
  const SFT = 36;
  tl.to('#velo', { opacity: .66, duration: 7 }, 24 + SFT);
  etOut(1, 24 + SFT); etIn(2, 25 + SFT);
  tl.to(wGuias, { opacity: 1, duration: 2, stagger: .4 }, 30 + SFT);
  tl.to(wLineas, { strokeDashoffset: 0, duration: 2.2, stagger: (8 - 2.2) / (wLineas.length - 1), ease: 'power1.inOut' }, 31 + SFT);
  tl.to('.w-dot', { opacity: 1, duration: .8, stagger: .2 }, 37.5 + SFT);
  tl.to('.w-label', { opacity: 1, duration: 1.5 }, 38.5 + SFT);
  textoIn(2, 29.5 + SFT);
  tl.to('.w-label, .w-dot', { opacity: 0, duration: 2 }, 42 + SFT);
  tl.to(wLineas, { strokeDashoffset: -1, duration: 2.5, stagger: .25, ease: 'power1.in' }, 42.5 + SFT);
  tl.to(wGuias, { opacity: 0, duration: 3 }, 43 + SFT);
  textoOut(2, 46 + SFT);

  tl.to('#velo', { opacity: .9, duration: 1.8, ease: 'power1.in' }, 47 + SFT);
  tl.to('#velo', { opacity: .66, duration: 2.2, ease: 'power1.out' }, 50.2 + SFT);

  etOut(2, 49 + SFT); etIn(3, 50 + SFT);
  tl.to(oLineas, { strokeDashoffset: 0, duration: 4, stagger: 1.2, ease: 'power1.inOut' }, 51 + SFT);
  tl.to('.o-dot', { opacity: 1, duration: .6, stagger: .2 }, 56.5 + SFT);
  textoIn(3, 53 + SFT);
  tl.to('#m2-box', { opacity: 1, duration: 1.2 }, 56 + SFT);
  tl.to('.m2-line', { strokeDashoffset: 0, duration: 4, ease: 'trazzo' }, 56.4 + SFT);
  tl.to('#o-clip-rect', { attr: { y: 250 }, duration: 12, ease: 'power1.inOut' }, 58 + SFT);
  tl.to('#velo', { opacity: .5, duration: 12 }, 58 + SFT);
  tl.to(['#o-contorno', '#o-relleno', '#o-anclajes'], { opacity: 0, duration: 3 }, 71 + SFT);
  tl.to('#m2-box', { opacity: 0, duration: 3 }, 71.5 + SFT);
  textoOut(3, 72 + SFT);

  etOut(3, 74 + SFT); etIn(4, 75 + SFT);
  tl.to('#velo', { opacity: 0, duration: 5 }, 75 + SFT);
  tl.to(['#lateral', '#pie'], { opacity: 1, duration: 4 }, 76 + SFT);
  tl.fromTo('#sombra', { opacity: 0 }, { opacity: .38, duration: 2 }, 77 + SFT);
  tl.to('#sombra', { opacity: 0, duration: 6, ease: 'power1.inOut' }, 79 + SFT);
  tl.to('#luz', { opacity: .55, duration: 6, ease: 'power1.inOut' }, 79 + SFT);
  ['#iz-4', '#iz-3', '#iz-2', '#iz-1', '#de-1', '#de-2', '#de-3', '#de-4'].forEach((id, i) =>
    tl.to('#m-' + id.slice(1) + ' .iso-rev', { strokeDashoffset: 0, duration: 1.6, ease: 'trazzo' }, 84 + SFT + i * .7));
  tl.to('.mz-1', { strokeDashoffset: 0, duration: 1.2, ease: 'power1.in' }, 90.2 + SFT);
  tl.to('.mz-2', { strokeDashoffset: 0, duration: 1.8 }, 91.2 + SFT);
  tl.to('.mz-3', { strokeDashoffset: 0, duration: 1.2, ease: 'power1.out' }, 92.8 + SFT);
  textoIn(4, 91 + SFT);
  tl.to({}, { duration: 1 }, 99 + SFT);

  /* ---------- 5. (La mano G5 se quitó el 18/11/2026 a pedido de Rogger) ---------- */

  /* ---------- 6. Indicadores fijos ---------- */
  const pCap = $('#p-cap'), pBar = $('#p-bar'), desl = $('#desliza'), lienzoEl = $('#lienzo');
  function indicadores(p) {
    const t = p * tl.duration();
    const n = t < 25 ? 0 : t < 62 ? 1 : t < 86 ? 2 : t < 111 ? 3 : 4;
    pCap.textContent = String(n).padStart(2, '0');
    pBar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (desl) desl.style.opacity = 0;
  }
  function alActualizar() {
    const p = tl.progress() * 100;
    pintarFondo(p);
    asegurarVentana(p);
    lienzoEl.classList.toggle('normal', p > 51);   // multiply solo mientras el boceto está sobre el papel
    // El contador entra en el 03 y se queda en 1.352 hasta que esa escena se va.
    contarM2(p >= 67.6 && p < 79);
  }
  tl.eventCallback('onUpdate', alActualizar);

  /* ---------- 7. Scroll: Lenis + ScrollTrigger ---------- */
  const lenis = window.lenis = new Lenis({ lerp: .1, smoothWheel: !REDUCE });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  if (!REDUCE) {
    ScrollTrigger.create({ trigger: '#recorrido', start: 'top top', end: 'bottom bottom', scrub: .6, animation: tl, onUpdate: s => indicadores(s.progress) });
  } else {
    const fin = [.12, .32, .55, .92];
    ScrollTrigger.create({ trigger: '#recorrido', start: 'top top', end: 'bottom bottom',
      onUpdate: s => { const c = Math.min(3, Math.floor(s.progress * 4)); tl.progress(fin[c]); indicadores(s.progress); } });
    tl.progress(fin[0]);
  }
  indicadores(0);
  alActualizar();

  /* Intro al cargar: la piedra y la doble Z se quedan hasta que termina el barrido. */
  TZ.recorrido = { tl, S: () => S, reales: () => usandoReales };
  if (!REDUCE) lenis.stop();
  await Promise.all([
    Promise.race([listaInicial, new Promise(r => setTimeout(r, 3000))]),
    new Promise(r => setTimeout(r, REDUCE ? 0 : 2400))
  ]);
  if (!REDUCE) lenis.start();
  TZ.quitarLoader && TZ.quitarLoader();

  /* ---------- 8. Si aún no hay manifest, se revisa cada 20 s ---------- */
  if (!usandoReales) {
    const reloj = setInterval(async () => {
      const man = await TZ.cargarManifest();
      if (man) { clearInterval(reloj); await prepararSecuencias(man); }
    }, 20000);
  }

  addEventListener('load', () => ScrollTrigger.refresh());
})();
