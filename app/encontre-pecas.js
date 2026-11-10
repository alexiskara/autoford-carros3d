/* Landing "Encontre peças" — Autoford / Variados.
 * Animações: Motion (revelar ao rolar, magnético, FAQ) + anime.js (contadores, stagger, partículas, filtro).
 * Fundo de linhas fluidas inspirado no "Background Paths" do Kokonut UI (MIT, kokonutui.com), reescrito em JS puro. */
/* Configuração da loja (loja.config.json ao lado deste script, ou window.APC_CONFIG: objeto ou endereço do .json) */
async function carregarConfig() {
  let c = window.APC_CONFIG, url = new URL('./loja.config.json', import.meta.url).href;
  try {
    if (typeof c === 'string') { url = new URL(c, location.href).href; c = await (await fetch(url)).json(); }
    else if (!c) { const r = await fetch(url); c = r.ok ? await r.json() : {}; }
  } catch (e) { c = {}; }
  c = c || {};
  return { url: url, cfg: Object.assign({ base: '', catalogo: '', veiculos: 'cars.json', carrosVisiveis: null }, c, { loja: Object.assign({ nome: '', pagina3d: '/3d-carros/' }, c.loja || {}) }) };
}
const { url: CFG_URL, cfg: CFG } = await carregarConfig();
const relCfg = (u) => (u ? new URL(u, CFG_URL).href : '');
const BASE = (typeof window.EP_BASE === 'string') ? window.EP_BASE : (CFG.base ? relCfg(CFG.base).replace(/\/$/, '') : 'https://cdn.jsdelivr.net/gh/alexiskara/autoford-carros3d@303be88198918db7d067f38803c188f3d0642c7d');
const VISUALIZADOR = CFG.loja.pagina3d || '/3d-carros/';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const raiz = $('#ep');
if (!raiz) throw new Error('landing ausente');
const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;

let A = null, M = null;
try { A = await import('https://cdn.jsdelivr.net/npm/animejs@4.5.0/dist/bundles/anime.esm.min.js'); } catch (e) { A = null; }
try { M = await import('https://cdn.jsdelivr.net/npm/motion@12.43.0/+esm'); } catch (e) { M = null; }

/* ---------- visualizador 3D embutido (carregado sob demanda) ---------- */
const URL_VIEWER = new URL('./pagina.js', import.meta.url).href;
let viewerP = null;
function carregarViewer() {
  if (viewerP) return viewerP;
  viewerP = import(URL_VIEWER).then(() => new Promise((ok) => { if (window.__c3dAbrir) ok(); else window.addEventListener('c3d:pronto', () => ok(), { once: true }); })).catch((e) => { viewerP = null; throw e; });
  return viewerP;
}
function rolarAoViewer() { const s = $('#visualizador'); if (s) s.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' }); }
async function abrirNoViewer(d, rolar = true) {
  if (rolar) rolarAoViewer();
  try {
    await carregarViewer(); window.__c3dAbrir(d || {});
    if (rolar && d && (d.carro || d.parte)) setTimeout(() => { const p = $('#c3d-palco'); if (p) p.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'center' }); }, 450);
  } catch (e) { location.href = '/3d-carros/' + (d && d.carro ? '?carro=' + d.carro : ''); }
}

function track(nome, dados) {
  try {
    const d = Object.assign({ event: nome }, dados || {});
    (window.dataLayer = window.dataLayer || []).push(d);
    if (typeof window.gtag === 'function') window.gtag('event', nome, dados || {});
  } catch (e) {}
}
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (t) => semAcento(t).toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---------- dados ---------- */
let carros = [];
const carregarJSON = async (u) => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch (e) { return null; } };
{
  const c3d = await carregarJSON(BASE + '/' + (CFG.veiculos || 'cars.json'));
  const cat = CFG.catalogo ? await carregarJSON(relCfg(CFG.catalogo)) : null;
  const m3d = new Map(((c3d && c3d.cars) || []).map((c) => [c.id, c]));
  const lista = [];
  ((cat && cat.veiculos) || []).forEach((v) => { const b = m3d.get(v.id) || {}; lista.push(Object.assign({}, b, { id: v.id, brand: v.marca || b.brand, model: v.modelo || b.model, category: v.categoria || b.category || '', imagem: v.imagem || '', file: v.arquivo3d || b.file || '' })); m3d.delete(v.id); });
  m3d.forEach((b) => lista.push(b));
  carros = lista.filter((c) => c.brand && c.model);
  if (Array.isArray(CFG.carrosVisiveis) && CFG.carrosVisiveis.length) { const f = carros.filter((c) => CFG.carrosVisiveis.includes(c.id)); if (f.length) carros = f; }
}
const nomeCarro = (c) => c.brand + ' ' + c.model;
const TIPO = { hatch: 'Hatch', suv: 'SUV', pickup: 'Picape' };

/* ---------- marcas (marquee) ---------- */
{
  const cont = {}; carros.forEach((c) => { cont[c.brand] = (cont[c.brand] || 0) + 1; });
  const itens = Object.keys(cont).sort().map((b) => '<span>' + b + ' <small>' + cont[b] + (cont[b] > 1 ? ' modelos' : ' modelo') + '</small></span>').join('');
  $('#ep-marq').innerHTML = itens + itens;
}

/* ---------- busca ---------- */
{
  $('#ep-lista-carros').innerHTML = carros.map((c) => '<option value="' + nomeCarro(c) + '">').join('');
  const abrir = (c, ano) => abrirNoViewer({ carro: c ? c.id : undefined, ano: ano || undefined });
  $('#ep-busca').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const txt = $('#ep-q').value.trim();
    const am = txt.match(/\b(?:19|20)\d{2}\b/), q = norm(txt.replace(/\b(?:19|20)\d{2}\b/, ''));
    const c = q ? carros.find((x) => norm(nomeCarro(x)).includes(q) || q.includes(norm(x.model))) : null;
    explodir($('#ep-go'));
    setTimeout(() => abrir(c, am ? am[0] : ''), reduz ? 0 : 200);
  });
}

