#!/usr/bin/env node
/* Gera o catalogo.json do visualizador de peças a partir da exportação de produtos da loja.
 *
 *   node ferramentas/gerar-catalogo.mjs --produtos produtos.csv --veiculos veiculos.csv [--compat compat.csv] --saida catalogo.json
 *
 * produtos.csv   colunas: nome; sku; url; preco; preco_de; imagem   (separador ; ou , — nomes de coluna flexíveis)
 * veiculos.csv   colunas: id; marca; modelo; anos; motor; categoria; arquivo3d; imagem
 *                (anos no formato 2011-2016; id opcional; arquivo3d só se houver modelo 3D da carroceria)
 * compat.csv     (opcional) sku; veiculo   — uma linha por compatibilidade confirmada; sobrepõe a inferência pelo nome
 *
 * O script descobre sozinho a peça (pelo nome do produto) e os veículos compatíveis (pelo modelo citado no nome
 * e pelos anos). Produtos sem veículo no nome ficam "sem informação de compatibilidade"; "universal" no nome
 * marca o produto como universal. Revise o resultado: ele é um ponto de partida.
 */
import fs from 'node:fs';

/* ---------- argumentos ---------- */
const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const aProd = arg('produtos'), aVeic = arg('veiculos'), aCompat = arg('compat'), aSaida = arg('saida') || 'catalogo.json';
if (!aProd || !aVeic) { console.error('Uso: node gerar-catalogo.mjs --produtos produtos.csv --veiculos veiculos.csv [--compat compat.csv] --saida catalogo.json'); process.exit(1); }

/* ---------- CSV ---------- */
function lerCSV(arq) {
  let t = fs.readFileSync(arq, 'utf8').replace(/^﻿/, '');
  const sep = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const linhas = []; let campo = '', linha = [], asp = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (asp) { if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') asp = false; else campo += c; }
    else if (c === '"' && campo === '') asp = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; linha.push(campo); campo = ''; if (linha.some((x) => x.trim() !== '')) linhas.push(linha); linha = []; }
    else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); if (linha.some((x) => x.trim() !== '')) linhas.push(linha); }
  const cab = linhas.shift().map((h) => norm(h));
  return linhas.map((l) => Object.fromEntries(cab.map((h, i) => [h, (l[i] || '').trim()])));
}
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const pega = (o, ...nomes) => { for (const n of nomes) if (o[n] != null && o[n] !== '') return o[n]; return ''; };

