// Teste simples (sem dependências): node teste-agregacao.js
// Extrai as funções puras de agregação do painel-demanda.html e valida contagens.
"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "painel-demanda.html"), "utf8");
const m = html.match(/\/\/ <<AGREGACAO-INICIO>>([\s\S]*?)\/\/ <<AGREGACAO-FIM>>/);
assert(m, "marcadores de agregação não encontrados");
const api = new Function(
  m[1] + "; return { esc, normalizarLista, filtrar, agregar, listaVeiculos, demandaParaCsv, eventosDeTexto, parseCsv };"
)();

const agora = Date.parse("2026-06-30T12:00:00Z");
const E = (t, ev, s, d) => Object.assign({ t, ev, loja: "L", s }, d);
const brutos = [
  E("2026-06-29T10:00:00Z", "c3d_carro", "a", { carro: "Gol", marca: "VW", modelo: "Gol" }),
  E("2026-06-29T10:00:10Z", "c3d_parte", "a", { carro: "Gol", parte: "Pastilha" }),
  E("2026-06-29T10:00:20Z", "c3d_resultados", "a", { carro: "Gol", parte: "Pastilha", quantidade: 3 }),
  E("2026-06-29T10:00:30Z", "c3d_produto", "a", { carro: "Gol", produto: "Pastilha X" }),
  E("2026-06-29T10:00:40Z", "c3d_carrinho", "a", { carro: "Gol", produto: "Pastilha X" }),
  E("2026-06-29T11:00:00Z", "c3d_carro", "b", { carro: "Gol" }),
  E("2026-06-29T11:00:10Z", "c3d_parte", "b", { carro: "Gol", parte: "Coxim do câmbio" }),
  E("2026-06-29T11:00:20Z", "c3d_sem_resultado", "b", { carro: "Gol", parte: "Coxim do Cambio" }),
  E("2026-06-29T11:00:30Z", "c3d_semelhantes", "b", { carro: "Gol", parte: "Coxim do câmbio", quantidade: 0 }),
  E("2026-06-29T11:00:40Z", "c3d_busca_zona", "b", { termo: "bieleta", resultados: 0 }),
  E("2026-06-29T11:00:50Z", "c3d_busca_zona", "b", { termo: "filtro", resultados: 4 }),
  E("2026-06-29T12:00:00Z", "c3d_carro", "c", { carro: "Onix" }),
  E("2026-06-29T12:00:10Z", "c3d_diagnostico", "c", { carro: "Onix", sintoma: "<b>Barulho</b>" }),
  E("2026-06-29T12:00:20Z", "c3d_ar", "c", { tipo: "camera", ip: "1.2.3.4" }),
  E("2026-06-29T12:00:30Z", "compat_ver_3d", "c", { veiculo: "Onix", produto: "P" }),
  E("2026-01-01T00:00:00Z", "c3d_carro", "velho", { carro: "Uno" }),
  { t: "lixo", ev: "c3d_carro", s: "x" },
  null
];

const todos = api.normalizarLista(brutos);
assert.strictEqual(todos.length, 16, "eventos válidos");
assert(!("ip" in todos[13].d), "IP deve ser removido");

const a = api.agregar(api.filtrar(todos, { dias: 30, agora }));
assert.strictEqual(a.sessoes, 3);
assert.deepStrictEqual(a.funil.map(f => f.n), [3, 2, 1, 1, 1]);
assert.strictEqual(a.conversao[1].deAnterior, 2 / 3);
assert.strictEqual(a.conversao[4].doInicio, 1 / 3);

// Demanda perdida: coxim (sem_resultado + semelhantes 0, acentos agrupados) = 2; bieleta = 1.
const dp = a.demandaPerdida;
assert.strictEqual(dp.length, 2);
assert.strictEqual(dp[0].n, 2);
assert.strictEqual(dp[0].veic.Gol, 2);
assert.strictEqual(dp[1].nome, "bieleta");
assert.strictEqual(dp[1].n, 1);

assert.strictEqual(a.sintomas[0].nome, "<b>Barulho</b>"); // dado cru; a escapa na renderização
assert.strictEqual(api.esc(a.sintomas[0].nome), "&lt;b&gt;Barulho&lt;/b&gt;");
assert.strictEqual(a.recursos.ar, 1);
assert.strictEqual(a.recursos.ver3d, 1);
assert.strictEqual(a.produtos[0].carrinho, 1);
assert.strictEqual(a.veiculos[0].nome, "Gol");
assert.strictEqual(a.veiculos[0].n, 2);

// Filtros: período e veículo.
assert.strictEqual(api.agregar(api.filtrar(todos, { dias: 0, agora })).sessoes, 4);
assert.strictEqual(api.agregar(api.filtrar(todos, { dias: 30, agora, veiculo: "Gol" })).sessoes, 2);
assert.deepStrictEqual(api.listaVeiculos(todos).slice(0, 2), ["Gol", "Onix"]);

// CSV: exportação com proteção contra fórmula; importação CSV e JSON.
assert(api.demandaParaCsv([{ nome: "=cmd", n: 1, veic: {} }]).includes("'=cmd"));
const csv = 't;ev;s;carro;dados\n2026-06-29T10:00:00Z;c3d_carro;z;"Gol; 1.0";"{""x"":1}"\n';
const ec = api.eventosDeTexto(csv);
assert.strictEqual(ec.length, 1);
assert.strictEqual(ec[0].carro, "Gol; 1.0");
assert.strictEqual(ec[0].x, 1);
assert.strictEqual(api.eventosDeTexto('{"eventos":[{"ev":"a","t":"2026-01-01"}]}').length, 1);

console.log("OK: todos os testes passaram");
