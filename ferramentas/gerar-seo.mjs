#!/usr/bin/env node
/* Gerador de páginas estáticas de SEO (por veículo e por peça) + sitemap.xml + robots.txt.
 *
 *   node gerar-seo.mjs --catalogo catalogo.json --config loja.config.json --saida ./seo [--nomes nomes-pecas.json] [--detalhes]
 *
 * Bloco opcional no loja.config.json:
 *   "seo": { "dominio": "https://www.minhaloja.com.br", "pasta": "pecas", "titulo": "...", "descricao": "..." }
 *
 * Saída (dentro de --saida):
 *   /<pasta>/index.html                      índice por marca e modelo
 *   /<pasta>/<veiculo-id>/index.html         página do veículo
 *   /<pasta>/<veiculo-id>/<peca-slug>.html   página da peça para o veículo (só se houver produto compatível/universal)
 *   /sitemap.xml  /robots.txt
 * Sem dependências externas (Node 20+).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ---------- argumentos ---------- */
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const flag = (n) => argv.includes('--' + n);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const aCatalogo = arg('catalogo'), aConfig = arg('config'), aSaida = arg('saida') || './seo';
const aNomes = arg('nomes') || path.join(aqui, 'nomes-pecas.json');
if (!aCatalogo || !aConfig || flag('ajuda') || flag('help')) {
  console.log('Uso: node gerar-seo.mjs --catalogo catalogo.json --config loja.config.json --saida ./seo [--nomes nomes-pecas.json] [--detalhes]');
  process.exit(aCatalogo && aConfig ? 0 : 1);
}
const lerJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const cat = lerJson(aCatalogo);
const cfg = lerJson(aConfig);
let nomes = {};
try { nomes = lerJson(aNomes); } catch { console.warn('Aviso: não foi possível ler os nomes das peças em ' + aNomes + ' (as peças sem nome serão ignoradas).'); }

/* ---------- configuração ---------- */
const lojaNome = (cfg.loja && cfg.loja.nome) || 'Loja de autopeças';
const whats = ((cfg.loja && cfg.loja.whatsapp) || '').replace(/\D/g, '');
const pagina3d = (cfg.loja && cfg.loja.pagina3d) || '';
const acento = (cfg.tema && cfg.tema.acento) || '#f5a623';
const seo = cfg.seo || {};
let dominio = String(seo.dominio || '').replace(/\/+$/, '');
if (!dominio) { dominio = 'https://www.exemplo.com.br'; console.warn('Aviso: "seo.dominio" ausente no config; usando ' + dominio + ' (ajuste antes de publicar).'); }
const pasta = String(seo.pasta || 'pecas').replace(/^\/+|\/+$/g, '');
const moeda = cat.moeda || 'BRL';
const hoje = new Date().toISOString().slice(0, 10);
const lastmod = /^\d{4}-\d{2}-\d{2}/.test(cat.gerado || '') ? cat.gerado.slice(0, 10) : hoje;
const tituloIdx = seo.titulo || 'Peças automotivas por veículo';
const descIdx = seo.descricao || 'Encontre peças para o seu carro por marca e modelo, com preço e compatibilidade.';

/* ---------- utilitários ---------- */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// JSON-LD dentro de <script>: impede fechar a tag e quebras de linha unicode
const jsonld = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const abs = (u) => !u ? '' : /^https?:\/\//i.test(u) ? u : /^\/\//.test(u) ? 'https:' + u : dominio + (u.startsWith('/') ? '' : '/') + u;
const num = (p) => {
  if (p == null || p === '') return null;
  if (typeof p === 'number') return p;
  let s = String(p).replace(/[^\d.,]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s); return isFinite(n) && n > 0 ? n : null;
};
const brl = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cortar = (s, max) => {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const c = s.slice(0, max - 1); const i = c.lastIndexOf(' ');
  return (i > max * 0.6 ? c.slice(0, i) : c).replace(/[ ,;:.\-–]+$/, '') + '…';
};
const anosTxt = (a) => Array.isArray(a) && a.length >= 2 && a[0] ? (a[0] === a[1] ? String(a[0]) : a[0] + ' a ' + a[1]) : '';
const unicos = (a) => [...new Set(a)];