/* ---------- partes ---------- */
const PARTES = [
  ['capo', 'Capô', 'Frente do carro, sobre o motor'], ['parachoque-d', 'Para-choque dianteiro', 'Proteção e acabamento da frente'], ['farol', 'Faróis', 'Iluminação dianteira'],
  ['parabrisa', 'Parabrisa', 'Vidro dianteiro'], ['teto', 'Teto', 'Cobertura e acabamentos'], ['portas', 'Portas', 'Dianteiras e traseiras'],
  ['retrovisor', 'Retrovisores', 'Espelhos laterais'], ['rodas', 'Rodas', 'Aros, calotas e rodas'], ['portamalas', 'Porta-malas', 'Tampa traseira'],
  ['lanterna', 'Lanternas', 'Iluminação traseira'], ['parachoque-t', 'Para-choque traseiro', 'Proteção e acabamento de trás']
];
$('#ep-partes').innerHTML = PARTES.map((p, i) => '<a class="ep-pc" data-rv data-parte="' + p[0] + '" href="' + VISUALIZADOR + '?parte=' + p[0] + '"><span>' + String(i + 1).padStart(2, '0') + '</span><b>' + p[1] + '</b><small>' + p[2] + '</small><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg></a>').join('');

/* ---------- modelos ---------- */
function montarGrade(filtro) {
  const lista = carros.filter((c) => filtro === 'todos' || c.category === filtro);
  $('#ep-grade').innerHTML = lista.map((c) => '<a class="ep-mc" data-carro="' + c.id + '" href="' + VISUALIZADOR + '?carro=' + c.id + '"><img loading="lazy" alt="' + nomeCarro(c) + '" src="' + (c.imagem || (BASE + '/posters/poster-' + c.id + '.webp')) + '" onerror="this.onerror=null;this.src=\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 240 140%22%3E%3Crect width=%22240%22 height=%22140%22 fill=%22%23101a30%22/%3E%3Cpath d=%22M40 92l14-34h132l14 34v22H40z%22 fill=%22none%22 stroke=%22%236f86c8%22 stroke-width=%223%22/%3E%3Ccircle cx=%2282%22 cy=%22116%22 r=%2212%22 fill=%22%236f86c8%22/%3E%3Ccircle cx=%22158%22 cy=%22116%22 r=%2212%22 fill=%22%236f86c8%22/%3E%3C/svg%3E\'"><div><span><small>' + c.brand + '</small><b>' + c.model + '</b></span><em>Abrir 3D →</em></div></a>').join('');
  const cards = $$('.ep-mc');
  if (A && !reduz) A.animate(cards, { opacity: [0, 1], translateY: [24, 0], scale: [0.96, 1], delay: A.stagger(45), duration: 650, ease: 'outExpo' });
  cards.forEach(inclinar);
}
function inclinar(el) {
  if (reduz || !matchMedia('(hover:hover)').matches) return;
  el.addEventListener('pointermove', (ev) => { const r = el.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5; el.style.transform = 'perspective(800px) rotateX(' + (-y * 8).toFixed(2) + 'deg) rotateY(' + (x * 10).toFixed(2) + 'deg) translateZ(0)'; });
  el.addEventListener('pointerleave', () => { el.style.transform = ''; });
}
{
  const tipos = ['todos', ...new Set(carros.map((c) => c.category))];
  const fil = $('#ep-filtro');
  fil.innerHTML = tipos.map((t, i) => '<button type="button" data-t="' + t + '" aria-pressed="' + (i === 0) + '">' + (t === 'todos' ? 'Todos' : (TIPO[t] || t) + 's') + '</button>').join('');
  fil.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; $$('button', fil).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); montarGrade(b.dataset.t); });
  montarGrade('todos');
}

/* ---------- cores ---------- */
{
  const CORES = [['Branco', '#e8e8e4'], ['Prata', '#8f98a3'], ['Preto', '#15161a'], ['Vermelho', '#d1102a'], ['Azul', '#1d3fd1'], ['Verde', '#0b7a3a'], ['Amarelo', '#f0b400']];
  const box = $('#ep-cores');
  box.innerHTML = CORES.map((c) => '<button type="button" aria-label="Cor ' + c[0] + '" style="background:' + c[1] + '" data-c="' + c[1] + '"></button>').join('');
  box.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; const alvo = $('#ep-sil'); if (A && !reduz) A.animate(alvo, { color: b.dataset.c, duration: 700, ease: 'outQuart' }); else alvo.style.color = b.dataset.c; });
}
{ const im = $('#ep-b-img'); const c = carros.find((x) => x.id === 'chevrolet-onix') || carros[0]; if (im && c) im.src = BASE + '/posters/poster-' + c.id + '.webp'; }

/* ---------- WhatsApp da loja ---------- */
{
  const h = $$('a[href]').map((x) => x.getAttribute('href') || '').find((u) => /wa\.me\/\d+|whatsapp\.com\/send\/?\?phone=\d+/.test(u));
  const m = h && h.match(/(\d{10,15})/);
  if (m) { const a = $('#ep-zap'); a.href = 'https://wa.me/' + m[1] + '?text=' + encodeURIComponent('Olá! Vim pela página de peças e preciso de ajuda para achar uma peça.'); a.hidden = false; }
}

