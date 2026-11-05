/* Endereço do catálogo (cars.json) e dos arquivos .glb. No ambiente local de testes, window.C3D_BASE substitui este valor. */
const BASE = (typeof window.C3D_BASE === 'string') ? window.C3D_BASE : 'https://cdn.jsdelivr.net/gh/alexiskara/autoford-carros3d@303be88198918db7d067f38803c188f3d0642c7d';
const ZONAS = {
  'capo': { nome: 'Capô', termo: 'capô', cam: [0, 52, 70] },
  'parachoque-d': { nome: 'Para-choque dianteiro', termo: 'para-choque dianteiro', cam: [0, 78, 75] },
  'farol': { nome: 'Faróis', termo: 'farol', cam: [35, 78, 70] },
  'parabrisa': { nome: 'Parabrisa', termo: 'parabrisa', cam: [0, 60, 80] },
  'teto': { nome: 'Teto', termo: 'teto', cam: [0, 25, 95] },
  'portas': { nome: 'Portas', termo: 'porta', cam: [90, 80, 85] },
  'retrovisor': { nome: 'Retrovisores', termo: 'retrovisor', cam: [70, 75, 60] },
  'rodas': { nome: 'Rodas', termo: 'roda', cam: [90, 85, 65] },
  'portamalas': { nome: 'Porta-malas', termo: 'tampa traseira', cam: [180, 55, 75] },
  'lanterna': { nome: 'Lanternas', termo: 'lanterna', cam: [180, 78, 70] },
  'parachoque-t': { nome: 'Para-choque traseiro', termo: 'para-choque traseiro', cam: [180, 80, 75] }
};
const CORES = [['Original', null], ['Branco', [.95, .95, .95]], ['Prata', [.66, .69, .73]], ['Preto', [.04, .04, .05]], ['Vermelho', [.62, .04, .08]], ['Azul', [.05, .2, .62]], ['Verde', [.04, .34, .16]], ['Amarelo', [.92, .7, .05]]];
const TETA = { '+z': 0, '-z': 180, '+x': 90, '-x': -90 };
const PLACA_API = '';
const WHATSAPP = zapLoja();
const $ = (id) => document.getElementById(id);
const semAcento = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const semHifen = (t) => t.replace(/-/g, '');
function track(nome, dados) {
  try {
    const d = Object.assign({ event: nome }, dados || {});
    (window.dataLayer = window.dataLayer || []).push(d);
    if (typeof window.gtag === 'function') window.gtag('event', nome, dados || {});
    if (typeof window.fbq === 'function') window.fbq('trackCustom', nome, dados || {});
  } catch (e) {}
}
function setAnoSel() { $('c3d-ano').value = ano || 'todos'; }
function guardar(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function faixaAno(nome) {
  const f = (x) => { x = +x; return x < 100 ? (x > 40 ? 1900 + x : 2000 + x) : x; };
  const m = nome.match(/\b((?:19|20)\d{2}|\d{2})\s*(?:a|à|ao|até|-|\/)\s*((?:19|20)\d{2}|\d{2})\b/i);
  if (m) return [f(m[1]), f(m[2])];
  const u = nome.match(/\b(?:19|20)\d{2}\b/);
  return u ? [+u[0], +u[0]] : null;
}
function numPreco(t) { const m = String(t || '').replace(/\./g, '').match(/(\d+),(\d{2})/); return m ? parseFloat(m[1] + '.' + m[2]) : null; }
function sincronizarUrl(parte) {
  try {
    const u = new URL(location.href);
    if (atual) u.searchParams.set('carro', atual.id);
    if (parte) u.searchParams.set('parte', parte); else u.searchParams.delete('parte');
    if (ano) u.searchParams.set('ano', ano); else u.searchParams.delete('ano');
    history.replaceState(null, '', u.toString());
  } catch (e) {}
  atualizarCompartilhar();
}
function atualizarCompartilhar() {
  if (!atual) return;
  const t = 'Veja as peças para ' + atual.brand + ' ' + atual.model + (zonaAtual ? ' (' + ZONAS[zonaAtual].nome + ')' : '') + ': ' + location.href;
  $('c3d-zap').href = 'https://wa.me/?text=' + encodeURIComponent(t);
}
const mv = $('c3d-mv');
const seguro = (u) => typeof u === 'string' && /^(https?:\/\/|\/)/.test(u);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let carros = [], atual = null, zonaAtual = null, seq = 0, arrasto = null, ano = ler('c3d_ano2') || '';
const cache = {};

let MOTION = null;
try { MOTION = await import('https://cdn.jsdelivr.net/npm/motion@12.43.0/+esm'); } catch (e) { MOTION = null; }
await customElements.whenDefined('model-viewer');
customElements.get('model-viewer').meshoptDecoderLocation = 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/meshopt_decoder.js';
if (reduz) mv.removeAttribute('auto-rotate');

/* Configuração da busca da loja (API de sugestões do tema; no ambiente local usa window.C3D_API) */
function apiBusca() {
  const w = document.querySelector('.isb-header__search[data-sug-url]');
  if (w) return { url: w.getAttribute('data-sug-url'), token: w.getAttribute('data-sug-token') || '' };
  return window.C3D_API || null;
}
function urlBusca(q) {
  const f = document.getElementById('frmbusca');
  const base = (f && f.getAttribute('action')) || '/q';
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'keywords=' + encodeURIComponent(q);
}
/* Busca normal da loja: lê a página de resultados (lista de cards) ou a página do produto, quando há um único resultado */
async function buscarHTML(q) {
  const r = await fetch(urlBusca(q), { credentials: 'same-origin' });
  if (!r.ok) throw new Error('http-' + r.status);
  const buf = await r.arrayBuffer(); let html;
  try { html = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { html = new TextDecoder('windows-1252').decode(buf); }
  const d = new DOMParser().parseFromString(html, 'text/html');
  const txt = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  const imgDe = (e) => { const i = e && e.querySelector('img'); if (!i) return ''; return i.getAttribute('data-src') || i.getAttribute('src') || ''; };
  const caminho = new URL(r.url, location.href).pathname;
  if (d.querySelector('.isb-empty')) return [];
  if (r.redirected && !/\/q\/?$/.test(caminho)) {
    const nome = txt(d.querySelector('h1'));
    if (!nome) return [];
    const og = d.querySelector('meta[property="og:image"]');
    return [{ nome: nome, url: caminho, img: (og && og.getAttribute('content')) || imgDe(d.querySelector('main,article,body')), preco: txt(d.querySelector('.isb-price__now')), preco_de: txt(d.querySelector('.isb-price s, .isb-price del, .isb-price__old, .isb-price__was')) }];
  }
  return [...d.querySelectorAll('article.isb-card')].slice(0, 12).map((c) => {
    const a = c.querySelector('a.isb-card__name') || c.querySelector('a[href]');
    if (!a) return null;
    return { nome: txt(a), url: a.getAttribute('href') || '', img: imgDe(c), preco: txt(c.querySelector('.isb-price__now')), preco_de: txt(c.querySelector('.isb-price s, .isb-price del, .isb-price__old, .isb-price__was')) };
  }).filter(Boolean);
}
async function buscarAPI(q) {
  const api = apiBusca();
  if (!api || !api.url) throw new Error('sem-api');
  const r = await fetch(api.url + '?q=' + encodeURIComponent(q) + '&n=12&min=2', { headers: { 'X-Isb-Busca': '1', 'X-Isb-Token': api.token, 'Accept': 'application/json' }, credentials: 'same-origin' });
  if (!r.ok) throw new Error('http-' + r.status);
  const d = await r.json();
  return (d && d.produtos) || [];
}
async function buscar(q) {
  if (cache[q]) return cache[q];
  let lista;
  try { lista = await buscarHTML(q); } catch (e) { lista = await buscarAPI(q); }
  cache[q] = lista;
  return lista;
}

/* Catálogo */
const cat = await (await fetch(BASE + '/cars.json')).json();
carros = cat.cars;
const marcas = [...new Set(carros.map((c) => c.brand))];

function montarMarcas() {
  const box = $('c3d-marcas'); box.textContent = '';
  marcas.forEach((m) => {
    const b = el('button', 'c3d-pill'); b.type = 'button'; b.dataset.m = m;
    b.appendChild(document.createTextNode(m)); b.appendChild(el('small', null, String(carros.filter((c) => c.brand === m).length)));
    b.onclick = () => { const p = carros.find((c) => c.brand === m); abrir(p); };
    box.appendChild(b);
  });
}
function montarModelos(marca) {
  const box = $('c3d-modelos'); box.textContent = '';
  const nomes = { hatch: 'Hatch', sedan: 'Sedã', suv: 'SUV', pickup: 'Picape', wagon: 'Perua', coupe: 'Cupê', sports: 'Esportivo' };
  carros.filter((c) => c.brand === marca).forEach((c) => {
    const b = el('button', 'c3d-card'); b.type = 'button'; b.dataset.id = c.id;
    b.appendChild(el('span', null, nomes[c.category] || c.category)); b.appendChild(el('strong', null, c.model));
    b.onclick = () => abrir(c);
    box.appendChild(b);
  });
}
function marcarAtivos() {
  document.querySelectorAll('#c3d-marcas .c3d-pill').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === atual.brand));
  document.querySelectorAll('#c3d-modelos .c3d-card').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === atual.id));
}

