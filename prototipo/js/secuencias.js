/* =========================================================
   TRAZZO · Motor de secuencias de fotogramas (canvas)
   - Lee frames/manifest.json (lo escribe tecnico-secuencias). Si no existe todavía,
     usa fotogramas fijos de sustituto (img/fallback/*.webp) y vuelve a mirar cada 20 s.
   - Precarga por partes: primero el fotograma inicial y final de cada tramo (al instante),
     después el resto en segundo plano por orden de aparición, 4 a la vez.
   - Móvil (<=860 px): carpeta mobile/ de cada secuencia; el canvas recorta en "cover".
   En WordPress: tema-trazzo/assets/js/secuencias.js
   ========================================================= */
(function () {
  'use strict';
  const TZ = window.TZ = window.TZ || {};
  /* Base única de rutas (I-10). Prototipo: <html data-base="../"> (raíz del proyecto).
     En WordPress: window.TRAZZO_BASE = get_template_directory_uri() + "/" (wp_localize_script / wp_add_inline_script). */
  const BASE = String(window.TRAZZO_BASE || document.documentElement.dataset.base || '../').replace(/\/?$/, '/');
  TZ.base = BASE;
  TZ.url = p => BASE + String(p).replace(/^\.?\//, '');
  const RAIZ = BASE;
  TZ.movil = matchMedia('(max-width:860px)').matches;
  /* Save-Data o red 2g/3g: se carga 1 de cada 2 fotogramas (I-2) */
  TZ.lentoRed = !!(navigator.connection && (navigator.connection.saveData || /(^|-)(2g|3g)$/.test(navigator.connection.effectiveType || '')));
  TZ.pasoMin = TZ.lentoRed ? 2 : 1;

  /* ---------- Sustitutos mientras no exista el manifest ---------- */
  const FB = TZ.url('prototipo/img/fallback/');
  const SUSTITUTOS = {
    'v1-render': [FB + 'v1-ini.webp', FB + 'render.webp'],
    'v2-obra':   [FB + 'v2-ini.webp', FB + 'v3-ini.webp'],
    'v3-obra':   [FB + 'v3-ini.webp', FB + 'v4-ini.webp'],
    'v4-obra':   [FB + 'v4-ini.webp', FB + 'render.webp'],
    'hero':      [FB + 'render.webp', FB + 'hero-fin.webp'],
    'dianoche':  [TZ.url('assets/_web/dia-noche/fachada-frontal-dia.jpg'), TZ.url('assets/_web/dia-noche/fachada-frontal-noche.jpg')]
  };
  /* Nombres alternativos con los que puede venir cada secuencia en el manifest */
  const ALIAS = {
    'v1-render': ['v1-render', 'v1', 'v1-boceto-render'],
    'v2-obra':   ['v2-obra', 'v2', 'v2-terreno-estructura'],
    'v3-obra':   ['v3-obra', 'v3', 'v3-estructura-casi-lista'],
    'v4-obra':   ['v4-obra', 'v4', 'v4-casi-lista-render'],
    'hero':      ['hero', 'hero-1080', 'fondo'],
    'dianoche':  ['dianoche', 'dia-noche', 'timelapse', 'timelapse-dia-noche']
  };

  /* ---------- Manifest: se acepta más de una forma (lo define tecnico-secuencias) ---------- */
  let manifestCache;
  TZ.cargarManifest = async function () {
    try {
      const r = await fetch(RAIZ + 'frames/manifest.json', { cache: 'no-cache' });
      if (!r.ok) return null;
      manifestCache = await r.json();
      return manifestCache;
    } catch (e) { return null; }
  };

  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function listaDesde(def, nombre, movil) {
    if (!def) return null;
    let d = def;
    const sub = def.mobile || def.movil;
    if (movil && sub && typeof sub === 'object' && !Array.isArray(sub)) d = Object.assign({}, def, sub);
    let dir = d.dir || d.carpeta || d.folder || d.path || d.ruta || nombre;
    dir = String(dir).replace(/^\.?\/?frames\//, '').replace(/\/$/, '');
    if (movil) {
      if (Array.isArray(sub)) return sub.map(f => /\//.test(f) ? RAIZ + 'frames/' + f.replace(/^\.?\/?frames\//, '') : RAIZ + 'frames/' + dir + '/mobile/' + f);
      if (!(sub && typeof sub === 'object' && (sub.dir || sub.carpeta || sub.folder || sub.path || sub.ruta))) dir += '/mobile';
    }
    const base = RAIZ + 'frames/' + dir + '/';
    const files = Array.isArray(d.frames) ? d.frames : Array.isArray(d.files) ? d.files : Array.isArray(d.archivos) ? d.archivos : null;
    if (files) return files.map(f => /\//.test(f) ? RAIZ + 'frames/' + f.replace(/^\.?\/?frames\//, '') : base + f);
    const n = +(d.count || d.total || d.cantidad || d.fotogramas || (typeof d.frames === 'number' ? d.frames : 0));
    if (!n) return null;
    const ini = +(d.start != null ? d.start : d.inicio != null ? d.inicio : 1);
    let pat = d.pattern || d.patron || d.plantilla || null;
    const ext = (d.ext || d.extension || 'webp').replace(/^\./, '');
    const w = +(d.pad || d.digitos || 4);
    const out = [];
    for (let i = 0; i < n; i++) {
      const k = i + ini;
      let f;
      if (pat) f = pat.replace(/%0?(\d*)d/, (m, ww) => pad(k, +ww || 1)).replace(/\{n+\}|\{i\}|#+/, m => pad(k, m[0] === '#' ? m.length : (m.length - 2 > 1 ? m.length - 2 : w)));
      else f = pad(k, w) + '.' + ext;
      out.push(base + f);
    }
    return out;
  }
  function buscarDef(man, nombre) {
    if (!man) return null;
    const pool = man.secuencias || man.sequences || man.seq || man;
    const nombres = ALIAS[nombre] || [nombre];
    if (Array.isArray(pool)) return pool.find(s => nombres.includes(s.nombre || s.name || s.id || s.slug)) || null;
    for (const k of nombres) if (pool[k]) return Object.assign({ _clave: k }, pool[k]);
    return null;
  }
  /* Devuelve {urls, fps, real:true|false} */
  TZ.urlsDe = function (nombre, man) {
    let def = buscarDef(man, nombre), movilSub = TZ.movil;
    // Forma de tecnico-secuencias (manifest v1): {fps, desktop:{frames, path, pattern}, mobile:{...}}
    if (def && (def.desktop || def.mobile)) {
      const sub = (TZ.movil && def.mobile) ? def.mobile : (def.desktop || def.mobile);
      // Recorte móvil (manifest v1): texto "608x1080 desde x=330 ..." -> {x, y, width, height} en unidades de la fuente 1920x1080
      let recorte = sub.recorte || sub.crop || null;
      const txt = TZ.movil && def.mobile ? (def.recorte_mobile || def.recorte_movil || '') : '';
      const m = /(\d+)\s*x\s*(\d+)[^\d]*x\s*=\s*(\d+)/.exec(txt);
      if (!recorte && m) recorte = { x: +m[3], y: 0, width: +m[1], height: +m[2] };
      def = Object.assign({ _clave: def._clave, fps: def.fps, recorte }, sub); movilSub = false;
    }
    let urls = def && listaDesde(def, def._clave || nombre, movilSub);
    if (urls && urls.length) {
      const fps = +(def.fps || (man && man.fps) || 24);
      // Medidas del manifest (las secuencias móviles pueden ser verticales: no se supone 16:9)
      const w = +(def.width || def.ancho || 0), h = +(def.height || def.alto || 0);
      return { urls, fps, real: true, def, w, h, recorte: def.recorte || def.crop || null };
    }
    return { urls: (SUSTITUTOS[nombre] || []).slice(), fps: 0, real: false };
  };

  /* ---------- Cola de carga en segundo plano ---------- */
  const cola = []; let activos = 0; const MAX = TZ.lentoRed ? 2 : 4;
  function bombear() {
    while (activos < MAX && cola.length) {
      const job = cola.shift();
      if (job.s.estado[job.i]) continue;
      activos++;
      job.s._cargar(job.i).finally(() => { activos--; bombear(); });
    }
  }

  class Secuencia {
    constructor(nombre, info) {
      this.nombre = nombre; this.urls = info.urls; this.real = info.real; this.fps = info.fps;
      this.w = info.w || 0; this.h = info.h || 0; this.recorte = info.recorte || null;
      this.paso = this.real ? TZ.pasoMin : 1;   // con Save-Data o 2g/3g solo se usan los fotogramas pares
      this.n = this.urls.length; this.imgs = new Array(this.n); this.estado = new Uint8Array(this.n); // 0 nada, 1 cargando, 2 listo, 3 error
      this.cargados = 0; this.alCargar = null;
    }
    _cargar(i) {
      if (this.estado[i]) return Promise.resolve();
      this.estado[i] = 1;
      const img = new Image(); img.decoding = 'async';
      // onload (no decode(): en pestañas ocultas decode() puede quedar en espera); la decodificación se adelanta aparte
      const p = new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; });
      img.src = this.urls[i];
      p.then(() => { if (img.decode) img.decode().catch(() => {}); }, () => {});
      return p.then(() => { this.imgs[i] = img; this.estado[i] = 2; this.cargados++; this.alCargar && this.alCargar(i); },
                    () => { this.estado[i] = 3; });
    }
    /* Carga inmediata (sin cola) */
    ya(i) { return this._cargar(Math.max(0, Math.min(this.n - 1, i))); }
    /* Encola los fotogramas múltiplos de "paso" (pasadas gruesas primero: 8, 4, 2, 1):
       el scroll tiene siempre un fotograma cercano aunque no haya terminado la carga */
    encolar(paso, prioridad) {
      paso = Math.max(paso || 1, this.paso); const jobs = [];
      for (let i = 0; i < this.n; i += paso) if (!this.estado[i]) jobs.push({ s: this, i });
      if (prioridad) cola.unshift(...jobs); else cola.push(...jobs);
      bombear();
    }
    /* Pide ya un fotograma que el scroll necesita (si no está listo ni cargando) */
    pedir(i) { i = Math.max(0, Math.min(this.n - 1, Math.round(i / this.paso) * this.paso)); if (!this.estado[i]) this._cargar(i); }
    /* Fotograma listo más cercano a i */
    cercano(i) {
      i = Math.max(0, Math.min(this.n - 1, Math.round(i)));
      if (this.estado[i] === 2) return this.imgs[i];
      for (let d = 1; d < this.n; d++) {
        if (i - d >= 0 && this.estado[i - d] === 2) return this.imgs[i - d];
        if (i + d < this.n && this.estado[i + d] === 2) return this.imgs[i + d];
      }
      return null;
    }
    listo(i) { return this.estado[i] === 2 ? this.imgs[i] : null; }
  }
  TZ.Secuencia = Secuencia;

  /* ---------- Pintor de canvas (cover + mezcla entre fotogramas) ---------- */
  class Lienzo {
    constructor(canvas, foco) {
      this.c = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.foco = foco || [0.5, 0.5];
      this.dpr = 1; this.w = 0; this.h = 0; this.medir(); this.capas = []; this.pintar();
      addEventListener('resize', () => { this.medir(); this.sucio = true; this.pedir(); });
      this.capas = []; this.sucio = true; this._raf = 0;
    }
    medir() {
      const r = this.c.getBoundingClientRect();
      // Tope de resolución: el canvas no necesita más píxeles que los fotogramas (1600 px escritorio)
      this.dpr = Math.min(window.devicePixelRatio || 1, TZ.movil ? 2 : 1.5);
      const w = Math.round(r.width * this.dpr), h = Math.round(r.height * this.dpr);
      if (w && h && (w !== this.c.width || h !== this.c.height)) { this.c.width = w; this.c.height = h; }
      this.w = this.c.width; this.h = this.c.height;
    }
    /* capas: [{img, a}] se pintan en orden */
    poner(capas) {
      const k = capas.map(c => (c.img ? c.img.src : '') + '|' + c.a.toFixed(3)).join(',');
      if (k === this._k && !this.sucio) return;
      this._k = k; this.capas = capas; this.pedir();
    }
    pedir() { if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.pintar(); }); }
    pintar() {
      const { ctx, w, h } = this; this.sucio = false;
      if (!w || !h) return;
      // Fondo de reserva blanco cálido (en multiply no cambia el papel; nunca queda negro si faltan fotogramas)
      if (!this.capas.some(c => c.img && c.a > 0)) { ctx.globalAlpha = 1; ctx.fillStyle = '#FFF8EF'; ctx.fillRect(0, 0, w, h); return; }
      let primero = true;
      for (const c of this.capas) {
        if (!c.img || c.a <= 0) continue;
        const iw = c.img.naturalWidth, ih = c.img.naturalHeight;
        const s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
        const dx = (w - dw) * this.foco[0], dy = (h - dh) * this.foco[1];
        ctx.globalAlpha = primero ? 1 : Math.min(1, c.a);
        ctx.drawImage(c.img, dx, dy, dw, dh);
        primero = false;
      }
      ctx.globalAlpha = 1;
    }
    /* Pinta la posición f (fraccional) de una secuencia: mezcla floor/ceil si ambos están listos */
    capasDe(seq, f, a) {
      a = a == null ? 1 : a;
      if (!seq || !seq.n) return [];
      f = Math.max(0, Math.min(seq.n - 1, f));
      const st = seq.paso || 1, i0 = Math.floor(f / st) * st, i1 = Math.min(seq.n - 1, i0 + st), t = (f - i0) / st;
      const A = seq.listo(i0), B = seq.listo(i1);
      if (!A) seq.pedir(i0);
      if (A && B && t > 0.001 && i1 !== i0) return [{ img: A, a }, { img: B, a: a * t }];
      const C = seq.cercano(f);
      return C ? [{ img: C, a }] : [];
    }
  }
  TZ.Lienzo = Lienzo;
})();