/* ---------- carro 3D do hero ---------- */
{
  const alvo = $('#ep-car');
  const montar = async () => {
    const c = carros.find((x) => x.id === 'jeep-compass') || carros[0]; if (!c) return;
    await customElements.whenDefined('model-viewer').catch(() => {});
    const mv = document.createElement('model-viewer');
    mv.setAttribute('camera-controls', ''); mv.setAttribute('auto-rotate', ''); mv.setAttribute('auto-rotate-delay', '0'); mv.setAttribute('rotation-per-second', '18deg');
    mv.setAttribute('interaction-prompt', 'none'); mv.setAttribute('disable-zoom', ''); mv.setAttribute('shadow-intensity', '1.2'); mv.setAttribute('shadow-softness', '1');
    mv.setAttribute('exposure', '1.1'); mv.setAttribute('environment-image', 'neutral'); mv.setAttribute('camera-orbit', '35deg 76deg 118%'); mv.setAttribute('touch-action', 'pan-y');
    mv.setAttribute('alt', 'Carro em 3D que gira sozinho'); mv.setAttribute('reveal', 'auto');
    try { customElements.get('model-viewer').meshoptDecoderLocation = 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/meshopt_decoder.js'; } catch (e) {}
    mv.poster = BASE + '/posters/poster-' + c.id + '.webp'; mv.src = BASE + '/assets/' + c.file;
    alvo.prepend(mv);
    mv.addEventListener('load', () => {
      try {
        const cen = mv.getBoundingBoxCenter(), dim = mv.getDimensions();
        /* posicoes medidas na superficie do modelo (raio a partir da tela), em fracao do tamanho do carro; recuadas 4 cm para fora da lataria */
        const ponto = (nome, fx, fy, fz, n, rotulo, parte) => {
          const b = document.createElement('button'); b.type = 'button'; b.slot = 'hotspot-' + nome; b.className = 'ep-hs'; b.dataset.parte = parte;
          const x = cen.x + fx * dim.x + n[0] * 0.04, y = cen.y + fy * dim.y + n[1] * 0.04, z = cen.z + fz * dim.z + n[2] * 0.04;
          b.setAttribute('data-position', x + 'm ' + y + 'm ' + z + 'm'); b.setAttribute('data-normal', n.join(' '));
          b.innerHTML = '<i></i>' + rotulo; mv.appendChild(b);
        };
        ponto('capo', 0, 0.135, 0.294, [0, 1, 0.1], 'Capô', 'capo');
        ponto('farol', 0.349, 0.003, 0.428, [0.76, 0.32, 0.57], 'Faróis', 'farol');
        ponto('roda', 0.416, -0.274, 0.287, [1, 0, 0.3], 'Rodas', 'rodas');
        /* visibilidade pelo angulo: o hotspot so aparece quando a superficie dele esta voltada para a camera (o model-viewer nao marca isso aqui) */
        const hs = [...mv.querySelectorAll('.ep-hs')];
        const normais = hs.map((h) => (h.getAttribute('data-normal') || '0 1 0').split(' ').map(Number));
        const atualiza = () => {
          const o = mv.getCameraOrbit(), th = o.theta - (mv.turntableRotation || 0), sp = Math.sin(o.phi), dx = Math.sin(th) * sp, dy = Math.cos(o.phi), dz = Math.cos(th) * sp;
          hs.forEach((h, i) => { const n = normais[i], d = (n[0] * dx + n[1] * dy + n[2] * dz) / (Math.hypot(n[0], n[1], n[2]) || 1); h.toggleAttribute('data-visible', d > 0.28); });
        };
        mv.addEventListener('camera-change', atualiza); atualiza();
      } catch (e) {}
    }, { once: true });
  };
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); montar(); } }, { rootMargin: '200px' }); io.observe(alvo); } else montar();
}

/* ---------- fundo de linhas fluidas ---------- */
function linhas() {
  const cv = $('#ep-paths'); if (!cv) return; const ctx = cv.getContext('2d'); if (!ctx) return;
  const CAMADAS = [{ w: 1, o: 0.16, f: 0.6, v: 0.7 }, { w: 1.25, o: 0.26, f: 0.3, v: 0.85 }, { w: 1.5, o: 0.4, f: 0, v: 1 }];
  const N = 14, AM = 64, slope = Math.tan(-10 * Math.PI / 180);
  let w = 0, h = 0, t = 40, desenho = 0, raf = 0, visivel = true, ini = 0, ult = 0, cor = getComputedStyle(cv).color;
  const ptr = { x: 0, y: 0, a: 0, on: false };
  const redim = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); w = r.width; h = r.height; cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0); pinta(); };
  const y0 = (s, u, c, banda) => {
    const tt = t * c.v, x = u * w, centro = h * 0.55 + slope * (x - w / 2) + banda * 0.1 * Math.sin(Math.PI * 2 * (0.75 * u + 0.1) + c.f + tt * 0.35);
    const vira = 0.22 + 0.09 * Math.sin(tt * 0.21 + c.f), resp = 0.3 * Math.sin(tt * 0.5 + s * 4 + c.f), tw = Math.cos(Math.PI * (u - vira) + s * (0.6 + resp) + c.f);
    return centro + s * 0.95 * banda * tw;
  };
  function pinta() {
    ctx.clearRect(0, 0, w, h); ctx.strokeStyle = cor; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const banda = Math.min(h, w * 1.1) * 0.9, xs = new Float32Array(AM + 1), ys = new Float32Array(AM + 1), ate = Math.max(1, Math.ceil(AM * desenho));
    CAMADAS.forEach((c) => {
      ctx.lineWidth = c.w;
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1) - 0.5;
        for (let k = 0; k <= ate; k++) {
          const u = -0.06 + (k / AM) * 1.12, x = u * w; let y = y0(s, u, c, banda);
          if (ptr.a > 0.001) { const dx = x - ptr.x, dy = y - ptr.y, f = Math.exp(-(dx * dx + dy * dy) / 22500); y += dy / (Math.abs(dy) + 24) * f * 52 * ptr.a; }
          xs[k] = x; ys[k] = y;
        }
        ctx.globalAlpha = c.o * (0.45 + 0.55 * (1 - Math.abs(s) * 2));
        ctx.beginPath(); ctx.moveTo(xs[0], ys[0]);
        for (let k = 1; k < ate; k++) ctx.quadraticCurveTo(xs[k], ys[k], (xs[k] + xs[k + 1]) / 2, (ys[k] + ys[k + 1]) / 2);
        ctx.lineTo(xs[ate], ys[ate]); ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
  }
  const quadro = (agora) => {
    raf = 0; if (!ini) { ini = agora; ult = agora; }
    const dt = Math.min((agora - ult) / 1000, 0.05); ult = agora; t += dt;
    desenho = Math.min(1, (agora - ini) / 1600); desenho = 1 - Math.pow(1 - desenho, 3);
    ptr.a += ((ptr.on ? 1 : 0) - ptr.a) * 0.08; pinta();
    if (visivel) raf = requestAnimationFrame(quadro);
  };
  const tocar = () => { if (!raf && visivel && !reduz) { ult = performance.now(); raf = requestAnimationFrame(quadro); } };
  desenho = reduz ? 1 : 0; redim(); if (reduz) return;
  new ResizeObserver(redim).observe(cv);
  new IntersectionObserver((e) => { visivel = e[0].isIntersecting && !document.hidden; if (visivel) tocar(); }).observe(cv);
  document.addEventListener('visibilitychange', () => { visivel = !document.hidden; if (visivel) tocar(); });
  const hero = cv.parentElement;
  hero.addEventListener('pointermove', (ev) => { const r = cv.getBoundingClientRect(); ptr.x = ev.clientX - r.left; ptr.y = ev.clientY - r.top; ptr.on = true; });
  hero.addEventListener('pointerleave', () => { ptr.on = false; });
  tocar();
}
linhas();