function abrir(c) {
  const trocouMarca = !atual || atual.brand !== c.brand;
  desfazerExplosao(); atual = c; zonaAtual = null; seq++; irGaveta('peek');
  if (trocouMarca) montarModelos(c.brand);
  marcarAtivos();
  $('c3d-marca-nome').textContent = c.brand; $('c3d-modelo-nome').textContent = c.model;
  $('c3d-carga').classList.remove('off'); $('c3d-barra').style.width = '0';
  $('c3d-carga-txt').textContent = 'Carregando ' + c.brand + ' ' + c.model + '\u2026';
  mv.querySelector('.c3d-pin').hidden = true;
  mv.poster = BASE + '/posters/poster-' + c.id + '.webp';
  mv.src = BASE + '/assets/' + c.file;
  const cr = c.credit || {};
  const p = $('c3d-credito'); p.textContent = 'Modelo 3D: ' + (cr.sourceName || c.model) + ' por ';
  const a = el('a', null, cr.author || 'autor'); if (seguro(cr.authorUrl)) { a.href = cr.authorUrl; a.target = '_blank'; a.rel = 'noopener'; } p.appendChild(a);
  p.appendChild(document.createTextNode(' · ' + (cr.license || '') + ' · '));
  const f = el('a', null, 'fonte'); if (seguro(cr.sourceUrl)) { f.href = cr.sourceUrl; f.target = '_blank'; f.rel = 'noopener'; } p.appendChild(f);
  p.appendChild(document.createTextNode('. Marcas e logos pertencem às respectivas fabricantes; imagens ilustrativas.'));
  montarCores(); painelInicial();
  $('c3d-dica').classList.remove('off');
  guardar('c3d_carro', c.id); mostrarGaragem(); sincronizarUrl(null); document.title = c.brand + ' ' + c.model + ' - Peças em 3D';
  track('c3d_carro', { carro: c.id, marca: c.brand, modelo: c.model });
}
function mostrarGaragem() {
  const g = $('c3d-garagem'); if (!atual) { g.hidden = true; return; }
  $('c3d-garagem-nome').textContent = atual.brand + ' ' + atual.model + (ano ? ' · ' + ano : ''); g.hidden = false;
}

function montarCores() {
  const box = $('c3d-cores'); box.textContent = ''; box.appendChild(el('i', null, 'Cor'));
  const tem = atual.paint && atual.paint.materials && atual.paint.materials.length;
  box.hidden = !tem; if (!tem) return;
  CORES.forEach(([nome, rgb]) => {
    const s = el('button', 'c3d-cor'); s.type = 'button'; s.title = nome; s.setAttribute('aria-label', 'Cor ' + nome); s.setAttribute('aria-pressed', nome === 'Original');
    s.style.background = rgb ? 'rgb(' + rgb.map((v) => Math.round(v * 255)).join(',') + ')' : 'conic-gradient(#e33,#fc3,#3b5,#37d,#e33)';
    s.onclick = () => pintar(nome, rgb);
    box.appendChild(s);
  });
}
const originais = new WeakMap();
/* Modelos sem textura (argila) ganham um acabamento padrão de pintura metálica para a forma aparecer */
function aplicarAcabamento() {
  const a = atual && atual.acabamento; if (!a || !mv.model) return;
  const alvos = new Set(atual.paint.materials);
  mv.model.materials.filter((m) => alvos.has(m.name)).forEach((m) => { const p = m.pbrMetallicRoughness; p.setBaseColorFactor([a.rgb[0], a.rgb[1], a.rgb[2], 1]); p.setMetallicFactor(a.metal); p.setRoughnessFactor(a.rough); });
}
function pintar(nome, rgb) {
  document.querySelectorAll('#c3d-cores .c3d-cor').forEach((x) => x.setAttribute('aria-pressed', x.title === nome));
  if (!mv.model) return;
  if (explo.ativa && zonaAtual) setTimeout(() => { try { destacarZona(zonaAtual); } catch (er) {} }, 30);
  const alvos = new Set(atual.paint.materials);
  mv.model.materials.filter((m) => alvos.has(m.name)).forEach((m) => {
    const pbr = m.pbrMetallicRoughness;
    if (!originais.has(m)) originais.set(m, pbr.baseColorFactor.slice());
    if (rgb) pbr.setBaseColorFactor([rgb[0], rgb[1], rgb[2], 1]); else if (atual.acabamento) aplicarAcabamento(); else pbr.setBaseColorFactor(originais.get(m));
  });
}

mv.addEventListener('progress', (e) => { $('c3d-barra').style.width = Math.round((e.detail.totalProgress || 0) * 100) + '%'; });
mv.addEventListener('load', () => { if (zonaAtual) setTimeout(() => focarZona(zonaAtual), 250); prePrecarregar(); aplicarAcabamento(); $('c3d-carga').classList.add('off'); mv.cameraOrbit = vista(32, 74, 105); mv.jumpCameraToGoal(); });
mv.addEventListener('error', () => { $('c3d-carga-txt').textContent = 'Não foi possível carregar este modelo.'; $('c3d-barra').style.width = '0'; });

function prePrecarregar() {
  const vizinhos = carros.filter((c) => c.brand === atual.brand && c.id !== atual.id).slice(0, 2);
  setTimeout(() => vizinhos.forEach((c) => { try { fetch(BASE + '/assets/' + c.file, { priority: 'low' }).catch(() => {}); } catch (e) {} }), 2500);
}
function frenteTheta() { return TETA[(atual && atual.frente) || '+z']; }
function vista(dTheta, phi, raio) { return (frenteTheta() + dTheta) + 'deg ' + phi + 'deg ' + raio + '%'; }