/* ---------- classificação por sistema (textos variados por tipo de peça) ---------- */
const SISTEMAS = [
  { re: /freio|pastilha|disco-freio|pinca|cubo|abs/, rotulo: 'Freios', funcao: 'reduz a velocidade e para o veículo com segurança', sinais: 'ruído metálico ao frear, pedal baixo ou vibração no volante', cuidado: 'Troque sempre em pares no mesmo eixo e revise o fluido de freio.' },
  { re: /suspensao|amortec|mola|coxim|bandeja|bieleta|estabiliz|barra|pivo|manga|batente|lift|terminal-dir/, rotulo: 'Suspensão e direção', funcao: 'mantém a estabilidade, o conforto e o contato dos pneus com o solo', sinais: 'batidas em buracos, carro "balançando" ou desgaste irregular dos pneus', cuidado: 'Após a troca, faça o alinhamento e o balanceamento.' },
  { re: /direcao|cremalheira|caixa-dir/, rotulo: 'Suspensão e direção', funcao: 'garante precisão e leveza ao esterçar o volante', sinais: 'folga no volante, ruídos ao virar ou vazamento de fluido', cuidado: 'Confira o alinhamento depois do serviço.' },
  { re: /arref|radiador|termostato|bomba-agua|bomba-dagua|ventoinha|reservatorio|resfriador|mangueira/, rotulo: 'Arrefecimento', funcao: 'controla a temperatura do motor e evita o superaquecimento', sinais: 'ponteiro de temperatura subindo, perda de líquido ou ventoinha que não liga', cuidado: 'Use o aditivo indicado pelo fabricante e sangre o sistema após a troca.' },
  { re: /embreagem|cambio|cardan|diferencial|semi-?eixo|transmiss/, rotulo: 'Transmissão', funcao: 'transmite a força do motor às rodas', sinais: 'dificuldade para engatar marchas, patinação ou ruídos na troca', cuidado: 'Em geral convém trocar o kit completo em vez de peças isoladas.' },
  { re: /escapamento|catalisador|sonda|silencioso|coletor-esc/, rotulo: 'Escapamento', funcao: 'conduz e trata os gases do motor, reduzindo ruído e emissões', sinais: 'barulho excessivo, cheiro de combustível ou luz de injeção acesa', cuidado: 'Verifique vazamentos e a sonda lambda ao trocar o catalisador.' },
  { re: /alternador|bateria|partida|bobina|vela|sensor|borboleta|solenoide|chicote|eletric|sol-|soe-|corte-sensor/, rotulo: 'Elétrica e injeção', funcao: 'alimenta o sistema elétrico e controla a injeção e a ignição', sinais: 'falhas na partida, luzes de painel acesas ou marcha lenta irregular', cuidado: 'Desconecte a bateria antes de qualquer troca elétrica.' },
  { re: /turbo|compressor|wastegate|cartucho|junta|cabecote|valvula|motor|correia|distribuicao|tensor|oleo|pistao/, rotulo: 'Motor', funcao: 'compõe o conjunto que gera a potência do veículo', sinais: 'perda de desempenho, fumaça, consumo de óleo ou ruídos no motor', cuidado: 'Siga o torque e o intervalo de revisão do manual do fabricante.' },
  { re: /farol|lanterna|lampada|pisca|retrovisor/, rotulo: 'Iluminação e visibilidade', funcao: 'garante visibilidade e sinalização para você e para os outros motoristas', sinais: 'lente trincada, umidade interna, luz fraca ou ajuste fora de posição', cuidado: 'Regule o facho depois de instalar o farol.' },
  { re: /palheta|limpador|parabrisa|vidro/, rotulo: 'Visibilidade', funcao: 'mantém o para-brisa limpo e a visão desobstruída em dias de chuva', sinais: 'riscos no vidro, ruído ou áreas que ficam sem limpar', cuidado: 'Troque as palhetas a cada 6 a 12 meses.' },
  { re: /capo|parachoque|porta|teto|portamalas|paralama|grade|carroceria|macaneta|fechadura/, rotulo: 'Carroceria', funcao: 'forma a estrutura externa e a proteção do veículo', sinais: 'amassados, trincas, desalinhamento ou corrosão', cuidado: 'Confira o ajuste e o encaixe antes da pintura.' },
  { re: /roda|pneu|calota/, rotulo: 'Rodas e pneus', funcao: 'é o único ponto de contato do carro com o solo', sinais: 'desgaste irregular, bolhas ou vibração', cuidado: 'Respeite a medida e o índice de carga indicados.' },
];
const SIS_PADRAO = { rotulo: 'Outras peças', funcao: 'faz parte do conjunto mecânico do veículo', sinais: 'ruídos, falhas ou desgaste visível', cuidado: 'Confirme o código da peça original antes de comprar.' };
const sistemaDe = (chave) => SISTEMAS.find((s) => s.re.test(chave)) || SIS_PADRAO;