/* ---------- spotlight (cards) ---------- */
raiz.addEventListener('pointermove', (ev) => {
  const c = ev.target.closest && ev.target.closest('.ep-b, .ep-pc'); if (!c) return;
  const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (ev.clientX - r.left) + 'px'); c.style.setProperty('--my', (ev.clientY - r.top) + 'px');
});

/* ---------- partículas ao clicar nos botões ---------- */
function explodir(btn) {
  if (!A || reduz || !btn) return;
  const r = btn.getBoundingClientRect(), pai = document.body, n = 16, ps = [];
  for (let i = 0; i < n; i++) { const p = document.createElement('i'); p.className = 'ep-part'; p.style.cssText = 'position:fixed;left:' + (r.left + r.width / 2) + 'px;top:' + (r.top + r.height / 2) + 'px;width:6px;height:6px;border-radius:50%;pointer-events:none;z-index:99999;background:' + (i % 2 ? '#ff7a3d' : '#7aa5ff'); pai.appendChild(p); ps.push(p); }
  A.animate(ps, { translateX: () => (Math.random() - 0.5) * 220, translateY: () => (Math.random() - 0.7) * 180, scale: [1, 0], opacity: [1, 0], duration: 760, delay: A.stagger(8), ease: 'outExpo', onComplete: () => ps.forEach((p) => p.remove()) });
}
/* cliques em [data-abrir], [data-parte] e [data-carro]: abrem no visualizador embutido */
raiz.addEventListener('click', (ev) => {
  const el = ev.target.closest && ev.target.closest('[data-abrir],[data-parte],[data-carro]'); if (!el) return;
  if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
  ev.preventDefault();
  track(el.dataset.parte ? 'ep_parte' : el.dataset.carro ? 'ep_modelo' : 'ep_abrir_3d', { parte: el.dataset.parte || '', carro: el.dataset.carro || '' });
  if (el.id === 'ep-cta' || el.hasAttribute('data-abrir')) explodir(el);
  abrirNoViewer({ carro: el.dataset.carro, parte: el.dataset.parte });
});

/* ---------- botão magnético (Motion) ---------- */
if (M && !reduz && matchMedia('(hover:hover)').matches) {
  $$('.ep-btn', raiz).forEach((b) => {
    b.addEventListener('pointermove', (ev) => { const r = b.getBoundingClientRect(); M.animate(b, { x: (ev.clientX - r.left - r.width / 2) * 0.18, y: (ev.clientY - r.top - r.height / 2) * 0.25 }, { duration: 0.25, ease: 'easeOut' }); });
    b.addEventListener('pointerleave', () => M.animate(b, { x: 0, y: 0 }, { type: 'spring', stiffness: 300, damping: 18 }));
  });
}

/* ---------- revelar ao rolar (Motion) ---------- */
if (M && !reduz) {
  raiz.classList.add('ep-js');
  const itens = $$('[data-rv]', raiz);
  itens.forEach((el) => { el.style.transform = 'translateY(30px)'; el.style.filter = 'blur(6px)'; });
  const vistos = new Map();
  M.inView(itens, (el) => {
    const irmaos = [...el.parentElement.children].filter((x) => x.hasAttribute('data-rv')), i = Math.max(0, irmaos.indexOf(el));
    M.animate(el, { opacity: 1, transform: 'translateY(0px)', filter: 'blur(0px)' }, { duration: 0.8, delay: Math.min(i, 8) * 0.07, ease: [0.22, 1, 0.36, 1] });
  }, { margin: '0px 0px -8% 0px' });
  /* trilha entre os passos */
  const trilha = $('.ep-linha'); if (trilha) { trilha.style.clipPath = 'inset(0 100% 0 0)'; M.inView(trilha, () => { M.animate(trilha, { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] }, { duration: 1.6, ease: [0.22, 1, 0.36, 1] }); }); }
}

/* ---------- contadores (anime.js) ---------- */
{
  const alvos = $$('[data-conta]', raiz).filter((e) => !e.classList.contains('ep-big') || true);
  const roda = (el) => {
    const fim = Number(el.dataset.conta) || 0, suf = el.dataset.suf || '';
    if (!A || reduz) { el.textContent = fim + suf; return; }
    const o = { v: 0 }; A.animate(o, { v: fim, duration: 1800, ease: 'outExpo', onUpdate: () => { el.textContent = Math.round(o.v) + suf; } });
  };
  if (M && !reduz) M.inView(alvos, (el) => { roda(el); }); else alvos.forEach(roda);
}

