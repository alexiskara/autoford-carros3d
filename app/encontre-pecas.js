/* Landing "Encontre peças" — Autoford / Variados.
 * Animações: Motion (revelar ao rolar, magnético, FAQ) + anime.js (contadores, stagger, partículas, filtro).
 * Fundo de linhas fluidas inspirado no "Background Paths" do Kokonut UI (MIT, kokonutui.com), reescrito em JS puro. */
const BASE = (typeof window.EP_BASE === 'string') ? window.EP_BASE : 'https://cdn.jsdelivr.net/gh/alexiskara/autoford-carros3d@303be88198918db7d067f38803c188f3d0642c7d';
const VISUALIZADOR = '/3d-carros/';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const raiz = $('#ep');
if (!raiz) throw new Error('landing ausente');
const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;

let A = null, M = null;
try { A = await import('https://cdn.jsdelivr.net/npm/animejs@4.3.6/dist/bundles/anime.esm.min.js'); } catch (e) { A = null; }
try { M = await import('https://cdn.jsdelivr.net/npm/motion@12.43.0/+esm'); } catch (e) { M = null; }

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (t) => semAcento(t).toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---------- dados ---------- */
let carros = [];
try { carros = (await (await fetch(BASE + '/cars.json')).json()).cars || []; } catch (e) { carros = []; }
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
  const abrir = (c, ano) => { const u = new URL(VISUALIZADOR, location.origin); if (c) u.searchParams.set('carro', c.id); if (ano) u.searchParams.set('ano', ano); location.href = u.pathname + u.search; };
  $('#ep-busca').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const txt = $('#ep-q').value.trim();
    const am = txt.match(/\b(?:19|20)\d{2}\b/), q = norm(txt.replace(/\b(?:19|20)\d{2}\b/, ''));
    const c = q ? carros.find((x) => norm(nomeCarro(x)).includes(q) || q.includes(norm(x.model))) : null;
    explodir($('#ep-go'));
    setTimeout(() => abrir(c, am ? am[0] : ''), reduz ? 0 : 380);
  });
}

/* ---------- partes ---------- */
const PARTES = [
  ['capo', 'Capô', 'Frente do carro, sobre o motor'], ['parachoque-d', 'Para-choque dianteiro', 'Proteção e acabamento da frente'], ['farol', 'Faróis', 'Iluminação dianteira'],
  ['parabrisa', 'Parabrisa', 'Vidro dianteiro'], ['teto', 'Teto', 'Cobertura e acabamentos'], ['portas', 'Portas', 'Dianteiras e traseiras'],
  ['retrovisor', 'Retrovisores', 'Espelhos laterais'], ['rodas', 'Rodas', 'Aros, calotas e rodas'], ['portamalas', 'Porta-malas', 'Tampa traseira'],
  ['lanterna', 'Lanternas', 'Iluminação traseira'], ['parachoque-t', 'Para-choque traseiro', 'Proteção e acabamento de trás']
];
$('#ep-partes').innerHTML = PARTES.map((p, i) => '<a class="ep-pc" data-rv href="' + VISUALIZADOR + '?parte=' + p[0] + '"><span>' + String(i + 1).padStart(2, '0') + '</span><b>' + p[1] + '</b><small>' + p[2] + '</small><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg></a>').join('');

/* ---------- modelos ---------- */
function montarGrade(filtro) {
  const lista = carros.filter((c) => filtro === 'todos' || c.category === filtro);
  $('#ep-grade').innerHTML = lista.map((c) => '<a class="ep-mc" href="' + VISUALIZADOR + '?carro=' + c.id + '"><img loading="lazy" alt="' + nomeCarro(c) + '" src="' + BASE + '/posters/poster-' + c.id + '.webp"><div><span><small>' + c.brand + '</small><b>' + c.model + '</b></span><em>Abrir 3D →</em></div></a>').join('');
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
$('#ep-cta').addEventListener('click', (ev) => { if (reduz || !A) return; ev.preventDefault(); const h = ev.currentTarget.href; explodir(ev.currentTarget); setTimeout(() => { location.href = h; }, 380); });

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
