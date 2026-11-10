#!/usr/bin/env node
/* Extrai chave -> nome amigável das peças (objetos ZONAS e GRUPOS) da página completa do visualizador.
 *   node extrair-nomes-pecas.mjs [pagina-completa.html] [saida.json]
 */
import fs from 'node:fs';
const origem = process.argv[2] || 'D:/Backup/Lojas/Autoford/carros3d/fonte/pagina-completa.html';
const saida = process.argv[3] || new URL('./nomes-pecas.json', import.meta.url);
const html = fs.readFileSync(origem, 'utf8');
const des = (s) => s.replace(/\\(.)/g, '$1');
const nomes = {};
// ZONAS: 'chave': { nome: '...'
const iz = html.indexOf('const ZONAS = {');
const fz = html.indexOf('\n};', iz);
for (const m of html.slice(iz, fz).matchAll(/'([\w-]+)':\s*\{\s*nome:\s*'((?:[^'\\]|\\.)*)'/g)) nomes[m[1]] = des(m[2]);
// GRUPOS: ['chave', 'Nome', 'termo']
const ig = html.indexOf('const GRUPOS = {');
const fg = html.indexOf('\n};', ig);
for (const m of html.slice(ig, fg).matchAll(/\[\s*'([\w-]+)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\s*\]/g)) if (!nomes[m[1]]) nomes[m[1]] = des(m[2]);
// Complementos e ajustes para uso em SEO (nomes que não existem ou soam como animação 3D)
Object.assign(nomes, {
 'bomba-agua': "Bomba d'água", 'bomba-agua-arref': "Bomba d'água", 'bomba-agua-v6': "Bomba d'água V6", 'bomba-dagua-kit': "Kit da bomba d'água",
 'arrefecimento': 'Sistema de arrefecimento'
});
fs.writeFileSync(saida, JSON.stringify(nomes, null, 1) + '\n', 'utf8');
console.log(Object.keys(nomes).length + ' nomes gravados');