/* ---------- pins do hero flutuando (anime.js) ---------- */
if (A && !reduz) A.animate('.ep-pin', { translateY: [-6, 6], duration: 2600, delay: A.stagger(380), alternate: true, loop: true, ease: 'inOutSine' });

/* ---------- FAQ animado (Motion) ---------- */
$$('#ep-faq details').forEach((d) => {
  const resp = $('.resp', d), sum = $('summary', d);
  sum.addEventListener('click', (ev) => {
    if (!M || reduz) return; ev.preventDefault();
    if (d.open) { M.animate(resp, { height: [resp.offsetHeight + 'px', '0px'] }, { duration: 0.35, ease: 'easeInOut' }).finished.then(() => { d.open = false; resp.style.height = ''; }); }
    else { d.open = true; const alt = resp.scrollHeight; M.animate(resp, { height: ['0px', alt + 'px'] }, { duration: 0.4, ease: [0.22, 1, 0.36, 1] }).finished.then(() => { resp.style.height = ''; }); }
  });
});

/* ---------- menu fixo: barra de progresso (Motion) e seção ativa ---------- */
{
  const barra = $('#ep-prog');
  if (M && barra && !reduz && M.scroll) { try { M.scroll(M.animate(barra, { scaleX: [0, 1] }, { ease: 'linear' })); } catch (e) {} }
  else if (barra) { addEventListener('scroll', () => { const h = document.documentElement; barra.style.transform = 'scaleX(' + Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) + ')'; }, { passive: true }); }
  const links = $$('.ep-nav nav a');
  const alvos = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
    alvos.forEach((s) => io.observe(s));
  }
}

/* ---------- visualizador: carrega perto da tela, esconde a gaveta fora dela, abre links antigos ---------- */
{
  const sec = $('#visualizador');
  if ('IntersectionObserver' in window && sec) {
    new IntersectionObserver((es) => { if (es[0].isIntersecting) carregarViewer().catch(() => {}); }, { rootMargin: '700px 0px' }).observe(sec);
    const marca = () => { const c = $('.c3d'); if (!c) { setTimeout(marca, 800); return; } new IntersectionObserver((es) => c.classList.toggle('ep-fora', !es[0].isIntersecting), { threshold: 0.05 }).observe(c); };
    marca();
  } else carregarViewer().catch(() => {});
  /* links antigos de /3d-carros/?carro=...&parte=... agora apontam para esta pagina */
  if (/[?&](carro|parte)=/.test(location.search)) setTimeout(rolarAoViewer, 900);
}

/* ---------- busca rápida: peças mais procuradas (busca da própria loja: /q?keywords=) ---------- */
{
  const box = $('#ep-termos');
  if (box) box.innerHTML = ['Capô', 'Para-choque', 'Farol', 'Lanterna', 'Retrovisor', 'Roda', 'Porta', 'Parabrisa', 'Grade', 'Tampa traseira', 'Paralama', 'Maçaneta'].map((p) => '<a href="/q?keywords=' + encodeURIComponent(p) + '">' + p + '</a>').join('');
}