/* Classifica o ponto clicado em uma zona do carro (coordenadas normalizadas no eixo do carro) */
function classificar(pos, nor) { return classificarBase(pos, nor, mv.getBoundingBoxCenter(), mv.getDimensions()); }
function classificarBase(pos, nor, c, d, estrito) {
  const f = (atual && atual.frente) || '+z';
  const ex = f[1] === 'x', sg = f[0] === '+' ? 1 : -1;
  const ln = ex ? d.x : d.z, la = ex ? d.z : d.x;
  const u = sg * ((ex ? pos.x - c.x : pos.z - c.z) / (ln / 2));
  const w = (ex ? pos.z - c.z : pos.x - c.x) / (la / 2);
  const v = (pos.y - (c.y - d.y / 2)) / d.y;
  const nu = sg * (ex ? nor.x : nor.z), nw = ex ? nor.z : nor.x, ny = nor.y;
  const lat = Math.abs(w), top = ny > 0.5;
  if (v < 0.42 && lat > 0.7 && Math.abs(nw) > 0.45 && Math.abs(u) > 0.22 && (!estrito || (lat > 0.8 && Math.abs(nw) > 0.7 && Math.abs(u) > 0.3 && Math.abs(u) < 0.85 && v < 0.4))) return 'rodas';
  if (u > 0.7 && v < 0.5 && nu > 0.25) return 'parachoque-d';
  if (u > 0.66 && v >= 0.38 && v < 0.74 && nu > 0.25 && lat > 0.35) return 'farol';
  if (u < -0.7 && v < 0.5 && nu < -0.25) return 'parachoque-t';
  if (u < -0.66 && v >= 0.38 && v < 0.78 && nu < -0.25) return 'lanterna';
  if (lat > 0.78 && v > 0.55 && v < 0.8 && u > 0.05 && u < 0.45 && Math.abs(nw) > 0.35) return 'retrovisor';
  if (top && v > 0.82) return 'teto';
  if (u > -0.05 && u < 0.5 && v > 0.55 && ny > 0.15 && ny <= 0.62 && nu > 0.2) return 'parabrisa';
  if (top && u > 0.2) return (estrito && lat > 0.78) ? null : 'capo';
  if (u < -0.25 && (top || nu < -0.3)) return (estrito && lat > 0.78) ? null : 'portamalas';
  if (Math.abs(nw) > 0.55) return (estrito && !(Math.abs(u) < 0.5 && v > 0.28 && v < 0.82)) ? null : 'portas';
  return estrito ? null : (u > 0 ? 'capo' : 'portamalas');
}

/* Clique x arraste: só conta como clique se o ponteiro quase não se moveu */
mv.addEventListener('pointerdown', (e) => { arrasto = { x: e.clientX, y: e.clientY, t: Date.now() }; });
mv.addEventListener('pointerup', (e) => {
  if (!arrasto || !mv.model) return;
  const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y, dt = Date.now() - arrasto.t; arrasto = null;
  if (dx * dx + dy * dy > 36 || dt > 600) return;
  const r = mv.getBoundingClientRect();
  const hit = mv.positionAndNormalFromPoint(e.clientX - r.left, e.clientY - r.top);
  if (!hit) return;
  const z = classificar(hit.position, hit.normal);
  const pin = mv.querySelector('.c3d-pin'); pin.hidden = false;
  mv.updateHotspot({ name: 'hotspot-pin', position: hit.position.toString(), normal: hit.normal.toString() });
  escolher(z, false);
});