/* ---------- dicionário: o que cada trecho do nome significa nas partes do visualizador ---------- */
const PECAS = [
  [/\bcapo\b/, ['capo']], [/para-?choque.*(dianteir|frente)|(dianteir|frente).*para-?choque/, ['parachoque-d']], [/para-?choque.*(traseir)|traseir.*para-?choque/, ['parachoque-t']],
  [/para-?choque/, ['parachoque-d', 'parachoque-t']],
  [/lente.*farol|farol.*lente/, ['lente-farol', 'farol']], [/lampada.*(farol|h4|h7|h1)|\bh4\b|\bh7\b/, ['lampada-farol', 'farol']], [/refletor/, ['refletor', 'farol']], [/\bfarol|farolete/, ['farol']],
  [/lente.*lanterna|lanterna.*lente/, ['lente-lanterna', 'lanterna']], [/lanterna/, ['lanterna']],
  [/parabrisa|para-brisa/, ['parabrisa']], [/palheta/, ['palheta', 'limpador']], [/bra[cç]o.*limpador|limpador.*bra[cç]o/, ['braco-limpador', 'limpador']], [/esguicho/, ['bico-esguicho', 'limpador']], [/motor.*limpador/, ['motor-limpador', 'limpador']], [/limpador/, ['limpador']],
  [/espelho.*retrovisor|lente.*retrovisor/, ['espelho-retro', 'retrovisor']], [/capa.*retrovisor/, ['capa-retro', 'retrovisor']], [/pisca.*retrovisor|seta.*retrovisor/, ['pisca-retro', 'retrovisor']], [/retrovisor/, ['retrovisor']],
  [/\bpneu\b/, ['pneu', 'rodas']], [/parafuso.*roda/, ['parafuso-roda', 'rodas']], [/calota/, ['calota', 'rodas']], [/valvula.*pneu|bico.*pneu/, ['valvula-pneu', 'rodas']], [/\broda\b|\baro\b/, ['rodas']],
  [/macaneta/, ['macaneta', 'portas']], [/fechadura/, ['fechadura', 'portas']], [/regulador.*vidro|maquina.*vidro/, ['regulador-vidro', 'portas']], [/motor.*vidro/, ['motor-vidro', 'portas']], [/vidro.*porta|vidro eletrico/, ['vidro-porta', 'portas']], [/borracha.*porta/, ['borracha-porta', 'portas']],
  [/tampa traseira|porta-?malas/, ['portamalas']], [/\bporta\b/, ['portas']], [/\bteto\b/, ['teto']],
  [/termostato|valvula termostatica/, ['termostato-arref', 'corte-termostato', 'termo-elemento', 'arrefecimento']],
  [/bomba d.?agua|bomba de agua/, ['bomba-agua-arref', 'bomba-agua-v6', 'bomba-dagua-kit', 'bomba-agua', 'arrefecimento']],
  [/radiador/, ['radiador', 'radiador-arref', 'arrefecimento']], [/ventoinha|eletroventilador/, ['ventoinha', 'ventoinha-arref', 'radiador', 'arrefecimento']],
  [/reservatorio/, ['reservatorio', 'reservatorio-arref', 'radiador', 'arrefecimento']], [/tampa.*radiador/, ['tampa-radiador', 'radiador']],
  [/mangueira|conector.*mangueira/, ['mangueira', 'mangueira-arref', 'radiador', 'arrefecimento']], [/resfriador.*oleo|trocador de calor/, ['resfriador-oleo', 'resfriador-v6', 'motor-v6', 'arrefecimento']],
  [/sensor.*(posicao|tps).*borboleta|\btps\b/, ['borb-sensor', 'corte-borboleta']], [/corpo de borboleta|\btbi\b|borboleta/, ['corpo-borboleta', 'corte-borboleta', 'borb-eixo-placa', 'motor-v6']],
  [/bobina/, ['bobina-v6', 'motor-v6']], [/\bvela/, ['vela', 'motor', 'motor-v6']], [/distribuidor/, ['motor']],
  [/junta.*cabecote/, ['junta', 'cabecote', 'motor']], [/cabecote/, ['cabecote', 'cabecote-v6', 'motor', 'motor-v6']], [/tampa.*valvula/, ['tampa-valvulas', 'motor-v6']],
  [/coletor.*admissao/, ['coletor-admissao', 'motor-v6']], [/coletor.*escape/, ['coletor', 'coletor-esc', 'escapamento', 'motor']],
  [/carter/, ['carter', 'carter-v6', 'motor', 'motor-v6']], [/\bbloco\b/, ['bloco', 'motor']], [/pistao|biela|anel/, ['pistao', 'motor']], [/virabrequim/, ['virabrequim', 'motor']],
  [/volante.*motor/, ['volante', 'volante-emb', 'embreagem', 'motor']], [/comando.*valvula/, ['comando', 'motor']], [/valvula.*(admissao|escape|motor)/, ['valvulas', 'motor']],
  [/correia dentada|correia.*distribuicao|kit.*distribuicao/, ['correia', 'distribuicao']], [/tensor/, ['tensor', 'distribuicao']], [/polia.*alternador/, ['polia-alt', 'alternador']], [/\bpolia/, ['polia-comando', 'polia-virabrequim', 'polia-guia', 'distribuicao']],
  [/filtro.*oleo/, ['filtro-oleo', 'motor']], [/filtro.*combustivel/, ['filtro-comb', 'bomba-comb']],
  [/sensor.*pressao.*oleo|interruptor.*oleo|cebolinha/, ['sensor-oleo-v6', 'corte-sensor-oleo', 'soe-diafragma', 'motor-v6']],
  [/solenoide.*partida|automatico.*partida/, ['solenoide', 'partida']], [/solenoide/, ['corte-solenoide', 'sol-bobina', 'sol-embolo']],
  [/turbina|turbo|wastegate/, ['turbo', 'turbina', 'compressor', 'cartucho', 'rotor-turbo', 'wastegate']],
  [/silencioso/, ['silencioso', 'silencioso-int', 'escapamento']], [/catalisador/, ['catalisador', 'escapamento']], [/ponteira/, ['ponteira', 'escapamento']], [/sonda lambda/, ['sonda', 'escapamento']], [/escapamento/, ['escapamento']],
  [/disco.*embreagem/, ['disco-embreagem', 'embreagem']], [/rolamento.*embreagem/, ['rolamento-embreagem', 'embreagem']], [/plato/, ['plato', 'embreagem']], [/embreagem/, ['embreagem']],
  [/sincronizador/, ['sincronizador', 'cambio']], [/cambio|caixa de marcha/, ['cambio']],
  [/regulador.*voltagem|regulador.*tensao/, ['regulador', 'alternador']], [/ponte retificadora/, ['retificador', 'alternador']], [/alternador/, ['alternador']],
  [/terminal.*bateria/, ['terminal-bateria', 'bateria']], [/bateria/, ['bateria']], [/bendix|induzido/, ['bendix', 'induzido', 'partida']], [/motor de partida|\bpartida\b/, ['partida']],
  [/boia.*combustivel/, ['boia', 'bomba-comb']], [/bomba.*combustivel/, ['bomba-comb']],
  [/cremalheira|caixa de direcao|barra axial|terminal.*direcao|pinhao/, ['direcao', 'cremalheira']], [/direcao/, ['direcao']],
  [/kit.*(lift|elevacao)|lift kit|elevador/, ['lift', 'suspensao', 'mola-lift', 'amortecedor-lift', 'bandeja-lift', 'coxim-lift', 'barra-track']], [/barra track|panhard/, ['barra-track', 'lift']],
  [/amortecedor/, ['amortecedor', 'amortecedor-lift', 'suspensao']], [/\bmola\b/, ['mola', 'mola-lift', 'suspensao']], [/coxim/, ['coxim', 'coxim-lift', 'suspensao']],
  [/bandeja|bra[cç]o (oscilante|de controle)/, ['bandeja', 'bandeja-lift', 'suspensao']], [/pivo|rotula/, ['pivo', 'suspensao']], [/bieleta/, ['bieleta', 'suspensao']],
  [/barra estabilizadora/, ['estabilizadora', 'suspensao']], [/batente|coifa/, ['batente', 'suspensao']], [/manga de eixo|ponta de eixo/, ['manga', 'suspensao']], [/suspensao/, ['suspensao']],
  [/pastilha/, ['pastilha', 'freios']], [/pin[cç]a/, ['pinca', 'freios']], [/flexivel.*freio|mangueira.*freio/, ['flexivel-freio', 'freios']], [/cubo.*roda|rolamento.*roda/, ['cubo-roda', 'freios']], [/disco.*freio|\bfreio\b/, ['disco-freio', 'freios']]
];