/* ---------- pecas soltas: fatia a lataria por regiao e separa rodas/farois/lanternas ---------- */
function prepararPecas(mv, carro) {
  const simbolo = (n) => Object.getOwnPropertySymbols(mv).find((s) => s.description === n);
  const scene = mv[simbolo('scene')], precisa = simbolo('needsRender');
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.visible && o.geometry && o.geometry.attributes.position && o.geometry.attributes.position.count > 40) meshes.push(o); });
  if (!meshes.length) return null;
  const V3 = meshes[0].position.constructor, Mesh = meshes[0].constructor, Geo = meshes[0].geometry.constructor;
  const f = carro.frente || '+z', ex = f[1] === 'x', sg = f[0] === '+' ? 1 : -1;
  const pint = new Set((carro.paint && carro.paint.materials) || []);
  /* caixa do carro (percentis, ignora pecas soltas) */
  const am = [[], [], []];
  meshes.forEach((m) => { const p = m.geometry.attributes.position, e = m.matrixWorld.elements; for (let i = 0; i < p.count; i += 3) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); am[0].push(e[0] * x + e[4] * y + e[8] * z + e[12]); am[1].push(e[1] * x + e[5] * y + e[9] * z + e[13]); am[2].push(e[2] * x + e[6] * y + e[10] * z + e[14]); } });
  const lim = am.map((v) => { v.sort((a, b) => a - b); const n = v.length; return [v[Math.floor(n * 0.004)], v[Math.ceil(n * 0.996) - 1]]; });
  const C = lim.map((l) => (l[0] + l[1]) / 2), D = lim.map((l) => l[1] - l[0]);
  const L = ex ? D[0] : D[2], W = ex ? D[2] : D[0], H = D[1], minY = lim[1][0];
  const F = ex ? new V3(sg, 0, 0) : new V3(0, 0, sg), S = ex ? new V3(0, 0, 1) : new V3(1, 0, 0), UP = new V3(0, 1, 0);
  const nomeMat = (m) => String((Array.isArray(m.material) ? m.material[0] : m.material).name || '');
  const pecas = [];
  const PARAM = {
    capo: { passo: 0, dir: () => UP.clone().multiplyScalar(0.9).addScaledVector(F, 0.45), dist: 0.24 * L },
    farol: { passo: 0, dir: () => F.clone().addScaledVector(UP, 0.12), dist: 0.26 * L },
    'parachoque-d': { passo: 0, dir: () => F.clone().addScaledVector(UP, -0.08), dist: 0.3 * L },
    'porta-e': { passo: 1, dir: () => S.clone().negate(), dist: 0.3 * L },
    'porta-d': { passo: 1, dir: () => S.clone(), dist: 0.3 * L },
    'roda-e': { passo: 2, dir: () => S.clone().negate(), dist: 0.34 * L },
    'roda-d': { passo: 2, dir: () => S.clone(), dist: 0.34 * L },
    portamalas: { passo: 3, dir: () => UP.clone().multiplyScalar(0.8).addScaledVector(F, -0.55), dist: 0.24 * L },
    lanterna: { passo: 3, dir: () => F.clone().negate().addScaledVector(UP, 0.1), dist: 0.26 * L },
    'parachoque-t': { passo: 3, dir: () => F.clone().negate().addScaledVector(UP, -0.08), dist: 0.3 * L },
    teto: { passo: 4, dir: () => UP.clone(), dist: 0.34 * L }
  };
  const classifica = (mat, u, v, w, nu, ny, nw) => {
    if (/roda|pneu|wheel|tire|tyre|calota|disk|disc/i.test(mat)) { if (v < 0.5 && Math.abs(w) > 0.3) return w < 0 ? 'roda-e' : 'roda-d'; return null; }
    if (/lente|lens|farol|headl|reflex|lanterna|tail|stop|light/i.test(mat)) { if (u > 0.5) return 'farol'; if (u < -0.5) return 'lanterna'; return null; }
    const zg = ((u, v, w, nu, ny, nw) => {
    if (u > 0.8 && v < 0.46 && nu > 0.1) return 'parachoque-d';
    if (u < -0.8 && v < 0.46 && nu < -0.1) return 'parachoque-t';
    if (u > 0.26 && u < 0.82 && v > 0.38 && ny > 0.5 && Math.abs(w) < 0.7) return 'capo';
    if (u > -0.55 && u < 0.28 && v > 0.62 && ny > 0.5 && Math.abs(w) < 0.8) return 'teto';
    if (u < -0.3 && u > -0.88 && v > 0.4 && (ny > 0.3 || nu < -0.5) && Math.abs(w) < 0.75) return 'portamalas';
    if (Math.abs(w) > 0.45 && u > -0.4 && u < 0.34 && v > 0.26 && v < 0.96 && Math.abs(nw) > 0.1 && Math.abs(ny) < 0.92) return w < 0 ? 'porta-e' : 'porta-d';
    return null; })(u, v, w, nu, ny, nw);
    if (!zg) return null;
    if (zg === 'teto' || zg === 'portamalas') return /vidro|glass|window|cristal|parabr/i.test(mat) ? null : zg;
    return (pint.size && !pint.has(mat)) ? null : zg;
  };
  meshes.forEach((m) => {
    const mat = nomeMat(m), g = m.geometry, pos = g.attributes.position, idx = g.index, nT = Math.floor((idx ? idx.count : pos.count) / 3), e = m.matrixWorld.elements;
    const wp = (i) => { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
    const baldes = new Map(); let algum = false;
    for (let t = 0; t < nT; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      const a = wp(i0), b = wp(i1), c = wp(i2);
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const ln = Math.hypot(nx, ny, nz) || 1; nx /= ln; ny /= ln; nz /= ln;
      /* a normal pode estar invertida (ordem dos vertices): usa a do atributo quando existir */
      const na = g.attributes.normal; if (na) { const k = na.getX(i0) * 0, ax = na.getX(i0), ay = na.getY(i0), az = na.getZ(i0), M = m.matrixWorld.elements; const wx = M[0] * ax + M[4] * ay + M[8] * az, wy = M[1] * ax + M[5] * ay + M[9] * az, wz = M[2] * ax + M[6] * ay + M[10] * az, lw = Math.hypot(wx, wy, wz) || 1; nx = wx / lw; ny = wy / lw; nz = wz / lw; }
      const along = (ex ? cx - C[0] : cz - C[2]), lat = (ex ? cz - C[2] : cx - C[0]);
      const u = sg * along / (L / 2), w = lat / (W / 2), v = (cy - minY) / H;
      const nu = sg * (ex ? nx : nz), nw = ex ? nz : nx;
      const z = classifica(mat, u, v, w, nu, ny, nw);
      const chave = z || '_resto'; if (z) algum = true;
      let bk = baldes.get(chave); if (!bk) { bk = []; baldes.set(chave, bk); } bk.push(i0, i1, i2);
    }
    if (!algum) return;
    /* monta geometria nao indexada para cada balde (aceita atributos intercalados) */
    const nomes = Object.keys(g.attributes);
    const AttrF = new Geo().setFromPoints([new V3()]).attributes.position.constructor;
    const construir = (tris) => {
      const ng = new Geo();
      nomes.forEach((n) => {
        const at = g.attributes[n], s = at.itemSize, inter = !!at.isInterleavedBufferAttribute;
        const arr = inter ? new Float32Array(tris.length * s) : new at.array.constructor(tris.length * s);
        tris.forEach((vi, k) => { if (inter) { arr[k * s] = at.getX(vi); if (s > 1) arr[k * s + 1] = at.getY(vi); if (s > 2) arr[k * s + 2] = at.getZ(vi); if (s > 3) arr[k * s + 3] = at.getW(vi); } else { for (let q = 0; q < s; q++) arr[k * s + q] = at.array[vi * s + q]; } });
        ng.setAttribute(n, inter ? new AttrF(arr, s, at.normalized) : new at.constructor(arr, s, at.normalized));
      });
      return ng;
    };
    const pai = m.parent, novos = [];
    baldes.forEach((tris, chave) => novos.push([chave, construir(tris)]));   /* tudo construido antes de alterar o carro */
    novos.forEach(([chave, ng]) => {
      if (chave === '_resto') { m.geometry = ng; return; }
      const mat2 = Array.isArray(m.material) ? m.material.map((q) => q.clone()) : m.material.clone();
      const nm = new Mesh(ng, mat2);
      nm.position.copy(m.position); nm.quaternion.copy(m.quaternion); nm.scale.copy(m.scale); nm.name = m.name + '-' + chave;
      pai.add(nm); nm.updateMatrixWorld(true);
      const prm = PARAM[chave], base = new V3().setFromMatrixPosition(nm.matrixWorld);
      const mats = Array.isArray(mat2) ? mat2 : [mat2];
      const emi = mats.map((q) => (q.color ? { q, c: q.color.clone() } : null)).filter(Boolean);
      pecas.push({ zona: chave, mesh: nm, pai, base, dir: prm.dir(), dist: prm.dist, passo: prm.passo, k: 0, emi });
    });
    if (!baldes.has('_resto')) m.visible = false;
  });
  const aplica = () => {
    pecas.forEach((p) => {
      const alvo = p.base.clone().addScaledVector(p.dir, p.dist * p.k);
      p.mesh.position.copy(p.pai.worldToLocal(alvo));
      /* as pecas mantem a cor original ao soltar */
    });
    try { mv[precisa](); } catch (e) {}
  };
  return {
    total: pecas.length,
    /* passo ativo -> as pecas daquele passo sobem para k=1 (suave); retorna se ainda esta animando */
    anima(passo, veloc) {
      let mexeu = false;
      pecas.forEach((p) => { const alvo = p.passo === passo ? 1 : 0, d = alvo - p.k; if (Math.abs(d) > 0.002) { p.k += d * veloc; mexeu = true; } else if (p.k !== alvo) { p.k = alvo; mexeu = true; } });
      if (mexeu) aplica();
      return mexeu;
    },
    abertura() { return pecas.reduce((m, p) => Math.max(m, p.k), 0); }
  };
}

