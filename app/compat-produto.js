/* Botão "Veículos compatíveis" para páginas de produto de qualquer loja de autopeças.
 *
 * Como usar (uma linha na página do produto):
 *   <script type="module" src="https://cdn.jsdelivr.net/gh/SEU-USUARIO/SEU-REPO@COMMIT/app/compat-produto.js"></script>
 * Para outra loja, aponte a configuração antes do script:
 *   <script>window.APC_CONFIG = 'https://.../minha-loja/loja.config.json';</script>
 *
 * Lê loja.config.json (catálogo, página 3D, WhatsApp, cor) e catalogo.json (produtos e compatibilidade).
 * Se o produto da página estiver no catálogo e tiver veículos (ou for universal), insere o botão e o modal.
 * Opções em loja.config.json → "produto": { "seletorAncora": "form.cart", "posicao": "antes", "seletorSku": "[itemprop=sku]" }
 * Textos em "textos": { "botao": "Veículos compatíveis" }. Cor do botão em "tema": { "acento": "#ff6a00" }. */
const BASE_SCRIPT = import.meta.url;

async function carregarConfig() {
  let c = window.APC_CONFIG, url = new URL('./loja.config.json', BASE_SCRIPT).href;
  try {
    if (typeof c === 'string') { url = new URL(c, location.href).href; c = await (await fetch(url)).json(); }
    else if (!c) { const r = await fetch(url); c = r.ok ? await r.json() : {}; }
  } catch (e) { c = {}; }
  c = c || {};
  return { url, cfg: Object.assign({ catalogo: '', base: '', produto: {}, textos: {}, tema: {} }, c, { loja: Object.assign({ nome: '', whatsapp: '', pagina3d: '/encontre-pecas/' }, c.loja || {}) }) };
}
const caminho = (u) => { try { return decodeURIComponent(new URL(u, location.href).pathname).replace(/\/+$/, '').toLowerCase(); } catch (e) { return ''; } };
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const track = (nome, d) => { try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: nome }, d || {})); if (typeof window.gtag === 'function') window.gtag('event', nome, d || {}); } catch (e) {} };

function acharProduto(cat, cfg) {
  const aqui = caminho(location.href);
  let p = cat.produtos.find((x) => x.url && caminho(x.url) === aqui);
  if (p) return p;
  const skus = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try { const d = JSON.parse(s.textContent); (Array.isArray(d) ? d : [d]).flatMap((x) => (x && x['@graph']) || [x]).forEach((x) => { if (x && [].concat(x['@type'] || []).indexOf('Product') >= 0) { if (x.sku) skus.push(String(x.sku)); if (x.mpn) skus.push(String(x.mpn)); } }); } catch (e) {}
  });
  const sel = cfg.produto && cfg.produto.seletorSku;
  if (sel) { const e = document.querySelector(sel); if (e) skus.push((e.getAttribute('content') || e.textContent || '').trim()); }
  return cat.produtos.find((x) => x.sku && skus.indexOf(String(x.sku)) >= 0) || null;
}

const SILHUETA = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 140'%3E%3Crect width='240' height='140' fill='%23f1f3f7'/%3E%3Cpath d='M38 94l15-36h134l15 36v22H38z' fill='none' stroke='%239aa5bd' stroke-width='3'/%3E%3Ccircle cx='82' cy='117' r='12' fill='%239aa5bd'/%3E%3Ccircle cx='158' cy='117' r='12' fill='%239aa5bd'/%3E%3C/svg%3E";

const CSS_PAGINA = (ac) => `.apc-btn{display:inline-flex;align-items:center;gap:8px;margin:10px 0;padding:11px 18px;border:2px solid ${ac};border-radius:10px;background:#fff;color:${ac};font:600 15px/1.1 system-ui,sans-serif;cursor:pointer;transition:.2s}
.apc-btn:hover,.apc-btn:focus-visible{background:${ac};color:#fff;outline:none}.apc-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}`;