const explo = { ativa: false, zona: null, restauros: [], pecas: [], mats: new Map(), ctl: null, pulso: null, offMundo: null };
const EXPL = {
  'capo': { u: 0.08, v: 0.62, w: 0 }, 'parabrisa': { u: 0.1, v: 0.55, w: 0 }, 'teto': { u: 0, v: 0.7, w: 0 }, 'portamalas': { u: -0.12, v: 0.62, w: 0 },
  'rodas': { u: 0, v: 0, w: 0.42 }, 'retrovisor': { u: 0.05, v: 0.12, w: 0.35 }, 'farol': { u: 0.22, v: 0.08, w: 0.2 }, 'lanterna': { u: -0.2, v: 0.06, w: 0.12 }
};
const REGIAO = {
  'capo': (u, v, w, nu, ny) => u > 0.2 && u < 0.72 && Math.abs(w) < 0.7 && v > 0.5 && ny > 0.35,
  'teto': (u, v, w, nu, ny) => v > 0.8 && u > -0.62 && u < 0.28 && Math.abs(w) < 0.82 && ny > 0.4,
  'parabrisa': (u, v, w, nu, ny) => u > 0 && u < 0.46 && v > 0.55 && Math.abs(w) < 0.8 && ny > 0.12 && ny < 0.78 && nu > 0.15,
  'farol': (u, v, w, nu, ny) => u > 0.72 && v > 0.4 && v < 0.74 && Math.abs(w) > 0.3 && nu > 0.25,
  'lanterna': (u, v, w, nu, ny) => u < -0.72 && v > 0.4 && v < 0.78 && Math.abs(w) > 0.3 && nu < -0.25,
  'portamalas': (u, v, w, nu, ny) => u < -0.26 && u > -0.8 && Math.abs(w) < 0.76 && v > 0.45 && (ny > 0.35 || nu < -0.45)
};
const ILHA = {
  'rodas': (i) => i.n > 40 && i.gy < 0.1 * i.H && i.sV > 0.22 * i.H && i.sV < 0.62 * i.H && i.sV / (i.sU || 1) > 0.7 && i.sV / (i.sU || 1) < 1.35 && i.sW < 0.8 * i.sV && i.cv < 0.42 && Math.abs(i.cw) > 0.55,
  'retrovisor': (i) => i.n > 10 && Math.abs(i.cw) > 0.6 && i.cv > 0.45 && i.cv < 0.92 && i.cu > -0.1 && i.cu < 0.62 && i.sU < 0.28 * i.L && i.sV < 0.3 * i.H,
  'farol': (i) => i.n > 20 && i.cu > 0.6 && i.cv > 0.35 && i.cv < 0.8 && Math.abs(i.cw) > 0.3 && i.sU < 0.3 * i.L && i.sV < 0.3 * i.H,
  'lanterna': (i) => i.n > 20 && i.cu < -0.6 && i.cv > 0.35 && i.cv < 0.8 && Math.abs(i.cw) > 0.3 && i.sU < 0.3 * i.L && i.sV < 0.3 * i.H
};
const LABEL_ZONA = { 'capo': 'Capô', 'teto': 'Teto', 'parabrisa': 'Parabrisa', 'portamalas': 'Porta-malas', 'rodas': 'Rodas', 'retrovisor': 'Retrovisores', 'farol': 'Faróis', 'lanterna': 'Lanternas' };
function simboloMV(nome) { return Object.getOwnPropertySymbols(mv).find((s) => s.description === nome); }
function renderizar() { const s = simboloMV('needsRender'); if (s && typeof mv[s] === 'function') { try { mv[s](); } catch (e) {} } }
function malhas() {
  const s = simboloMV('scene'); const cena = s && mv[s]; const l = [];
  if (cena && cena.traverse) cena.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position && !(o.userData && o.userData.c3dPeca)) l.push(o); });
  return l;
}
function numero(de, para, opc, fn) {
  if (MOTION && MOTION.animate) return MOTION.animate(de, para, Object.assign({ onUpdate: fn }, opc));
  const t0 = performance.now(), dur = ((opc && (opc.duration || opc.visualDuration)) || 0.8) * 1000; let parado = false;
  const passo = (agora) => { if (parado) return; const k = Math.min(1, (agora - t0) / dur), e = 1 - Math.pow(1 - k, 3); fn(de + (para - de) * e); if (k < 1) requestAnimationFrame(passo); };
  requestAnimationFrame(passo); return { stop() { parado = true; } };
}
function desfazerExplosao() {
  if (explo.ctl) { try { explo.ctl.stop(); } catch (e) {} explo.ctl = null; }
  if (explo.pulso) { try { explo.pulso.stop(); } catch (e) {} explo.pulso = null; }
  explo.pecas.forEach((p) => { if (p.peca.parent) p.peca.parent.remove(p.peca); try { p.peca.geometry.dispose(); p.peca.material.dispose(); } catch (e) {} });
  explo.restauros.forEach((r) => { if (r.indice !== undefined) r.malha.geometry.setIndex(r.indice); if (r.visivel !== undefined) r.malha.visible = r.visivel; });
  explo.mats.forEach((o, m) => { m.transparent = o.transparent; m.opacity = o.opacity; m.depthWrite = o.depthWrite; m.needsUpdate = true; });
  const tinha = explo.ativa;
  explo.pecas = []; explo.restauros = []; explo.mats = new Map(); explo.ativa = false; explo.zona = null; explo.offMundo = null;
  const et = mv.querySelector('.c3d-etq'); if (et) et.hidden = true;
  if (tinha) { try { mv.cameraTarget = 'auto auto auto'; } catch (e) {} renderizar(); }
}
function soldar(w) {
  const n = w.length / 3, id = new Int32Array(n), mapa = new Map();
  for (let i = 0; i < n; i++) { const k = Math.round(w[i * 3] * 10000) + '|' + Math.round(w[i * 3 + 1] * 10000) + '|' + Math.round(w[i * 3 + 2] * 10000); let r = mapa.get(k); if (r === undefined) { r = i; mapa.set(k, i); } id[i] = r; }
  return id;
}
function componentes(idx, nTri, id, lista) {
  const nV = id.length, pai = new Int32Array(nV); for (let i = 0; i < nV; i++) pai[i] = i;
  const raiz = (a) => { while (pai[a] !== a) { pai[a] = pai[pai[a]]; a = pai[a]; } return a; };
  const vt = (t, j) => id[idx ? idx[t * 3 + j] : t * 3 + j];
  const todos = lista || Array.from({ length: nTri }, (_, i) => i);
  for (let q = 0; q < todos.length; q++) { const t = todos[q]; const a = raiz(vt(t, 0)), b = raiz(vt(t, 1)), c = raiz(vt(t, 2)); if (a !== b) pai[a] = b; const b2 = raiz(b); if (c !== b2) pai[c] = b2; }
  const mapa = new Map();
  for (let q = 0; q < todos.length; q++) { const t = todos[q]; const r = raiz(vt(t, 0)); let l = mapa.get(r); if (!l) { l = []; mapa.set(r, l); } l.push(t); }
  return [...mapa.values()];
}
function destacarZona(z, forcaCaixa) {
  desfazerExplosao();
  const lista = malhas(); if (!lista.length || !atual || !EXPL[z]) return false;
  const f = atual.frente || '+z', ex = f[1] === 'x', sg = f[0] === '+' ? 1 : -1;
  const mundo = [], mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  lista.forEach((m) => {
    m.updateWorldMatrix(true, false);
    const p = m.geometry.attributes.position, e = m.matrixWorld.elements, n = p.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), w = p.getZ(i);
      const X = e[0] * x + e[4] * y + e[8] * w + e[12], Y = e[1] * x + e[5] * y + e[9] * w + e[13], Z = e[2] * x + e[6] * y + e[10] * w + e[14];
      a[i * 3] = X; a[i * 3 + 1] = Y; a[i * 3 + 2] = Z;
      if (X < mn[0]) mn[0] = X; if (Y < mn[1]) mn[1] = Y; if (Z < mn[2]) mn[2] = Z;
      if (X > mx[0]) mx[0] = X; if (Y > mx[1]) mx[1] = Y; if (Z > mx[2]) mx[2] = Z;
    }
    mundo.push(a);
  });
  const C = { x: (mn[0] + mx[0]) / 2, y: (mn[1] + mx[1]) / 2, z: (mn[2] + mx[2]) / 2 }, D = { x: mx[0] - mn[0], y: mx[1] - mn[1], z: mx[2] - mn[2] };
  const L = ex ? D.x : D.z, W = ex ? D.z : D.x, H = D.y;
  const quadro = (x, y, zz) => [sg * ((ex ? x - C.x : zz - C.z) / (L / 2)), (y - mn[1]) / H, (ex ? zz - C.z : x - C.x) / (W / 2)];
  const grupos = []; let somaC = [0, 0, 0], nC = 0;
  const ehIlha = !!ILHA[z] && !forcaCaixa;
  lista.forEach((m, k) => {
    const g = m.geometry, w = mundo[k], idx = g.index ? g.index.array : null, nTri = Math.floor((idx ? idx.length : g.attributes.position.count) / 3);
    const id = soldar(w), tv = (t, j) => (idx ? idx[t * 3 + j] : t * 3 + j);
    const escolhidos = new Map();
    if (ehIlha) {
      componentes(idx, nTri, id, null).forEach((tris) => {
        const imn = [1e9, 1e9, 1e9], imx = [-1e9, -1e9, -1e9];
        for (let q = 0; q < tris.length; q++) for (let j = 0; j < 3; j++) { const vi = tv(tris[q], j); for (let a = 0; a < 3; a++) { const c = w[vi * 3 + a]; if (c < imn[a]) imn[a] = c; if (c > imx[a]) imx[a] = c; } }
        const c = quadro((imn[0] + imx[0]) / 2, (imn[1] + imx[1]) / 2, (imn[2] + imx[2]) / 2);
        const info = { n: tris.length, L, H, gy: imn[1] - mn[1], cu: c[0], cv: c[1], cw: c[2], sU: ex ? imx[0] - imn[0] : imx[2] - imn[2], sV: imx[1] - imn[1], sW: ex ? imx[2] - imn[2] : imx[0] - imn[0] };
        if (!ILHA[z](info)) return;
        const lado = c[2] >= 0 ? 1 : -1, chave = z === 'rodas' ? lado + (c[0] >= 0 ? 'f' : 'r') : '' + lado;
        let l = escolhidos.get(chave); if (!l) { l = { lado, tris: [] }; escolhidos.set(chave, l); }
        for (let q = 0; q < tris.length; q++) l.tris.push(tris[q]);
      });
    } else {
      const sel = [];
      for (let t = 0; t < nTri; t++) {
        const i0 = tv(t, 0), i1 = tv(t, 1), i2 = tv(t, 2);
        const ax = w[i0 * 3], ay = w[i0 * 3 + 1], az = w[i0 * 3 + 2], bx = w[i1 * 3], by = w[i1 * 3 + 1], bz = w[i1 * 3 + 2], cx = w[i2 * 3], cy = w[i2 * 3 + 1], cz = w[i2 * 3 + 2];
        const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const ln = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= ln; ny /= ln; nz /= ln;
        const px = (ax + bx + cx) / 3, py = (ay + by + cy) / 3, pz = (az + bz + cz) / 3;
        if ((px - C.x) * nx + (py - C.y) * ny + (pz - C.z) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const q = quadro(px, py, pz), nu = sg * (ex ? nx : nz);
        if (REGIAO[z](q[0], q[1], q[2], nu, ny)) sel.push(t);
      }
      if (sel.length) {
        const comps = componentes(idx, nTri, id, sel); let maior = 0; comps.forEach((c) => { if (c.length > maior) maior = c.length; });
        comps.forEach((c) => {
          if (c.length < 0.18 * maior) return;
          const vi = tv(c[0], 0); const qq = quadro(w[vi * 3], w[vi * 3 + 1], w[vi * 3 + 2]);
          const lado = EXPL[z].w ? (qq[2] >= 0 ? 1 : -1) : 0; const chave = '' + lado;
          let l = escolhidos.get(chave); if (!l) { l = { lado, tris: [] }; escolhidos.set(chave, l); }
          for (let q = 0; q < c.length; q++) l.tris.push(c[q]);
        });
      }
    }
    if (!escolhidos.size) return;
    const marcados = new Uint8Array(nTri);
    escolhidos.forEach((l) => { for (let q = 0; q < l.tris.length; q++) marcados[l.tris[q]] = 1; });
    const fica = [];
    for (let t = 0; t < nTri; t++) if (!marcados[t]) fica.push(tv(t, 0), tv(t, 1), tv(t, 2));
    if (fica.length) { explo.restauros.push({ malha: m, indice: g.index || null }); g.setIndex(fica); }
    else { explo.restauros.push({ malha: m, visivel: m.visible }); m.visible = false; }
    escolhidos.forEach((l, chave) => {
      const ind = []; for (let q = 0; q < l.tris.length; q++) ind.push(tv(l.tris[q], 0), tv(l.tris[q], 1), tv(l.tris[q], 2));
      grupos.push({ malha: m, indices: ind, lado: l.lado, chave });
      for (let q = 0; q < l.tris.length; q++) { const vi = tv(l.tris[q], 0); somaC[0] += w[vi * 3]; somaC[1] += w[vi * 3 + 1]; somaC[2] += w[vi * 3 + 2]; nC++; }
    });
  });
  if (!grupos.length || nC < 12) { desfazerExplosao(); if (ILHA[z] && !forcaCaixa && REGIAO[z]) return destacarZona(z, true); return false; }
  const e = EXPL[z];
  grupos.forEach((gr) => {
    const m = gr.malha, geo = new m.geometry.constructor();
    for (const nome in m.geometry.attributes) geo.setAttribute(nome, m.geometry.attributes[nome]);
    geo.setIndex(gr.indices);
    const peca = m.clone(false); peca.geometry = geo; peca.material = m.material.clone(); peca.userData = { c3dPeca: true };
    if (peca.material.emissive) { peca.material.emissive.setRGB(0.25, 0.5, 1); peca.material.emissiveIntensity = 0.14; }
    m.parent.add(peca);
    const ox = ex ? sg * e.u * L : gr.lado * e.w * W, oy = e.v * H, oz = ex ? gr.lado * e.w * W : sg * e.u * L;
    const inv = m.parent.matrixWorld.clone().invert().elements;
    const lx = inv[0] * ox + inv[4] * oy + inv[8] * oz, ly = inv[1] * ox + inv[5] * oy + inv[9] * oz, lz = inv[2] * ox + inv[6] * oy + inv[10] * oz;
    explo.pecas.push({ peca, base: [peca.position.x, peca.position.y, peca.position.z], off: [lx, ly, lz] });
  });
  explo.offMundo = [ex ? sg * e.u * L : 0, e.v * H, ex ? 0 : sg * e.u * L];
  lista.forEach((m) => { const mats = Array.isArray(m.material) ? m.material : [m.material]; mats.forEach((mt) => { if (!explo.mats.has(mt)) { explo.mats.set(mt, { transparent: mt.transparent, opacity: mt.opacity, depthWrite: mt.depthWrite }); mt.transparent = true; mt.opacity = Math.min(mt.opacity, 0.14); mt.depthWrite = false; mt.needsUpdate = true; } }); });
  explo.ativa = true; explo.zona = z;
  const cM = mv.getBoundingBoxCenter(), dM = mv.getDimensions();
  const cen = [somaC[0] / nC, somaC[1] / nC, somaC[2] / nC];
  const paraModelo = (p) => [cM.x + (p[0] - C.x) * (dM.x / (D.x || 1)), cM.y + (p[1] - C.y) * (dM.y / (D.y || 1)), cM.z + (p[2] - C.z) * (dM.z / (D.z || 1))];
  const mod = paraModelo(cen), ow = explo.offMundo;
  const alvo = [(mod[0] * 0.7 + cM.x * 0.3) + 0.4 * ow[0] * (dM.x / (D.x || 1)), (mod[1] * 0.7 + cM.y * 0.3) + 0.4 * ow[1] * (dM.y / (D.y || 1)), (mod[2] * 0.7 + cM.z * 0.3) + 0.4 * ow[2] * (dM.z / (D.z || 1))];
  try { mv.cameraTarget = alvo[0] + 'm ' + alvo[1] + 'm ' + alvo[2] + 'm'; } catch (er) {}
  const topo = paraModelo([cen[0] + ow[0], cen[1] + ow[1] + 0.06 * H, cen[2] + ow[2]]);
  explo.ctl = numero(0, 1, { type: 'spring', bounce: 0.14, visualDuration: 0.95 }, (s) => {
    for (let i = 0; i < explo.pecas.length; i++) { const p = explo.pecas[i]; p.peca.position.set(p.base[0] + p.off[0] * s, p.base[1] + p.off[1] * s, p.base[2] + p.off[2] * s); }
    renderizar();
  });
  explo.pulso = numero(0.14, 0.34, { duration: 1.4, repeat: 2, repeatType: 'reverse', ease: 'easeInOut' }, (v) => { for (let i = 0; i < explo.pecas.length; i++) { const mt = explo.pecas[i].peca.material; if (mt.emissive) mt.emissiveIntensity = v; } renderizar(); });
  const et = mv.querySelector('.c3d-etq');
  if (et) {
    et.querySelector('b').textContent = LABEL_ZONA[z] || ZONAS[z].nome;
    try { mv.updateHotspot({ name: 'hotspot-etq', position: topo[0] + ' ' + topo[1] + ' ' + topo[2], normal: '0 1 0' }); } catch (er) {}
    et.hidden = false; et.style.opacity = '0';
    setTimeout(() => { if (explo.ativa) etiquetaEntra(et); }, 420);
  }
  return true;
}
function etiquetaEntra(et) {
  if (MOTION && MOTION.animate) MOTION.animate(et, { opacity: [0, 1], transform: ['translateY(8px) scale(.92)', 'translateY(0) scale(1)'] }, { type: 'spring', bounce: 0.2, visualDuration: 0.45 });
  else { et.style.opacity = '1'; }
}
function pararRotacao() { mv.removeAttribute('auto-rotate'); $('c3d-gira').setAttribute('aria-pressed', 'false'); }
function focarZona(z) {
  pararRotacao();
  const Z = ZONAS[z]; mv.cameraOrbit = vista(Z.cam[0], Z.cam[1], EXPL[z] ? Math.round(Z.cam[2] * 1.5) : Z.cam[2]);
  if (!EXPL[z]) { desfazerExplosao(); return; }
  setTimeout(() => { try { destacarZona(z); } catch (er) { desfazerExplosao(); } }, 60);
}