/* ---------- giro do carro na rolagem ---------- */
{
  const sec = $('#giro'), box = $('#ep-giro-carro'), lis = $$('#ep-giro-passos li');
  if (sec && box && lis.length) {
    const PAS = [{ t: 28, p: 70, r: 112 }, { t: 62, p: 66, r: 118 }, { t: 72, p: 78, r: 108 }, { t: 152, p: 60, r: 114 }, { t: 205, p: 32, r: 122 }];
    let mv = null, alvo = 0, atual = -1, raf = 0, visivel = false, ult = -1, off = 0, carroGiro = null, pecas = null, passoAtivo = 0, mexendo = false;
    const montar = async () => {
      if (mv) return;
      const c = carros.find((x) => x.id === 'fiat-argo') || carros.find((x) => x.id === 'jeep-compass') || carros[0]; if (!c) return;
      off = { '+z': 0, '-z': 180, '+x': 90, '-x': -90 }[c.frente || '+z'] || 0; carroGiro = c;
      await customElements.whenDefined('model-viewer').catch(() => {});
      mv = document.createElement('model-viewer');
      mv.setAttribute('interaction-prompt', 'none'); mv.setAttribute('disable-zoom', ''); mv.setAttribute('disable-pan', ''); mv.setAttribute('shadow-intensity', '1.1'); mv.setAttribute('shadow-softness', '1');
      mv.setAttribute('exposure', '1.1'); mv.setAttribute('environment-image', 'neutral'); mv.setAttribute('camera-orbit', PAS[0].t + 'deg ' + PAS[0].p + 'deg ' + PAS[0].r + '%'); mv.setAttribute('touch-action', 'pan-y');
      mv.setAttribute('alt', 'Carro girando conforme você rola a página'); mv.setAttribute('reveal', 'auto');
      try { customElements.get('model-viewer').meshoptDecoderLocation = 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/meshopt_decoder.js'; } catch (e) {}
      mv.poster = BASE + '/posters/poster-' + c.id + '.webp'; mv.src = BASE + '/assets/' + c.file;
      box.appendChild(mv);
      mv.addEventListener('load', () => { try { pecas = prepararPecas(mv, carroGiro); } catch (e) { pecas = null; } mexe(); }, { once: true });
      quadro();
    };
    const progresso = () => { const r = sec.getBoundingClientRect(), tot = Math.max(1, sec.offsetHeight - innerHeight); return Math.min(1, Math.max(0, -(r.top - 62) / tot)); };
    const suave = (x) => x * x * (3 - 2 * x);
    const quadro = () => {
      raf = 0;
      alvo = progresso();
      atual = atual < 0 ? alvo : atual + (alvo - atual) * 0.14;
      const f = atual * (PAS.length - 1), i = Math.min(PAS.length - 2, Math.floor(f)), k = suave(f - i), a = PAS[i], b = PAS[i + 1];
      if (mv) { try { mv.cameraOrbit = (off + a.t + (b.t - a.t) * k).toFixed(1) + 'deg ' + (a.p + (b.p - a.p) * k).toFixed(1) + 'deg ' + ((a.r + (b.r - a.r) * k) * (1 + 0.28 * (pecas ? pecas.abertura() : 0))).toFixed(1) + '%'; mv.jumpCameraToGoal(); } catch (e) {} }
      const ativo = Math.min(PAS.length - 1, Math.round(f));
      if (ativo !== ult) { ult = ativo; lis.forEach((li, n) => li.classList.toggle('on', n === ativo)); track('ep_giro_passo', { passo: ativo }); }
      passoAtivo = ativo; mexendo = pecas ? pecas.anima(passoAtivo, 0.1) : false;
      if (visivel && (Math.abs(alvo - atual) > 0.0004 || mexendo)) raf = requestAnimationFrame(quadro);
    };
    const mexe = () => { if (!raf && visivel) raf = requestAnimationFrame(quadro); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visivel = es[0].isIntersecting; if (visivel) { montar(); mexe(); } }, { rootMargin: '600px 0px' }).observe(sec);
    } else { visivel = true; montar(); }
    addEventListener('scroll', mexe, { passive: true }); addEventListener('resize', mexe);
  }
}

