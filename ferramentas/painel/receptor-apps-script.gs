/**
 * RECEPTOR DE EVENTOS - Painel de Demanda (Google Apps Script / Web App)
 *
 * COMO IMPLANTAR
 * 1. Crie uma planilha Google vazia (sheets.new). Abra Extensões > Apps Script.
 * 2. Apague o conteúdo do editor e cole este arquivo inteiro. Salve.
 * 3. No menu do projeto, abra Configurações do projeto > Propriedades do script
 *    e adicione a propriedade  TOKEN  com uma senha longa e aleatória
 *    (ex.: 24 letras e números). Opcional: SENHA_LEITURA, para usar uma senha
 *    diferente só para ler os dados (se ausente, o próprio TOKEN vale para ler).
 * 4. Clique em Implantar > Nova implantação > tipo "App da Web":
 *      - Executar como: Eu
 *      - Quem tem acesso: Qualquer pessoa
 *    Autorize o acesso à planilha quando solicitado e copie a URL terminada em /exec.
 * 5. No loja.config.json do site, coloque:
 *      "analytics": { "endpoint": "URL/exec", "token": "o mesmo TOKEN" }
 * 6. Sempre que alterar este código, use Implantar > Gerenciar implantações >
 *    editar > Nova versão (a URL continua a mesma).
 *
 * ENVIO (POST): o site envia JSON como texto (Content-Type text/plain), o que
 * dispensa a verificação prévia (preflight) de CORS. O objeto pode vir com o
 * campo "token" no corpo ou no parâmetro ?token= da URL. Aceita um evento
 * ou uma lista de eventos.
 *
 * LEITURA (GET):
 *   ?token=SENHA                  -> { ok, total, eventos:[...] } (mais recentes, até limite)
 *   ?token=SENHA&limite=5000      -> limita a quantidade (máx. 20000)
 *   ?token=SENHA&resumo=1         -> contagem agregada por evento e por dia
 *   ?token=SENHA&desde=2026-01-01 -> apenas eventos a partir da data
 * Respostas GET em JSON são legíveis por outras origens (o Apps Script
 * já libera o CORS para respostas de ContentService).
 *
 * PRIVACIDADE: o receptor NÃO grava IP nem cabeçalhos. Campos como ip, email,
 * telefone, cpf e user agent são descartados.
 */

var ABA = 'eventos';
var CABECALHO = ['t', 'ev', 'loja', 's', 'dados', 'recebido'];
var MAX_CORPO = 8000;        // bytes/caracteres máximos por requisição
var MAX_EVENTOS_POR_POST = 20;
var MAX_CAMPO = 300;         // tamanho máximo de cada valor de texto
var MAX_LEITURA = 20000;
var PROIBIDOS = /^(ip|ipv4|ipv6|ua|user_?agent|email|telefone|fone|cpf|token)$/i;

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function props_() {
  return PropertiesService.getScriptProperties();
}

// Comparação em tempo (quase) constante para o token.
function igual_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!b || a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function tokenEscritaOk_(t) {
  return igual_(t, props_().getProperty('TOKEN'));
}

function tokenLeituraOk_(t) {
  var p = props_();
  var leitura = p.getProperty('SENHA_LEITURA') || p.getProperty('TOKEN');
  return igual_(t, leitura);
}

function aba_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ABA);
  if (!sh) {
    sh = ss.insertSheet(ABA);
    sh.appendRow(CABECALHO);
    sh.setFrozenRows(1);
  }
  return sh;
}

function limpar_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') { try { v = JSON.stringify(v); } catch (e) { v = ''; } }
  v = String(v).replace(/[\u0000-\u001f]/g, ' ');
  // Evita que a planilha interprete o valor como fórmula.
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return v.length > MAX_CAMPO ? v.substring(0, MAX_CAMPO) : v;
}

function linhaDoEvento_(e) {
  if (!e || typeof e !== 'object' || !e.ev) return null;
  var extra = {};
  for (var k in e) {
    if (k === 't' || k === 'ev' || k === 'loja' || k === 's') continue;
    if (PROIBIDOS.test(k)) continue;
    extra[k] = limpar_(e[k]);
  }
  var t = new Date(e.t);
  var iso = isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
  var dados = JSON.stringify(extra);
  if (dados.length > 2000) dados = dados.substring(0, 2000);
  return [iso, limpar_(e.ev).substring(0, 60), limpar_(e.loja), limpar_(e.s), dados, new Date().toISOString()];
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var corpo = (e && e.postData && e.postData.contents) || '';
    if (!corpo) return resposta_({ ok: false, erro: 'corpo vazio' });
    if (corpo.length > MAX_CORPO) return resposta_({ ok: false, erro: 'corpo grande demais' });

    var dados;
    try { dados = JSON.parse(corpo); } catch (err) { return resposta_({ ok: false, erro: 'JSON inválido' }); }

    var token = (e.parameter && e.parameter.token) || (dados && dados.token) || '';
    if (!tokenEscritaOk_(token)) return resposta_({ ok: false, erro: 'não autorizado' });

    var lista = Array.isArray(dados) ? dados : (dados && Array.isArray(dados.eventos) ? dados.eventos : [dados]);
    lista = lista.slice(0, MAX_EVENTOS_POR_POST);
    var linhas = [];
    for (var i = 0; i < lista.length; i++) {
      var l = linhaDoEvento_(lista[i]);
      if (l) linhas.push(l);
    }
    if (!linhas.length) return resposta_({ ok: false, erro: 'nenhum evento válido' });

    lock.waitLock(10000);
    var sh = aba_();
    sh.getRange(sh.getLastRow() + 1, 1, linhas.length, CABECALHO.length).setValues(linhas);
    return resposta_({ ok: true, gravados: linhas.length });
  } catch (err) {
    return resposta_({ ok: false, erro: 'falha interna' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (!tokenLeituraOk_(p.token)) return resposta_({ ok: false, erro: 'não autorizado' });

    var sh = aba_();
    var ultima = sh.getLastRow();
    var limite = Math.min(Math.max(parseInt(p.limite, 10) || 5000, 1), MAX_LEITURA);
    var desde = p.desde ? new Date(p.desde).getTime() : null;
    if (ultima < 2) return resposta_({ ok: true, total: 0, eventos: [] });

    var inicio = Math.max(2, ultima - limite + 1);
    var valores = sh.getRange(inicio, 1, ultima - inicio + 1, CABECALHO.length).getValues();
    var eventos = [];
    for (var i = 0; i < valores.length; i++) {
      var v = valores[i];
      var t = v[0] instanceof Date ? v[0].toISOString() : String(v[0]);
      if (desde && new Date(t).getTime() < desde) continue;
      var obj = {};
      try { obj = JSON.parse(v[4] || '{}'); } catch (err) {}
      obj.t = t; obj.ev = String(v[1]); obj.loja = String(v[2]); obj.s = String(v[3]);
      eventos.push(obj);
    }

    if (String(p.resumo) === '1') {
      var porEvento = {}, porDia = {};
      eventos.forEach(function (o) {
        porEvento[o.ev] = (porEvento[o.ev] || 0) + 1;
        var d = o.t.substring(0, 10);
        porDia[d] = (porDia[d] || 0) + 1;
      });
      return resposta_({ ok: true, total: eventos.length, porEvento: porEvento, porDia: porDia });
    }
    return resposta_({ ok: true, total: eventos.length, eventos: eventos });
  } catch (err) {
    return resposta_({ ok: false, erro: 'falha interna' });
  }
}