/* ---------- dados ---------- */
const veiculos = (cat.veiculos || []).filter((v) => v && v.id && v.marca && v.modelo);
const produtos = (cat.produtos || []).filter((p) => p && p.nome && p.url);
const pecaIgnorada = (k) => /^corte-/.test(k); // chaves de simulação em corte (3D), sem sentido para busca
const urlVeiculo = (v) => `/${pasta}/${v.id}/`;
const semNome = new Set();
const usadas = new Set(); // chaves de peça que geraram ao menos uma página/grupo

function pecasDoVeiculo(v) {
  const prods = produtos.filter((p) => p.universal || (p.veiculos || []).includes(v.id));
  // agrupa por NOME amigável: chaves diferentes com o mesmo nome (ex.: radiador / radiador-arref) viram uma só página
  const porChave = new Map(); const chavePorNome = new Map(); const aliasDe = new Map();
  for (const p of prods) for (const k of p.pecas || []) {
    if (pecaIgnorada(k)) continue;
    if (!nomes[k]) { semNome.add(k); continue; }
    usadas.add(k);
    const kk = chavePorNome.get(nomes[k]) || k; chavePorNome.set(nomes[k], kk);
    if (!porChave.has(kk)) porChave.set(kk, []);
    if (!porChave.get(kk).includes(p)) porChave.get(kk).push(p);
  }
  // une chaves que listam exatamente os mesmos produtos (evita páginas duplicadas); a primeira vira a principal
  const grupos = new Map();
  for (const [k, lista] of porChave) {
    const assin = lista.map((p) => p.id).sort().join('|');
    if (!grupos.has(assin)) grupos.set(assin, { chave: k, chaves: [k], produtos: lista });
    else grupos.get(assin).chaves.push(k);
  }
  const usados = new Set(); const pecas = [];
  for (const g of grupos.values()) {
    const nome = nomes[g.chave];
    let s = slug(nome) || slug(g.chave);
    if (usados.has(s)) s += '-' + slug(g.chave);
    usados.add(s);
    g.chaves.forEach((k) => usadas.add(k));
    pecas.push({ chave: g.chave, nome, slug: s, aliases: unicos(g.chaves.slice(1).map((k) => nomes[k]).filter((n) => n && n !== nome)), produtos: g.produtos, sistema: sistemaDe(g.chave) });
  }
  pecas.sort((a, b) => a.sistema.rotulo.localeCompare(b.sistema.rotulo, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { prods, pecas };
}

/* ---------- blocos de HTML ---------- */
const CSS = `:root{--ac:${acento};--bg:#0f1115;--card:#171a21;--bd:#262b35;--tx:#e8eaee;--mu:#9aa3b2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:var(--ac)}header,main,footer{max-width:980px;margin:0 auto;padding:16px}
header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--bd)}
.marca{font-weight:700;color:var(--tx);text-decoration:none}nav.bc{font-size:.85rem;color:var(--mu)}nav.bc ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px}
nav.bc li+li::before{content:"›";margin-right:4px}h1{font-size:1.7rem;line-height:1.25;margin:.6em 0 .3em}h2{font-size:1.2rem;margin:1.6em 0 .5em}
.mu{color:var(--mu)}.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;list-style:none;padding:0}
.card{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:12px;height:100%}.card img{width:100%;aspect-ratio:4/3;object-fit:contain;background:#fff;border-radius:8px}
.card h3{font-size:.98rem;margin:.5em 0 .2em}.preco{font-weight:700;font-size:1.1rem}.de{color:var(--mu);text-decoration:line-through;font-size:.85rem;margin-left:6px}
.btn{display:inline-block;background:var(--ac);color:#111;font-weight:700;text-decoration:none;padding:8px 14px;border-radius:8px;margin:4px 6px 4px 0}
.btn.sec{background:transparent;color:var(--ac);border:1px solid var(--ac)}details{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:10px 14px;margin:8px 0}summary{cursor:pointer;font-weight:600}
footer{color:var(--mu);font-size:.85rem;border-top:1px solid var(--bd);margin-top:32px}ul.lista{padding-left:18px}`;

function pagina({ titulo, descricao, canonical, og, jsonlds, corpo, imagem }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="${esc(acento)}">
<meta property="og:type" content="${og || 'website'}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${esc(lojaNome)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${esc(canonical)}">
${imagem ? `<meta property="og:image" content="${esc(imagem)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<style>${CSS}</style>
${jsonlds.map((j) => `<script type="application/ld+json">${jsonld(j)}</script>`).join('\n')}
</head>
<body>
<header><a class="marca" href="/">${esc(lojaNome)}</a><a href="/${pasta}/">Peças por veículo</a></header>
<main>
${corpo}
</main>
<footer><p>${esc(lojaNome)} — peças para ${esc(veiculos.length === 1 ? 'seu veículo' : 'diversos modelos')}. Confirme a compatibilidade com o ano e a versão do seu carro antes de comprar.</p></footer>
</body>
</html>
`;
}

const breadcrumbLd = (itens) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: itens.map((i, n) => ({ '@type': 'ListItem', position: n + 1, name: i.nome, item: abs(i.url) })) });
const breadcrumbHtml = (itens) => `<nav class="bc" aria-label="Você está em"><ol>${itens.map((i, n) => n === itens.length - 1 ? `<li aria-current="page">${esc(i.nome)}</li>` : `<li><a href="${esc(i.url)}">${esc(i.nome)}</a></li>`).join('')}</ol></nav>`;

function produtoLd(p) {
  const o = { '@type': 'Product', name: p.nome, url: abs(p.url) };
  if (p.img) o.image = abs(p.img);
  if (p.sku) o.sku = String(p.sku);
  const preco = num(p.preco);
  if (preco) o.offers = { '@type': 'Offer', url: abs(p.url), price: preco.toFixed(2), priceCurrency: moeda };
  return o;
}
const itemListLd = (lista) => ({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: lista.map((p, n) => ({ '@type': 'ListItem', position: n + 1, item: produtoLd(p) })) });

function cartao(p) {
  const preco = num(p.preco), de = num(p.preco_de);
  return `<li><article class="card">${p.img ? `<img src="${esc(abs(p.img))}" alt="${esc(p.nome)}" loading="lazy" width="400" height="300">` : ''}
<h3><a href="${esc(p.url)}">${esc(p.nome)}</a></h3>
${p.sku ? `<div class="mu">Cód.: ${esc(p.sku)}</div>` : ''}${anosTxt(p.anos) ? `<div class="mu">Anos: ${esc(anosTxt(p.anos))}</div>` : ''}${p.universal ? '<div class="mu">Aplicação universal</div>' : ''}
${preco ? `<div><span class="preco">${brl(preco)}</span>${de && de > preco ? `<span class="de">${brl(de)}</span>` : ''}</div>` : '<div class="mu">Consulte o preço</div>'}
<a class="btn" href="${esc(p.url)}">Ver produto</a></article></li>`;
}

const link3d = (v, chave) => pagina3d ? `${pagina3d}${pagina3d.includes('?') ? '&' : '?'}carro=${encodeURIComponent(v.id)}${chave ? '&parte=' + encodeURIComponent(chave) : ''}` : '';
const whatsLink = (txt) => whats ? `https://wa.me/${whats}?text=${encodeURIComponent(txt)}` : '';

/* ---------- textos ---------- */
const nomeVeiculo = (v) => `${v.marca} ${v.modelo}`;
function intro(v, pc) {
  const nv = nomeVeiculo(v), anos = anosTxt(v.anos), s = pc.sistema, n = pc.produtos.length;
  const precos = pc.produtos.map((p) => num(p.preco)).filter(Boolean);
  const minimo = precos.length ? Math.min(...precos) : null;
  const pecaMin = pc.nome.charAt(0).toLowerCase() + pc.nome.slice(1);
  const motor = v.motor ? ` (motor ${v.motor})` : '';
  const qtd = n === 1 ? 'Temos 1 opção disponível' : `Temos ${n} opções disponíveis`;
  const faixa = minimo ? ` a partir de ${brl(minimo)}` : '';
  const T = [
    `${pc.nome} para ${nv}${anos ? ' ' + anos : ''}${motor}: ${qtd}${faixa}. O sistema de ${s.rotulo.toLowerCase()}, do qual ${pecaMin} faz parte, ${s.funcao}.`,
    `Procurando ${pecaMin} para o seu ${nv}? ${qtd} na ${lojaNome}${faixa}. Ela pertence ao grupo ${s.rotulo.toLowerCase()}, que ${s.funcao}.`,
    `Veja ${pecaMin} compatível com ${nv}${anos ? ' (' + anos + ')' : ''}. ${qtd}${faixa}, todas ligadas ao sistema de ${s.rotulo.toLowerCase()}, que ${s.funcao}.`,
  ];
  const t = T[hash(v.id + pc.chave) % T.length];
  return `${t} Sinais de desgaste comuns: ${s.sinais}. ${s.cuidado}`;
}
function faq(v, pc) {
  const nv = nomeVeiculo(v), anos = anosTxt(v.anos), s = pc.sistema;
  const pecaMin = pc.nome.charAt(0).toLowerCase() + pc.nome.slice(1);
  const h = hash(pc.chave + v.id);
  const q1 = [`Esta ${pecaMin} serve no ${nv}?`, `${pc.nome} é compatível com o ${nv}?`][h % 2];
  const r1 = `Os produtos desta página estão cadastrados como compatíveis com o ${nv}${anos ? ' (' + anos + ')' : ''}${v.motor ? ', motor ' + v.motor : ''}. Como existem versões diferentes, confirme o ano e o motor${whats ? ' pelo WhatsApp' : ' com o nosso atendimento'} antes de finalizar a compra.`;
  const q2 = [`Quando devo trocar ${pecaMin}?`, `Como saber se ${pecaMin} precisa de reparo?`][(h >> 1) % 2];
  const r2 = `Fique atento a: ${s.sinais}. ${s.cuidado} Em caso de dúvida, consulte um mecânico de confiança.`;
  const q3 = `Onde encontro ${pecaMin} do ${nv} no 3D?`;
  const r3 = pagina3d ? `Use o botão "Ver no 3D" para localizar ${pecaMin} no modelo do ${nv} e conferir a posição da peça no veículo.` : `Consulte o manual do ${nv} ou fale com o nosso atendimento para localizar a peça no veículo.`;
  return [[q1, r1], [q2, r2], [q3, r3]];
}

/* ---------- geração ---------- */
const saidaRaiz = path.resolve(aSaida);
const dirPasta = path.join(saidaRaiz, ...pasta.split('/'));
if (fs.existsSync(dirPasta)) fs.rmSync(dirPasta, { recursive: true, force: true }); // evita páginas velhas
const urlsSitemap = [];
const titulosUsados = new Map(), descUsadas = new Map();
let nPag = 0, nPecaPag = 0;
const semProdutos = [];
const resumoVeic = [];

function gravar(rel, html, urlPub, prio) {
  const dest = path.join(saidaRaiz, ...rel.split('/'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html, 'utf8');
  urlsSitemap.push({ loc: abs(urlPub), prio });
  nPag++;
}
function unico(mapa, txt, rotulo, rel) { if (mapa.has(txt)) console.warn(`Aviso: ${rotulo} repetido em ${rel} e ${mapa.get(txt)}`); else mapa.set(txt, rel); }

for (const v of veiculos) {
  const { prods, pecas } = pecasDoVeiculo(v);
  const nv = nomeVeiculo(v), anos = anosTxt(v.anos);
  if (!pecas.length) { semProdutos.push(v); continue; }
  const raiz = [{ nome: 'Início', url: '/' }, { nome: 'Peças por veículo', url: `/${pasta}/` }];
  const trilhaV = [...raiz, { nome: nv, url: urlVeiculo(v) }];

  /* páginas de peça */
  for (const pc of pecas) {
    const rel = `${pasta}/${v.id}/${pc.slug}.html`, urlPub = `/${rel}`;
    const base = `${pc.nome} para ${nv}${anos ? ' ' + anos : ''}`;
    let titulo = `${base} | ${lojaNome}`;
    if (titulo.length > 62) titulo = base.length <= 62 ? base : `${pc.nome} para ${nv}`;
    const precos = pc.produtos.map((p) => num(p.preco)).filter(Boolean);
    let desc = `${pc.nome} para ${nv}${anos ? ' ' + anos : ''}${v.motor ? ' ' + v.motor : ''}. ${pc.produtos.length} ${pc.produtos.length === 1 ? 'produto compatível' : 'produtos compatíveis'}${precos.length ? ' a partir de ' + brl(Math.min(...precos)) : ''}. Compare, confira a compatibilidade e compre na ${lojaNome}.`;
    desc = cortar(desc, 158);
    unico(titulosUsados, titulo, '<title>', rel); unico(descUsadas, desc, 'meta description', rel);
    const trilha = [...trilhaV, { nome: pc.nome, url: urlPub }];
    const perguntas = faq(v, pc);
    const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: perguntas.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } })) };
    const u3 = link3d(v, pc.chave);
    const wl = whatsLink(`Olá! Quero confirmar a compatibilidade de ${pc.nome} com o ${nv}${anos ? ' ' + anos : ''}.`);
    const outras = pecas.filter((o) => o !== pc && o.sistema === pc.sistema).slice(0, 8);
    const corpo = `${breadcrumbHtml(trilha)}
<h1>${esc(base)}</h1>
<p>${esc(intro(v, pc))}</p>
${pc.aliases.length ? `<p class="mu">Também conhecida como: ${esc(pc.aliases.join(', '))}.</p>` : ''}
<p>${u3 ? `<a class="btn sec" href="${esc(u3)}">Ver no 3D</a>` : ''}${wl ? `<a class="btn sec" href="${esc(wl)}" rel="noopener">Tirar dúvidas no WhatsApp</a>` : ''}</p>
<h2>Produtos compatíveis com ${esc(nv)}</h2>
<ul class="grade">
${pc.produtos.map(cartao).join('\n')}
</ul>
<h2>Perguntas frequentes</h2>
${perguntas.map(([q, r]) => `<details><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('\n')}
${outras.length ? `<h2>Outras peças de ${esc(pc.sistema.rotulo.toLowerCase())} para ${esc(nv)}</h2>\n<ul class="lista">${outras.map((o) => `<li><a href="/${pasta}/${v.id}/${o.slug}.html">${esc(o.nome)}</a></li>`).join('')}</ul>` : ''}
<p><a href="${urlVeiculo(v)}">&larr; Todas as peças para ${esc(nv)}</a></p>`;
    const img = (pc.produtos.find((p) => p.img) || {}).img || v.imagem;
    gravar(rel, pagina({ titulo, descricao: desc, canonical: abs(urlPub), og: 'website', jsonlds: [breadcrumbLd(trilha), itemListLd(pc.produtos), faqLd], corpo, imagem: img ? abs(img) : '' }), urlPub, '0.8');
    nPecaPag++;
  }

  /* página do veículo */
  const relV = `${pasta}/${v.id}/index.html`;
  const tV = cortar(`Peças para ${nv}${anos ? ' ' + anos : ''} | ${lojaNome}`, 62);
  const dV = cortar(`Peças para ${nv}${anos ? ' ' + anos : ''}${v.motor ? ' motor ' + v.motor : ''}: ${pecas.length} ${pecas.length === 1 ? 'tipo de peça' : 'tipos de peça'} e ${prods.length} ${prods.length === 1 ? 'produto' : 'produtos'} com preço e compatibilidade. Veja também no 3D na ${lojaNome}.`, 158);
  unico(titulosUsados, tV, '<title>', relV); unico(descUsadas, dV, 'meta description', relV);
  const porSis = new Map();
  for (const pc of pecas) { if (!porSis.has(pc.sistema.rotulo)) porSis.set(pc.sistema.rotulo, []); porSis.get(pc.sistema.rotulo).push(pc); }
  const u3v = link3d(v, '');
  const corpoV = `${breadcrumbHtml(trilhaV)}