const CSS_MODAL = (ac) => `*{box-sizing:border-box}.fundo{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:rgba(10,14,25,.55);backdrop-filter:blur(3px);font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c2333}
.cx{width:min(980px,100%);max-height:min(88vh,760px);display:flex;flex-direction:column;border-radius:16px;background:#fff;box-shadow:0 30px 80px rgba(0,0,0,.35);overflow:hidden}
.cab{display:flex;align-items:flex-start;gap:12px;padding:20px 24px 14px;border-bottom:1px solid #e6e9f0}.cab h2{margin:0;font-size:21px}.cab p{margin:4px 0 0;color:#667089;font-size:13.5px}.cab>div{flex:1}
.x{width:38px;height:38px;border:1px solid #dfe3ec;border-radius:50%;background:#fff;font-size:18px;font-weight:700;cursor:pointer;color:#1c2333}.x:hover{background:#f3f5f9}
.busca{padding:12px 24px 0}.busca input{width:100%;padding:11px 14px;border:1px solid #d5dae6;border-radius:10px;font:inherit;font-size:14.5px}.busca input:focus{outline:2px solid ${ac};border-color:transparent}
.corpo{padding:8px 24px 20px;overflow:auto}.uni{margin:14px 0 4px;padding:12px 14px;border-radius:10px;background:#eefaf1;color:#146b34;font-size:14px}
.corpo h3{margin:18px 0 10px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#667089}
.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
.card{display:flex;flex-direction:column;border:1px solid #e1e5ee;border-radius:12px;padding:12px;background:#fff;text-align:center;transition:.2s}.card:hover{border-color:${ac};box-shadow:0 6px 20px rgba(0,0,0,.08)}
.card img{width:100%;aspect-ratio:16/10;object-fit:contain;border-radius:8px;background:#f1f3f7}.card b{margin-top:10px;font-size:15px}.card small{color:#667089;font-size:12.5px;margin:2px 0 10px;min-height:16px}
.card a{margin-top:auto;padding:9px 10px;border:1.5px solid ${ac};border-radius:9px;color:${ac};font-weight:700;font-size:13.5px;text-decoration:none}.card a:hover{background:${ac};color:#fff}
.vazio{padding:28px;text-align:center;color:#667089}.rod{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:14px 24px;border-top:1px solid #e6e9f0;background:#fafbfd;font-size:13.5px;color:#4a556f}
.rod a{color:${ac};font-weight:700;text-decoration:none}.rod a:hover{text-decoration:underline}
@media(max-width:560px){.cab{padding:16px}.busca,.corpo{padding-left:16px;padding-right:16px}.grade{grid-template-columns:repeat(2,1fr)}}`;