/* ---------- anos no nome ---------- */
function faixaAno(nome) {
  const f = (x) => { x = +x; return x < 100 ? (x > 40 ? 1900 + x : 2000 + x) : x; };
  const m = nome.match(/\b((?:19|20)\d{2}|\d{2})\s*(?:a|à|ao|até|-|\/)\s*((?:19|20)\d{2}|\d{2})\b/i);
  if (m) return [f(m[1]), f(m[2])];
  const u = nome.match(/\b(?:19|20)\d{2}\b/);
  return u ? [+u[0], +u[0]] : null;
}
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- leitura ---------- */
const veiculosCsv = lerCSV(aVeic);
const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const veiculos = veiculosCsv.map((r) => {
  const marca = pega(r, 'marca', 'brand'), modelo = pega(r, 'modelo', 'model');
  const am = pega(r, 'anos', 'ano').match(/(\d{4})\D+(\d{4})/); const um = pega(r, 'anos', 'ano').match(/^\d{4}$/);
  return { id: pega(r, 'id') || slug(marca + ' ' + modelo), marca, modelo, anos: am ? [+am[1], +am[2]] : um ? [+um[0], +um[0]] : null, motor: pega(r, 'motor'), categoria: pega(r, 'categoria', 'tipo'), arquivo3d: pega(r, 'arquivo3d', 'glb'), imagem: pega(r, 'imagem', 'img') };
}).filter((v) => v.marca && v.modelo);
const regVeic = veiculos.map((v) => {
  const m = norm(v.modelo).split(/[\s-]+/).filter(Boolean).map(esc).join('[\\s-]*');
  return { v, re: new RegExp('(^|[^a-z0-9])' + m + '([^a-z0-9]|$)'), marca: norm(v.marca) };
});
const compat = {};
if (aCompat) lerCSV(aCompat).forEach((r) => { const k = pega(r, 'sku', 'codigo'), v = pega(r, 'veiculo', 'veiculo_id', 'id'); if (k && v) (compat[k] = compat[k] || []).push(v); });

/* ---------- produtos ---------- */
const produtos = []; let semPeca = 0, semVeic = 0;
lerCSV(aProd).forEach((r, i) => {
  const nome = pega(r, 'nome', 'titulo', 'name', 'title'); if (!nome) return;
  const sku = pega(r, 'sku', 'codigo', 'ref', 'referencia');
  const n = norm(nome), pecas = new Set();
  PECAS.forEach(([re, ks]) => { if (re.test(n)) ks.forEach((k) => pecas.add(k)); });
  const anos = faixaAno(nome), universal = /\buniversal\b/.test(n);
  let ids = [];
  if (sku && compat[sku]) ids = compat[sku];
  else regVeic.forEach(({ v, re, marca }) => {
    if (!re.test(n)) return;
    if (norm(v.modelo).length < 3 && n.indexOf(marca) < 0) return;
    if (anos && v.anos && (anos[1] < v.anos[0] || anos[0] > v.anos[1])) return;
    ids.push(v.id);
  });
  if (!pecas.size) semPeca++;
  if (!ids.length && !universal) semVeic++;
  produtos.push({ id: pega(r, 'id') || sku || String(i + 1), sku, nome, url: pega(r, 'url', 'link'), img: pega(r, 'imagem', 'img', 'image', 'foto'), preco: pega(r, 'preco', 'price'), preco_de: pega(r, 'preco_de', 'preco_antigo'), pecas: [...pecas], veiculos: ids, anos: anos || undefined, universal: universal || undefined });
});

fs.writeFileSync(aSaida, JSON.stringify({ versao: 1, gerado: new Date().toISOString().slice(0, 10), moeda: 'BRL', veiculos, produtos }, null, 1), 'utf8');
console.log('catalogo:', aSaida, '|', veiculos.length, 'veiculos |', produtos.length, 'produtos');
console.log('produtos sem peca reconhecida:', semPeca, '| sem veiculo identificado (nem universal):', semVeic);