<h1>Peças para ${esc(nv)}</h1>
<p>${esc(`Reunimos ${pecas.length} ${pecas.length === 1 ? 'tipo de peça' : 'tipos de peça'} para o ${nv}${anos ? ', fabricado entre ' + anos : ''}${v.motor ? ', motor ' + v.motor : ''}. Escolha o sistema abaixo para ver os produtos compatíveis, ou explore o veículo em 3D para achar a peça certa.`)}</p>
<p>${u3v ? `<a class="btn" href="${esc(u3v)}">Ver o ${esc(nv)} no 3D</a>` : ''}</p>
${[...porSis].map(([rot, lista]) => `<h2>${esc(rot)}</h2>\n<ul class="lista">${lista.map((pc) => `<li><a href="/${pasta}/${v.id}/${pc.slug}.html">${esc(pc.nome)}</a> <span class="mu">(${pc.produtos.length} ${pc.produtos.length === 1 ? 'produto' : 'produtos'})</span></li>`).join('')}</ul>`).join('\n')}
<h2>Produtos em destaque</h2>
<ul class="grade">
${prods.slice(0, 12).map(cartao).join('\n')}
</ul>`;
  const imgV = v.imagem || (prods.find((p) => p.img) || {}).img;
  gravar(relV, pagina({ titulo: tV, descricao: dV, canonical: abs(urlVeiculo(v)), jsonlds: [breadcrumbLd(trilhaV), itemListLd(prods.slice(0, 12))], corpo: corpoV, imagem: imgV ? abs(imgV) : '' }), urlVeiculo(v), '0.9');
  resumoVeic.push({ v, pecas: pecas.length });
}

/* índice geral por marca e modelo */
{
  const comPag = resumoVeic.slice().sort((a, b) => a.v.marca.localeCompare(b.v.marca, 'pt-BR') || a.v.modelo.localeCompare(b.v.modelo, 'pt-BR'));
  const marcas = new Map();
  for (const r of comPag) { if (!marcas.has(r.v.marca)) marcas.set(r.v.marca, []); marcas.get(r.v.marca).push(r); }
  const trilha = [{ nome: 'Início', url: '/' }, { nome: 'Peças por veículo', url: `/${pasta}/` }];
  const corpo = `${breadcrumbHtml(trilha)}
