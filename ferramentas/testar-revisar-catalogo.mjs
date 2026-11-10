// Teste simples (sem dependências): extrai as funções puras do HTML e valida filtros, edição em massa e exportação.
// Uso: node ferramentas/testar-revisar-catalogo.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'revisar-catalogo.html'), 'utf8');
const nomes = html.match(/const NOMES_PECAS = \/\*NOMES\*\/([\s\S]*?)\/\*FIM-NOMES\*\/;/)[1];
const puro = html.split('/*PURO-INICIO*/')[1].split('/*PURO-FIM*/')[0];
const api = new Function(`const NOMES_PECAS = ${nomes};\n${puro}\nreturn { NOMES_PECAS, carregarCatalogo, contadores, filtrar, aplicarOp, aplicarEmMassa, faixaAnos, montarCatalogo, relatorioCSV, novoHistorico, registrar, desfazer, refazer, resolverPeca, resolverVeiculo, semPeca, semVeiculo };`)();

const orig = JSON.parse(fs.readFileSync(path.join(dir, '..', 'exemplo-loja', 'catalogo.json'), 'utf8'));
let n = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok -', nome); };
const { cat, produtos } = api.carregarCatalogo(structuredClone(orig));

t('contadores batem com a contagem manual', () => {
  const c = api.contadores(produtos);
  assert.equal(c.total, orig.produtos.length);
  assert.equal(c.semPeca, orig.produtos.filter((p) => !p.pecas?.length).length);
  assert.equal(c.universais, orig.produtos.filter((p) => p.universal).length);
});
t('filtros: texto, sem peça, sem veículo, universal, veículo, peça', () => {
  assert.equal(api.filtrar(produtos, { texto: 'TERMOSTATO compass' }).length, produtos.filter((p) => /termostato.*compass/i.test(p.nome)).length);
  assert.ok(api.filtrar(produtos, { semPeca: true }).every((i) => !produtos[i].pecas.length));
  assert.ok(api.filtrar(produtos, { semVeiculo: true }).every((i) => !produtos[i].veiculos.length && !produtos[i].universal));
  assert.ok(api.filtrar(produtos, { universal: true }).every((i) => produtos[i].universal));
  assert.ok(api.filtrar(produtos, { veiculo: 'jeep-compass' }).every((i) => produtos[i].veiculos.includes('jeep-compass')));
  assert.equal(api.filtrar(produtos, { peca: 'termostato-arref' }).length, produtos.filter((p) => p.pecas.includes('termostato-arref')).length);
  assert.equal(api.filtrar(produtos, {}).length, produtos.length);
});
t('autocompletar resolve nome amigável e veículo', () => {
  assert.equal(api.resolverPeca('Pastilhas de freio'), 'pastilha');
  assert.equal(api.resolverPeca('Pastilhas de freio [pastilha]'), 'pastilha');
  assert.equal(api.resolverPeca('xyz'), null);
  assert.equal(api.resolverVeiculo(cat, 'Jeep Compass'), 'jeep-compass');
});
t('edição em massa + desfazer/refazer', () => {
  const h = api.novoHistorico(30);
  const alvo = api.filtrar(produtos, { semVeiculo: true });
  const antes = JSON.stringify(produtos);
  api.registrar(h, api.aplicarEmMassa(produtos, alvo, { tipo: 'addVeic', valor: 'jeep-wrangler' }));
  assert.ok(alvo.every((i) => produtos[i].veiculos.includes('jeep-wrangler')));
  assert.equal(api.filtrar(produtos, { semVeiculo: true }).length, 0);
  api.registrar(h, api.aplicarEmMassa(produtos, alvo, { tipo: 'addPeca', valor: 'pastilha' }));
  api.registrar(h, api.aplicarEmMassa(produtos, alvo, { tipo: 'anos', valor: [2010, 2020] }));
  api.registrar(h, api.aplicarEmMassa(produtos, alvo, { tipo: 'universal', valor: true }));
  assert.ok(alvo.every((i) => produtos[i].universal && produtos[i].anos[0] === 2010));
  assert.equal(api.registrar(h, api.aplicarEmMassa(produtos, alvo, { tipo: 'universal', valor: true })), false, 'sem mudança não registra');
  api.registrar(h, api.aplicarEmMassa(produtos, alvo, { tipo: 'rmVeic', valor: 'jeep-wrangler' }));
  api.registrar(h, api.aplicarEmMassa(produtos, alvo, { tipo: 'rmPeca', valor: 'pastilha' }));
  while (api.desfazer(h, produtos));
  assert.equal(JSON.stringify(produtos), antes, 'desfazer tudo restaura o estado original');
  while (api.refazer(h, produtos));
  assert.ok(alvo.every((i) => produtos[i].universal && !produtos[i].veiculos.includes('jeep-wrangler')));
  while (api.desfazer(h, produtos));
});
t('histórico limita a 30 ações', () => {
  const h = api.novoHistorico(30);
  for (let k = 0; k < 40; k++) api.registrar(h, api.aplicarEmMassa(produtos, [0], { tipo: 'anos', valor: [2000 + k, 2001 + k] }));
  assert.equal(h.feitos.length, 30);
  while (api.desfazer(h, produtos));
});
t('faixa de anos inválida é rejeitada', () => {
  assert.equal(api.faixaAnos('2016', '2011'), null);
  assert.equal(api.faixaAnos('', '2011'), null);
  assert.deepEqual(api.faixaAnos('2011', '2016'), [2011, 2016]);
});
t('exportação preserva campos originais e não altera o catálogo carregado', () => {
  const h = api.novoHistorico(30);
  api.registrar(h, api.aplicarEmMassa(produtos, [0], { tipo: 'addPeca', valor: 'freios' }));
  api.registrar(h, api.aplicarEmMassa(produtos, [1], { tipo: 'anos', valor: null }));
  const saida = JSON.parse(JSON.stringify(api.montarCatalogo(cat, produtos)));
  assert.equal(saida.versao, orig.versao);
  assert.equal(saida.moeda, orig.moeda);
  assert.deepEqual(saida.veiculos, orig.veiculos);
  assert.equal(saida.produtos.length, orig.produtos.length);
  assert.ok(saida.produtos[0].pecas.includes('freios'));
  assert.ok(!('anos' in saida.produtos[1]));
  for (const k of ['id', 'sku', 'nome', 'url', 'img', 'preco', 'preco_de']) assert.equal(saida.produtos[2][k], orig.produtos[2][k]);
  assert.deepEqual(cat, orig, 'objeto original intacto');
});
t('relatório CSV lista somente pendências', () => {
  const csv = api.relatorioCSV(cat, produtos).split('\r\n');
  const esperado = produtos.filter((p) => api.semPeca(p) || api.semVeiculo(p)).length;
  assert.equal(csv.length - 1, esperado);
  assert.ok(csv[0].startsWith('sku;nome;url;pendencia'));
  assert.equal(api.relatorioCSV(cat, [{ sku: 'A', nome: 'Com; "aspas"', pecas: [], veiculos: [] }]).split('\r\n')[1], 'A;"Com; ""aspas""";;sem peça + sem veículo;;');
});
t('catálogo inválido gera erro', () => { assert.throws(() => api.carregarCatalogo({ a: 1 })); });
t('desempenho: 5000 produtos filtrados rapidamente', () => {
  const grande = Array.from({ length: 5000 }, (_, i) => ({ nome: 'Produto ' + i, sku: 'S' + i, pecas: i % 3 ? ['freios'] : [], veiculos: i % 5 ? ['jeep-compass'] : [] }));
  const t0 = Date.now();
  const r = api.filtrar(grande, { texto: 'produto 4', semPeca: true });
  assert.ok(r.length > 0);
  assert.ok(Date.now() - t0 < 500);
});
console.log(`\n${n} testes passaram.`);