const mqCel = window.matchMedia('(max-width:720px)');
const gaveta = { estado: 'peek', arrasto: null };
function posGaveta() { const H = window.innerHeight, h = Math.round(H * 0.86); return { peek: h - 96, meio: h - Math.round(H * 0.5), cheio: 0 }; }
function aplicaY(y, animar) {
  const el = $('c3d-painel');
  if (MOTION && MOTION.animate) MOTION.animate(el, { y: y }, animar ? { type: 'spring', bounce: 0.1, visualDuration: 0.42 } : { duration: 0 });
  else el.style.transform = 'translateY(' + y + 'px)';
}
function irGaveta(estado, semAnim) {
  if (!mqCel.matches) return;
  gaveta.estado = estado; gaveta.y = posGaveta()[estado];
  aplicaY(gaveta.y, !semAnim);
  if (estado === 'meio' && !semAnim) { const rr = mv.getBoundingClientRect(); if (rr.top < 0 || rr.top > 40) window.scrollBy({ top: rr.top - 8, behavior: 'smooth' }); }
  if (estado === 'peek') { const pc = $('c3d-pc'); if (pc) pc.scrollTop = 0; }
}
function iniciarGaveta() {
  const painel = $('c3d-painel'), alca = $('c3d-alca'), cab = painel.querySelector('.c3d-ph');
  const comeca = (e) => {
    if (!mqCel.matches) return;
    gaveta.arrasto = { y0: e.clientY, base: gaveta.y, t0: performance.now(), ult: e.clientY, tU: performance.now(), v: 0, moveu: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) {}
  };
  const move = (e) => {
    const a = gaveta.arrasto; if (!a) return;
    const dy = e.clientY - a.y0; if (Math.abs(dy) > 4) a.moveu = true;
    const lim = posGaveta(); let y = Math.min(lim.peek, Math.max(0, a.base + dy));
    const agora = performance.now(); a.v = (e.clientY - a.ult) / Math.max(1, agora - a.tU); a.ult = e.clientY; a.tU = agora;
    gaveta.y = y; painel.style.transform = 'translateY(' + y + 'px)';
  };
  const fim = () => {
    const a = gaveta.arrasto; if (!a) return; gaveta.arrasto = null;
    if (!a.moveu) { irGaveta(gaveta.estado === 'peek' ? 'meio' : (gaveta.estado === 'meio' ? 'cheio' : 'meio')); return; }
    const lim = posGaveta(); const alvo = gaveta.y + a.v * 220;
    let melhor = 'peek', dist = 1e9;
    ['peek', 'meio', 'cheio'].forEach((k) => { const d = Math.abs(lim[k] - alvo); if (d < dist) { dist = d; melhor = k; } });
    irGaveta(melhor);
  };
  [alca, cab].forEach((el) => { el.addEventListener('pointerdown', comeca); el.addEventListener('pointermove', move); el.addEventListener('pointerup', fim); el.addEventListener('pointercancel', fim); });
  const raiz = $('c3d');
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { es.forEach((x) => raiz.classList.toggle('c3d-vivo', x.isIntersecting)); }, { threshold: 0.12 }).observe(raiz);
  else raiz.classList.add('c3d-vivo');
  const ajusta = () => { if (mqCel.matches) irGaveta(gaveta.estado, true); else { painel.style.transform = ''; } };
  window.addEventListener('resize', ajusta); if (mqCel.addEventListener) mqCel.addEventListener('change', ajusta);
  ajusta();
}