<h1>${esc(tituloIdx)}</h1>
<p>${esc(descIdx)}</p>
${[...marcas].map(([m, l]) => `<h2>${esc(m)}</h2>\n<ul class="lista">${l.map((r) => `<li><a href="${urlVeiculo(r.v)}">${esc(nomeVeiculo(r.v))}${anosTxt(r.v.anos) ? ' ' + esc(anosTxt(r.v.anos)) : ''}</a> <span class="mu">(${r.pecas} ${r.pecas === 1 ? 'tipo de peça' : 'tipos de peça'})</span></li>`).join('')}</ul>`).join('\n')}`;
  const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: tituloIdx, description: descIdx, url: abs(`/${pasta}/`), hasPart: comPag.map((r) => ({ '@type': 'WebPage', name: `Peças para ${nomeVeiculo(r.v)}`, url: abs(urlVeiculo(r.v)) })) };
  gravar(`${pasta}/index.html`, pagina({ titulo: cortar(`${tituloIdx} | ${lojaNome}`, 62), descricao: cortar(descIdx, 158), canonical: abs(`/${pasta}/`), jsonlds: [breadcrumbLd(trilha), ld], corpo }), `/${pasta}/`, '1.0');
}

/* sitemap e robots */
const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
fs.mkdirSync(saidaRaiz, { recursive: true });
fs.writeFileSync(path.join(saidaRaiz, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsSitemap.map((u) => `  <url><loc>${xmlEsc(u.loc)}</loc><lastmod>${lastmod}</lastmod><priority>${u.prio}</priority></url>`).join('\n')}\n</urlset>\n`, 'utf8');
fs.writeFileSync(path.join(saidaRaiz, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${dominio}/sitemap.xml\n`, 'utf8');

/* ---------- relatório ---------- */
const orfaos = produtos.filter((p) => !p.universal && !(p.veiculos || []).some((id) => veiculos.some((v) => v.id === id)));
const chavesSemProduto = Object.keys(nomes).filter((k) => !pecaIgnorada(k) && !usadas.has(k));
console.log('\n=== Relatório SEO ===');
console.log(`Páginas geradas: ${nPag} (+ sitemap.xml e robots.txt)`);
console.log(`  - índice: 1 | veículos: ${resumoVeic.length} | peças: ${nPecaPag}`);
console.log(`Veículos sem produtos (sem página): ${semProdutos.length}${semProdutos.length ? ' -> ' + semProdutos.map((v) => v.id).join(', ') : ''}`);
console.log(`Peças (do dicionário) sem nenhum produto: ${chavesSemProduto.length}${flag('detalhes') ? ' -> ' + chavesSemProduto.join(', ') : ' (use --detalhes para listar)'}`);
if (semNome.size) console.log(`Chaves de peça nos produtos sem nome amigável (ignoradas): ${[...semNome].join(', ')}`);
if (orfaos.length) console.log(`Produtos sem veículo e não universais (fora das páginas): ${orfaos.length}${flag('detalhes') ? ' -> ' + orfaos.map((p) => p.sku || p.nome).join(', ') : ''}`);
console.log(`Saída: ${saidaRaiz}`);
