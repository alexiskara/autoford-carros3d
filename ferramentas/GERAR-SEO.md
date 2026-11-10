# Gerador de páginas de SEO

Gera páginas HTML estáticas e indexáveis por veículo e por peça, mais `sitemap.xml` e `robots.txt`, a partir do `catalogo.json`.

```
node ferramentas/gerar-seo.mjs --catalogo catalogo.json --config loja.config.json --saida ./seo
```

Opções: `--nomes caminho.json` (dicionário chave→nome; padrão `ferramentas/nomes-pecas.json`), `--detalhes` (lista completa no relatório).

## Configuração (opcional) em `loja.config.json`

```json
"seo": { "dominio": "https://www.minhaloja.com.br", "pasta": "pecas", "titulo": "Peças por veículo", "descricao": "..." }
```

Usa também `loja.nome`, `loja.whatsapp`, `loja.pagina3d` e `tema.acento`. Sem `seo.dominio` o script avisa e usa um domínio de exemplo.

## Saída

- `/<pasta>/index.html` índice por marca e modelo
- `/<pasta>/<veiculo-id>/index.html` página do veículo
- `/<pasta>/<veiculo-id>/<peca>.html` página da peça (só com produto compatível ou universal)
- `/sitemap.xml`, `/robots.txt`

Publique o conteúdo de `--saida` na raiz do domínio (os links internos são absolutos a partir da raiz).

## Nomes das peças

`node ferramentas/extrair-nomes-pecas.mjs` regenera `nomes-pecas.json` a partir de ZONAS/GRUPOS da página completa.

## Regras e limitações

- Chaves iniciadas por `corte-` (simulações 3D) e chaves sem nome no dicionário são ignoradas.
- Chaves com o mesmo nome, ou que listam exatamente os mesmos produtos, viram uma única página (evita conteúdo duplicado).
- A compatibilidade vem só de `veiculos`/`universal`; o ano do produto é apenas exibido.
- Sem dado de estoque: o JSON-LD não informa `availability`.
- A pasta `<saida>/<pasta>` é apagada e recriada a cada execução.