function marcarZona(z) {
  document.querySelectorAll('.c3d-mapa .z').forEach((g) => g.classList.toggle('on', g.dataset.z === z));
  document.querySelectorAll('.c3d-zonas button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.z === z));
}

function escolher(z, mover) {
  zonaAtual = z; marcarZona(z); $('c3d-dica').classList.add('off'); sincronizarUrl(z); track('c3d_parte', { carro: atual.id, parte: z, origem: mover ? 'lista' : 'clique3d' });
  const Z = ZONAS[z];
  if (mover || EXPLODE[z]) mv.querySelector('.c3d-pin').hidden = true; focarZona(z); irGaveta('meio');
  mostrarPecas(z);
}

function painelInicial() {
  marcarZona(null); $('c3d-voltar').hidden = true; mv.querySelector('.c3d-pin').hidden = true;
  $('c3d-ph-tag').textContent = 'Peças compatíveis';
  $('c3d-ph-tit').textContent = atual.brand + ' ' + atual.model; entradaTitulo();
  $('c3d-ph-sub').textContent = 'Clique em uma parte do carro ou escolha abaixo.';
  const box = $('c3d-pc'); box.textContent = '';
  const g = el('div', 'c3d-zonas');
  Object.keys(ZONAS).forEach((k) => { const b = el('button', null, ZONAS[k].nome); b.type = 'button'; b.dataset.z = k; b.setAttribute('aria-pressed', 'false'); b.onclick = () => escolher(k, true); g.appendChild(b); });
  box.appendChild(g);
  const q = atual.brand + ' ' + atual.model;
  $('c3d-ver').hidden = true;
  const vm = $('c3d-ver-modelo'); vm.hidden = false; vm.href = urlBusca(q); vm.textContent = 'Ver peças do ' + atual.model;
}

const RELACIONADAS = {
  'capo': ['farol', 'parachoque-d', 'parabrisa'], 'parachoque-d': ['farol', 'capo', 'rodas'], 'farol': ['parachoque-d', 'capo', 'lanterna'],
  'parabrisa': ['teto', 'retrovisor', 'capo'], 'teto': ['parabrisa', 'portas', 'portamalas'], 'portas': ['retrovisor', 'rodas', 'teto'],
  'retrovisor': ['portas', 'parabrisa', 'farol'], 'rodas': ['portas', 'parachoque-d', 'parachoque-t'], 'portamalas': ['lanterna', 'parachoque-t', 'teto'],
  'lanterna': ['portamalas', 'parachoque-t', 'farol'], 'parachoque-t': ['lanterna', 'portamalas', 'rodas']
};
function relacionadas(z, box) {
  const lista = RELACIONADAS[z]; if (!lista) return;
  const w = el('div', 'c3d-rel'); w.appendChild(el('span', null, 'Quem procura ' + ZONAS[z].nome.toLowerCase() + ' também procura'));
  const c = el('div', 'c3d-rel-c');
  lista.forEach((k) => { const b = el('button', 'c3d-chip', ZONAS[k].nome); b.type = 'button'; b.onclick = () => escolher(k, true); c.appendChild(b); });
  w.appendChild(c); box.appendChild(w);
}
const cacheOg = {};
async function imagemOriginal(url) {
  if (cacheOg[url] !== undefined) return cacheOg[url];
  let u = '';
  try {
    const r = await fetch(url, { credentials: 'same-origin' }); const buf = await r.arrayBuffer(); let html;
    try { html = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { html = new TextDecoder('windows-1252').decode(buf); }
    const og = new DOMParser().parseFromString(html, 'text/html').querySelector('meta[property="og:image"]');
    u = (og && og.getAttribute('content')) || '';
  } catch (e) {}
  cacheOg[url] = u; return u;
}
function definirImagem(ft, p) {
  const aplica = (u) => { ft.dataset.src = u; ft.style.backgroundImage = 'url("' + u.replace(/"/g, '%22') + '")'; };
  aplica(p.img);
  const t = new Image();
  t.onerror = () => { imagemOriginal(p.url).then((u) => { if (u && seguro(u)) aplica(u); }); };
  t.src = p.img;
}
function entradaLista(ul) {
  if (!MOTION || !MOTION.animate) return;
  MOTION.animate(ul.children, { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'] }, { delay: MOTION.stagger(0.05), duration: 0.38, ease: 'easeOut' });
}
function entradaTitulo() {
  if (!MOTION || !MOTION.animate) return;
  MOTION.animate([$('c3d-ph-tit'), $('c3d-ph-sub')], { opacity: [0, 1], transform: ['translateX(-10px)', 'translateX(0px)'] }, { delay: MOTION.stagger(0.06), duration: 0.35, ease: 'easeOut' });
}
function abrirLightbox(src, nome) {
  const lb = $('c3d-lb'); const im = lb.querySelector('img'); im.src = src; im.alt = nome; lb.hidden = false;
  if (MOTION && MOTION.animate) { MOTION.animate(lb, { opacity: [0, 1] }, { duration: 0.2 }); MOTION.animate(im, { transform: ['scale(.86)', 'scale(1)'], opacity: [0, 1] }, { type: 'spring', bounce: 0.18, visualDuration: 0.4 }); } track('c3d_ampliar', { produto: nome });
}
function fecharLightbox() { const lb = $('c3d-lb'); lb.hidden = true; lb.querySelector('img').removeAttribute('src'); }
async function adicionarCarrinho(pid, btn, p) {
  const antes = btn.textContent; btn.disabled = true; btn.textContent = 'Adicionando...';
  try {
    const r = await fetch('/cart/add', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'ajaxSubmit': 'true', 'Accept': 'application/json' }, body: 'pid=' + encodeURIComponent(pid) + '&quantity=1' });
    const j = await r.json();
    if (j && j.error) throw new Error(j.error);
    btn.textContent = 'Adicionado \u2713'; btn.classList.add('ok'); track('c3d_carrinho', { carro: atual.id, produto: p.nome });
    if (typeof window.isbCarrinhoAdicionado === 'function') window.isbCarrinhoAdicionado(j); else if (j && j.change_url && j.url) location.href = j.url;
    setTimeout(() => { btn.disabled = false; btn.textContent = antes; btn.classList.remove('ok'); }, 2500);
  } catch (e) {
    btn.disabled = false; btn.textContent = antes; location.href = p.url;
  }
}
function zapLoja() {
  const h = [...document.querySelectorAll('a[href]')].map((x) => x.getAttribute('href') || '').find((u) => /wa\.me\/\d+|whatsapp\.com\/send\/?\?phone=\d+/.test(u));
  const m = h && h.match(/(\d{10,15})/); return m ? m[1] : '';
}
const normaliza = (t) => semAcento(String(t || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
function abrirPorNome() {
  const msg = $('c3d-bc-msg'); const txt = $('c3d-bc').value.trim();
  if (!txt) { msg.textContent = 'Digite o nome do carro (ex.: Argo 2019).'; return; }
  const am = txt.match(/\b(?:19|20)\d{2}\b/); const resto = normaliza(txt.replace(/\b(?:19|20)\d{2}\b/, ''));
  let melhor = null, pontos = 0;
  carros.forEach((c) => { const m = normaliza(c.model), b = normaliza(c.brand); let p = 0; if (resto.includes(m)) p += 10 + m.length; if (resto.includes(b)) p += 3; if (m.includes(resto) && resto.length > 1) p += 5; if (p > pontos) { pontos = p; melhor = c; } });
  if (!melhor) { msg.textContent = 'Ainda não temos o 3D desse modelo. Use as marcas abaixo ou a busca da loja.'; track('c3d_nome_sem_modelo', { texto: txt }); return; }
  if (am) { ano = am[0]; guardar('c3d_ano2', ano); setAnoSel(); }
  msg.textContent = 'Abrindo ' + melhor.brand + ' ' + melhor.model + (ano ? ' ' + ano : '');
  abrir(melhor); track('c3d_nome', { carro: melhor.id });
}
async function buscarPlaca() {
  const msg = $('c3d-placa-msg'); const placa = $('c3d-placa-in').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(placa)) { msg.textContent = 'Digite uma placa válida (ex.: ABC1D23).'; return; }
  msg.textContent = 'Consultando...'; track('c3d_placa', {});
  try {
    const r = await fetch(PLACA_API.replace('{placa}', encodeURIComponent(placa)), { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('http-' + r.status);
    const d = await r.json();
    const marca = d.marca || d.brand || d.MARCA || '', modelo = d.modelo || d.model || d.MODELO || '', anoV = d.ano || d.anoModelo || d.year || d.ANO || '';
    const mb = normaliza(marca), mm = normaliza(modelo);
    const achado = carros.find((c) => mb.includes(normaliza(c.brand)) && mm.includes(normaliza(c.model)));
    if (anoV && /^\d{4}/.test(String(anoV))) { ano = String(anoV).slice(0, 4); guardar('c3d_ano2', ano); setAnoSel(); }
    if (achado) { msg.textContent = 'Encontramos: ' + achado.brand + ' ' + achado.model + (ano ? ' ' + ano : ''); abrir(achado); }
    else { msg.textContent = 'Ainda não temos o 3D de ' + (marca + ' ' + modelo).trim() + '. Busque as peças na loja.'; }
  } catch (e) { msg.textContent = 'Não foi possível consultar a placa agora.'; }
}

async function mostrarPecas(z) {
  const Z = ZONAS[z], meu = ++seq;
  $('c3d-voltar').hidden = false;
  $('c3d-ph-tag').textContent = 'Peças para ' + atual.brand + ' ' + atual.model;
  $('c3d-ph-tit').textContent = Z.nome; entradaTitulo();
  $('c3d-ph-sub').textContent = 'Buscando na loja\u2026';
  const box = $('c3d-pc'); box.textContent = '';
  const lista = el('div', 'c3d-lista'); for (let i = 0; i < 4; i++) lista.appendChild(el('div', 'c3d-esq')); box.appendChild(lista);
  const ts = semAcento(Z.termo), mo = semAcento(atual.model), ms = semHifen(mo), br = semAcento(atual.brand);
  const cand = [[ts + ' ' + ms, 'modelo'], [ts + ' ' + mo, 'modelo'], [ts + ' ' + br + ' ' + mo, 'modelo'], [ts + ' ' + br, 'marca'], [ts, 'geral']];
  const vistos = new Set(), qs = cand.filter((c) => { const k = c[0].toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; });
  const verTodas = $('c3d-ver'); verTodas.hidden = false; verTodas.href = urlBusca(qs[0][0]); verTodas.textContent = 'Ver todas: ' + Z.nome.toLowerCase();
  const vm = $('c3d-ver-modelo'); vm.hidden = false; vm.href = urlBusca(atual.brand + ' ' + atual.model); vm.textContent = 'Todas as peças do ' + atual.model;
  const dv = $('c3d-duvida'); if (WHATSAPP) { dv.hidden = false; dv.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Olá! Preciso de ' + Z.nome.toLowerCase() + ' para ' + atual.brand + ' ' + atual.model + (ano ? ' ' + ano : '') + '.'); }
  let prods = [], tipo = '', falhou = false;
  try {
    for (let i = 0; i < qs.length; i++) { prods = await buscar(qs[i][0]); if (meu !== seq) return; if (prods.length) { tipo = qs[i][1]; break; } }
  } catch (e) { falhou = true; }
  if (meu !== seq) return;
  box.textContent = '';
  if (falhou) {
    const v = el('div', 'c3d-vazio'); v.appendChild(el('strong', null, 'Busca indisponível no momento')); v.appendChild(document.createTextNode('Use o botão abaixo para ver as peças direto na loja.')); box.appendChild(v);
    $('c3d-ph-sub').textContent = 'Não foi possível carregar a lista.'; track('c3d_busca_erro', { carro: atual.id, parte: z }); return;
  }
  if (!prods.length) {
    const v = el('div', 'c3d-vazio'); v.appendChild(el('strong', null, 'Nenhuma peça encontrada')); v.appendChild(document.createTextNode('Ainda não há ' + Z.nome.toLowerCase() + ' cadastrado para o ' + atual.model + '. Veja as demais peças do modelo ou fale com a gente.'));
    if (WHATSAPP) { const w = el('a', 'c3d-btn c3d-zap', 'Pedir esta peça no WhatsApp'); w.style.marginTop = '14px'; w.target = '_blank'; w.rel = 'noopener'; w.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Olá! Procuro ' + Z.nome.toLowerCase() + ' para ' + atual.brand + ' ' + atual.model + (ano ? ' ' + ano : '') + '.'); v.appendChild(w); }
    box.appendChild(v); relacionadas(z, box);
    $('c3d-ph-sub').textContent = '0 produtos'; track('c3d_sem_resultado', { carro: atual.id, parte: z, ano: ano || '' }); return;
  }
  track('c3d_resultados', { carro: atual.id, parte: z, quantidade: prods.length, nivel: tipo });
  $('c3d-ph-sub').textContent = prods.length + (prods.length > 1 ? ' produtos' : ' produto') + (tipo === 'modelo' ? (prods.length > 1 ? ' compatíveis' : ' compatível') + ' com o ' + atual.model : tipo === 'marca' ? ' da marca ' + atual.brand + ' (confira a compatibilidade)' : ' relacionados (confira a compatibilidade)');
  const ul = el('ul', 'c3d-lista');
  prods.forEach((p, i) => {
    if (!seguro(p.url)) return;
    const li = el('li', 'c3d-item'); li.style.animationDelay = (i * 40) + 'ms';
    const a = el('a', 'c3d-prod'); a.href = p.url;
    a.addEventListener('click', () => track('c3d_produto', { carro: atual.id, parte: z, produto: p.nome, url: p.url }));
    const ft = el('div', 'c3d-foto');
    const temImg = seguro(p.img) && p.img;
    if (temImg) definirImagem(ft, p);
    else ft.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>';
    a.appendChild(ft);
    const tx = el('div'); tx.appendChild(el('strong', null, p.nome));
    const bd = el('div', 'c3d-sel-bd');
    const a1 = numPreco(p.preco), a0 = numPreco(p.preco_de);
    if (a1 && a0 && a0 > a1) bd.appendChild(el('span', 'c3d-bd off', '-' + Math.round((1 - a1 / a0) * 100) + '%'));
    if (ano) { const fx = faixaAno(p.nome); const serve = fx && +ano >= fx[0] && +ano <= fx[1]; bd.appendChild(el('span', 'c3d-bd ' + (serve ? 'ok' : 'chk'), serve ? 'Serve no ' + ano : 'Confira o ano')); }
    if (bd.children.length) tx.appendChild(bd);
    if (p.preco) { const pr = el('div', 'c3d-preco'); if (p.preco_de) pr.appendChild(el('s', null, p.preco_de)); pr.appendChild(document.createTextNode(p.preco)); tx.appendChild(pr); }
    a.appendChild(tx); li.appendChild(a);
    if (temImg) { const zb = el('button', 'c3d-zoom'); zb.type = 'button'; zb.title = 'Ampliar foto'; zb.setAttribute('aria-label', 'Ampliar foto de ' + p.nome); zb.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>'; zb.onclick = () => abrirLightbox(ft.dataset.src || p.img, p.nome); li.appendChild(zb); }
    const acoes = el('div', 'c3d-acoes');
    const pid = (p.url.match(/-p(\d+)(?:[\/?#]|$)/) || [])[1];
    const compravel = a1 && a1 > 0 && pid;
    if (compravel) { const cb = el('button', 'c3d-add', 'Adicionar ao carrinho'); cb.type = 'button'; cb.onclick = () => adicionarCarrinho(pid, cb, p); acoes.appendChild(cb); }
    else { const vb = el('a', 'c3d-add sec', 'Consultar valor'); vb.href = p.url; acoes.appendChild(vb); }
    li.appendChild(acoes);
    ul.appendChild(li);
  });
  box.appendChild(ul);
  entradaLista(ul);
  relacionadas(z, box);
}

document.querySelectorAll('.c3d-mapa .z').forEach((g) => { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', ZONAS[g.dataset.z].nome); g.onclick = () => escolher(g.dataset.z, true); g.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(g.dataset.z, true); } }; });
function voltarPartes() { seq++; zonaAtual = null; desfazerExplosao(); irGaveta('peek'); sincronizarUrl(null); painelInicial(); mv.cameraOrbit = vista(32, 74, 105); $('c3d-dica').classList.remove('off'); }
$('c3d-voltar').onclick = voltarPartes;
document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!$('c3d-lb').hidden) { fecharLightbox(); return; } if (!$('c3d-voltar').hidden) voltarPartes(); });
$('c3d-lb').onclick = (e) => { if (e.target === $('c3d-lb') || e.target.id === 'c3d-lb-x') fecharLightbox(); };
carros.forEach((c) => { const o = document.createElement('option'); o.value = c.brand + ' ' + c.model; $('c3d-bc-lista').appendChild(o); });
$('c3d-bc-ok').onclick = abrirPorNome; $('c3d-bc').onkeydown = (e) => { if (e.key === 'Enter') abrirPorNome(); };
if (PLACA_API) { $('c3d-placa').hidden = false; $('c3d-placa-ok').onclick = buscarPlaca; $('c3d-placa-in').onkeydown = (e) => { if (e.key === 'Enter') buscarPlaca(); }; }
$('c3d-gira').onclick = () => { const on = mv.hasAttribute('auto-rotate'); if (on) mv.removeAttribute('auto-rotate'); else mv.setAttribute('auto-rotate', ''); $('c3d-gira').setAttribute('aria-pressed', !on); };
$('c3d-reset').onclick = () => { mv.cameraOrbit = vista(32, 74, 105); mv.querySelector('.c3d-pin').hidden = true; };

for (let a = 2026; a >= 2000; a--) { const o = el('option', null, String(a)); o.value = String(a); $('c3d-ano').appendChild(o); }
setAnoSel();
$('c3d-ano').onchange = () => { ano = $('c3d-ano').value === 'todos' ? '' : $('c3d-ano').value; guardar('c3d_ano2', ano || null); mostrarGaragem(); sincronizarUrl(zonaAtual); track('c3d_ano2', { ano: ano || '' }); if (zonaAtual) mostrarPecas(zonaAtual); };
$('c3d-garagem-esq').onclick = () => { guardar('c3d_carro', null); guardar('c3d_ano2', null); ano = ''; setAnoSel(); $('c3d-garagem').hidden = true; };
$('c3d-copiar').onclick = async () => {
  const b = $('c3d-copiar'); let ok = false;
  try { await navigator.clipboard.writeText(location.href); ok = true; } catch (e) { try { const t = document.createElement('textarea'); t.value = location.href; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch (e2) {} }
  b.textContent = ok ? 'Link copiado \u2713' : 'Copie da barra do navegador'; setTimeout(() => { b.textContent = 'Copiar link'; }, 2200); track('c3d_compartilhar', { canal: 'copiar' });
};
$('c3d-zap').addEventListener('click', () => track('c3d_compartilhar', { canal: 'whatsapp' }));
montarMarcas();
iniciarGaveta();
const prm = new URLSearchParams(location.search);
const pAno = prm.get('ano'); if (pAno && /^\d{4}$/.test(pAno)) { ano = pAno; setAnoSel(); }
const inicial = carros.find((c) => c.id === prm.get('carro')) || carros.find((c) => c.id === ler('c3d_carro')) || carros[0];
abrir(inicial);
const pParte = prm.get('parte'); if (pParte && ZONAS[pParte]) escolher(pParte, true);