/* ---------- vitrine: produtos reais da loja (le a pagina de resultados da busca, como o visualizador faz) ---------- */
{
  const sec = $('#vitrine'), tabs = $('#ep-vtabs'), grid = $('#ep-vgrid'), mais = $('#ep-vmais');
  const TERMOS = ['Capô', 'Farol', 'Para-choque', 'Retrovisor', 'Roda', 'Lanterna'];
  const cacheV = {};
  const buscaProdutos = async (q) => {
    if (cacheV[q]) return cacheV[q];
    const r = await fetch('/q?keywords=' + encodeURIComponent(q), { credentials: 'same-origin' });
    if (!r.ok) throw new Error('http-' + r.status);
    const buf = await r.arrayBuffer(); let html;
    try { html = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { html = new TextDecoder('windows-1252').decode(buf); }
    const d = new DOMParser().parseFromString(html, 'text/html');
    const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    const img = (e) => { const i = e && e.querySelector('img'); return i ? (i.getAttribute('data-src') || i.getAttribute('src') || '') : ''; };
    const lista = [...d.querySelectorAll('article.isb-card')].slice(0, 8).map((c) => {
      const a = c.querySelector('a.isb-card__name') || c.querySelector('a[href]'); if (!a) return null;
      return { nome: tx(a), url: a.getAttribute('href') || '', img: img(c), preco: tx(c.querySelector('.isb-price__now')), de: tx(c.querySelector('.isb-price s, .isb-price del, .isb-price__old, .isb-price__was')) };
    }).filter(Boolean);
    cacheV[q] = lista; return lista;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mostra = async (q, btn) => {
    $$('button', tabs).forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    mais.href = '/q?keywords=' + encodeURIComponent(q);
    grid.innerHTML = '<div class="ep-sk"></div>'.repeat(4);
    try {
      const lista = await buscaProdutos(q);
      if (!lista.length) { grid.innerHTML = '<p class="ep-vvazio">Nenhum produto encontrado agora para "' + esc(q) + '". Veja todas as peças na loja.</p>'; return; }
      grid.innerHTML = lista.map((p) => '<a class="ep-prod" href="' + esc(p.url) + '" data-termo="' + esc(q) + '">' + (p.img ? '<img loading="lazy" alt="' + esc(p.nome) + '" src="' + esc(p.img) + '" data-orig="' + esc(p.img.replace(/thumb_d+-d+-/, '')) + '">' : '') + '<div><b>' + esc(p.nome) + '</b><p>' + (p.de ? '<s>' + esc(p.de) + '</s>' : '') + '<span>' + esc(p.preco) + '</span></p></div></a>').join('');
      /* miniaturas do tema sao criadas sob demanda: tenta o gerador do tema (createThumb) e, se falhar, usa a imagem original */
      $$('.ep-prod img', grid).forEach((im) => {
        im.addEventListener('error', () => {
          if (!im.dataset.t1 && typeof window.createThumb === 'function') { im.dataset.t1 = '1'; try { window.createThumb(im); return; } catch (e) {} }
          if (!im.dataset.t2 && im.dataset.orig && im.src !== im.dataset.orig) { im.dataset.t2 = '1'; im.src = im.dataset.orig; return; }
          im.style.visibility = 'hidden';
        });
        if (im.complete && im.naturalWidth === 0) im.dispatchEvent(new Event('error'));
      });
      if (A && !reduz) A.animate($$('.ep-prod', grid), { opacity: [0, 1], translateY: [20, 0], delay: A.stagger(60), duration: 600, ease: 'outExpo' });
    } catch (e) { grid.innerHTML = '<p class="ep-vvazio">Não foi possível carregar os produtos agora. <a href="/q?keywords=' + encodeURIComponent(q) + '">Ver na loja</a>.</p>'; }
  };
  if (sec && tabs) {
    tabs.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; track('ep_vitrine_aba', { termo: b.dataset.q }); mostra(b.dataset.q, b); });
    grid.addEventListener('click', (ev) => { const a = ev.target.closest('a.ep-prod'); if (a) track('ep_vitrine_produto', { termo: a.dataset.termo, url: a.getAttribute('href') }); });
    const primeira = async () => {
      /* testa todos os termos e mostra so as abas que têm produto */
      const res = await Promise.all(TERMOS.map((q) => buscaProdutos(q).then((l) => l.length).catch(() => 0)));
      const com = TERMOS.filter((q, i) => res[i] > 0);
      if (!com.length) { sec.hidden = true; return; }
      tabs.innerHTML = com.map((q, i) => '<button type="button" role="tab" data-q="' + q + '" aria-selected="' + (i === 0) + '">' + q + '</button>').join('');
      sec.hidden = false; mostra(com[0], tabs.firstElementChild);
    };
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); primeira(); } }, { rootMargin: '500px 0px' }); io.observe(sec.hidden ? $('#modelos') : sec); } else primeira();
  }
}

/* ---------- medição: busca rápida, FAQ, seções vistas ---------- */
{
  const bq = $('.ep-bq'); if (bq) bq.addEventListener('submit', () => track('ep_busca_rapida', { termo: (bq.querySelector('input').value || '').slice(0, 60) }));
  const tm = $('#ep-termos'); if (tm) tm.addEventListener('click', (ev) => { const a = ev.target.closest('a'); if (a) track('ep_termo', { termo: a.textContent }); });
  $$('#ep-faq details').forEach((d) => d.addEventListener('toggle', () => { if (d.open) track('ep_faq', { pergunta: (d.querySelector('summary').textContent || '').slice(0, 80) }); }));
  if ('IntersectionObserver' in window) {
    const vistas = new Set(), io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !vistas.has(e.target.id)) { vistas.add(e.target.id); track('ep_secao', { secao: e.target.id }); } }), { threshold: 0.35 });
    ['como', 'giro', 'checagens', 'comparativo', 'partes', 'modelos', 'vitrine', 'busca-rapida', 'confianca', 'visualizador', 'faq'].forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }
}