async function iniciar() {
  const { url: cfgUrl, cfg } = await carregarConfig();
  if (!cfg.catalogo) return;
  const rel = (u) => (u ? new URL(u, cfgUrl).href : '');
  let cat = null; try { const r = await fetch(rel(cfg.catalogo)); cat = r.ok ? await r.json() : null; } catch (e) {}
  if (!cat || !cat.produtos) return;
  const prod = acharProduto(cat, cfg); if (!prod) return;
  const mapa = new Map((cat.veiculos || []).map((v) => [v.id, v]));
  const veic = (prod.veiculos || []).map((id) => mapa.get(id)).filter(Boolean);
  if (!veic.length && !prod.universal) return;
  const acento = (cfg.tema && cfg.tema.acento) || '#ff6a00';
  const base = cfg.base ? rel(cfg.base).replace(/\/$/, '') : '';
  const parte = (prod.pecas && prod.pecas[0]) || '';
  const pag3d = cfg.loja.pagina3d || '/encontre-pecas/';
  const href3d = (v) => pag3d + (pag3d.indexOf('?') >= 0 ? '&' : '?') + (v ? 'carro=' + encodeURIComponent(v.id) + '&' : '') + (parte ? 'parte=' + encodeURIComponent(parte) : '');

  /* botão na página */
  const st = document.createElement('style'); st.textContent = CSS_PAGINA(acento); document.head.appendChild(st);
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'apc-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 16l1.5-4.5h11L19 16M5 16v3h2.5M19 16v3h-2.5M5 16h14"/><circle cx="8" cy="16" r=".5"/><circle cx="16" cy="16" r=".5"/></svg>' + esc((cfg.textos && cfg.textos.botao) || 'Veículos compatíveis');
  const seletores = (cfg.produto && cfg.produto.seletorAncora) ? [cfg.produto.seletorAncora] : ['.isb-pdp__actions', '.isb-pdp__buy', 'form[action*="/cart"]', 'form.cart', 'form.product-form', 'button.single_add_to_cart_button', '#add-to-cart', '[data-add-to-cart]'];
  let ancora = null; for (const s of seletores) { try { ancora = document.querySelector(s); } catch (e) {} if (ancora) break; }
  if (ancora) { if (cfg.produto && cfg.produto.posicao === 'depois') ancora.insertAdjacentElement('afterend', btn); else ancora.insertAdjacentElement('beforebegin', btn); }
  else { const h1 = document.querySelector('h1'); if (h1) h1.insertAdjacentElement('afterend', btn); else { btn.style.cssText += ';position:fixed;right:16px;bottom:16px;z-index:2147482000'; document.body.appendChild(btn); } }

  /* modal (Shadow DOM: o CSS da loja não interfere) */
  let host = null, ultimoFoco = null;
  const abrir = () => {
    if (host) return; ultimoFoco = document.activeElement;
    host = document.createElement('div'); const sh = host.attachShadow({ mode: 'open' });
    const wpp = String(cfg.loja.whatsapp || '').replace(/\D/g, '');
    const rodape = '<div class="rod"><span>Não achou o seu veículo?' + (wpp ? ' <a href="https://wa.me/' + wpp + '?text=' + encodeURIComponent('Olá! Quero confirmar a compatibilidade de: ' + prod.nome) + '" target="_blank" rel="noopener">Fale no WhatsApp</a>' : '') + '</span><a href="' + esc(href3d(null)) + '">Ver esta peça no 3D</a></div>';
    sh.innerHTML = '<style>' + CSS_MODAL(acento) + '</style><div class="fundo" part="fundo"><div class="cx" role="dialog" aria-modal="true" aria-labelledby="t"><div class="cab"><div><h2 id="t">' + esc((cfg.textos && cfg.textos.titulo) || 'Veículos compatíveis') + '</h2><p>' + esc(prod.nome) + '</p></div><button class="x" type="button" aria-label="Fechar">X</button></div>' +
      (veic.length > 8 ? '<div class="busca"><input type="search" placeholder="Buscar marca ou modelo" aria-label="Buscar veículo"></div>' : '') +
      '<div class="corpo"></div>' + rodape + '</div></div>';
    const corpo = sh.querySelector('.corpo');
    const desenhar = (q) => {
      const f = semAcento(q || ''), lista = veic.filter((v) => !f || semAcento(v.marca + ' ' + v.modelo).indexOf(f) >= 0);
      let h = prod.universal ? '<div class="uni">Esta peça é universal: serve em qualquer veículo compatível com a medida e o encaixe.</div>' : '';
      if (!lista.length) h += '<div class="vazio">' + (veic.length ? 'Nenhum veículo encontrado.' : 'Esta peça não tem veículos específicos.') + '</div>';
      const grupos = {}; lista.forEach((v) => { (grupos[v.marca] = grupos[v.marca] || []).push(v); });
      Object.keys(grupos).sort().forEach((m) => {
        h += '<h3>' + esc(m) + '</h3><div class="grade">' + grupos[m].map((v) => {
          const anos = v.anos ? v.anos[0] + (v.anos[1] && v.anos[1] !== v.anos[0] ? '–' + v.anos[1] : '') : '';
          const img = v.imagem || (base ? base + '/posters/poster-' + v.id + '.webp' : SILHUETA);
          return '<div class="card"><img loading="lazy" alt="' + esc(v.marca + ' ' + v.modelo) + '" src="' + esc(img) + '" onerror="this.onerror=null;this.src=\'' + SILHUETA + '\'"><b>' + esc(v.modelo) + '</b><small>' + esc([v.motor, anos].filter(Boolean).join(' · ')) + '</small><a href="' + esc(href3d(v)) + '" data-v="' + esc(v.id) + '">Ver no 3D</a></div>';
        }).join('') + '</div>';
      });
      corpo.innerHTML = h;
    };
    desenhar('');
    document.body.appendChild(host);
    const fechar = () => { document.removeEventListener('keydown', tecla, true); host.remove(); host = null; try { ultimoFoco && ultimoFoco.focus(); } catch (e) {} };
    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
      if (e.key !== 'Tab') return;
      const foc = [...sh.querySelectorAll('button,a[href],input')]; if (!foc.length) return;
      const a = sh.activeElement, i = foc.indexOf(a);
      if (e.shiftKey && i <= 0) { e.preventDefault(); foc[foc.length - 1].focus(); } else if (!e.shiftKey && i === foc.length - 1) { e.preventDefault(); foc[0].focus(); }
    };
    document.addEventListener('keydown', tecla, true);
    sh.querySelector('.x').onclick = fechar;
    sh.querySelector('.fundo').addEventListener('mousedown', (e) => { if (e.target.classList.contains('fundo')) fechar(); });
    const inp = sh.querySelector('input'); if (inp) inp.addEventListener('input', () => desenhar(inp.value));
    sh.addEventListener('click', (e) => { const a = e.target.closest('a[data-v]'); if (a) track('compat_ver_3d', { veiculo: a.dataset.v, produto: prod.sku || prod.id }); });
    sh.querySelector('.x').focus();
    track('compat_abrir', { produto: prod.sku || prod.id, veiculos: veic.length });
  };
  btn.addEventListener('click', abrir);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
