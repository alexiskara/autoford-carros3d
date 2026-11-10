# Usar o sistema em outra loja de autopeças

O sistema foi feito para qualquer loja. Tudo o que é específico da loja fica em **três arquivos**; o resto (modelos 3D,
simuladores, mapa de peças, diagnóstico, botão de compatibilidade) é o mesmo para todos.

| Arquivo | O que é | Quem faz |
|---|---|---|
| `loja.config.json` | identidade da loja, plataforma, links, cor | você edita |
| `catalogo.json` | produtos e veículos compatíveis | gerado a partir do CSV da loja |
| `cars.json` + modelos `.glb` | carros com modelo 3D da carroceria (opcional) | opcional |

A pasta `exemplo-loja/` tem um exemplo completo para copiar.

## 1) Configuração (`loja.config.json`)
```json
{
  "loja": { "nome": "Minha Loja", "whatsapp": "5511999999999", "pagina3d": "/encontre-pecas/" },
  "plataforma": "iset",
  "buscaUrl": "",
  "base": "https://cdn.jsdelivr.net/gh/SEU-USUARIO/SEU-REPO@COMMIT",
  "veiculos": "cars.json",
  "catalogo": "catalogo.json",
  "carrosVisiveis": null,
  "tema": { "acento": "#ff6a00" },
  "produto": { "seletorAncora": "", "posicao": "antes" }
}
```
- **plataforma**: `iset` (busca e carrinho completos), `shopify` ou `woocommerce` (busca pela API da loja; o botão de
  compra leva à página do produto) ou `generica` (usa só o `catalogo.json`; links para a busca da loja em `buscaUrl`,
  por exemplo `/busca?q={q}`).
- **catalogo**: caminho do `catalogo.json` (relativo a este arquivo).
- **carrosVisiveis**: lista de ids de veículos a exibir; `null` mostra todos.
- **produto**: onde inserir o botão "Veículos compatíveis" (`seletorAncora` é um seletor CSS do botão de compra).

## 2) Catálogo de produtos e compatibilidade
1. Exporte os produtos da loja em CSV com as colunas `nome; sku; url; preco; preco_de; imagem`.
2. Crie `veiculos.csv`: `id; marca; modelo; anos; motor; categoria; arquivo3d` (anos como `2011-2016`; `arquivo3d` só se houver modelo 3D).
3. (Opcional) `compat.csv` com `sku; veiculo` para compatibilidades confirmadas, que sobrepõem a leitura do nome.
4. Gere o catálogo:
   ```
   node ferramentas/gerar-catalogo.mjs --produtos produtos.csv --veiculos veiculos.csv --saida catalogo.json
   ```
   O script reconhece a peça e o veículo pelo **nome do produto** (ex.: "Termostato Jeep Compass 2.0 2011 a 2016") e
   avisa quantos produtos ficaram sem peça ou sem veículo. Revise o resultado: nomes ambíguos precisam de `compat.csv`.

## 3) Hospedar
Coloque `loja.config.json`, `catalogo.json` (e `cars.json`/`.glb`, se houver) em um endereço público com CORS liberado:
GitHub + jsDelivr, GitHub Pages ou o CDN da própria loja.

## 4) Página "Encontre peças" (mapa, 3D e diagnóstico)
Gere a página com a configuração da loja e cole no editor de página da plataforma:
```
node carros3d/landing/build.cjs <commit> minha-loja/loja.config.json https://seu-cdn/minha-loja/loja.config.json
```
O 3º argumento injeta `window.APC_CONFIG`, apontando o sistema para os dados da sua loja. O nome e a inicial no cabeçalho
vêm de `loja.nome`.

## 5) Botão "Veículos compatíveis" na página do produto
Uma linha no modelo da página de produto (ou em "código personalizado" da plataforma):
```html
<script>window.APC_CONFIG = 'https://seu-cdn/minha-loja/loja.config.json';</script>
<script type="module" src="https://cdn.jsdelivr.net/gh/SEU-USUARIO/SEU-REPO@COMMIT/app/compat-produto.js"></script>
```
O script identifica o produto pelo endereço da página (ou pelo SKU, via dados estruturados) e, se ele estiver no catálogo
com veículos, insere o botão e o modal com cartões de veículos e "Ver no 3D". Sem catálogo ou produto fora dele, não faz nada.

## O que já funciona sem catálogo
O mapa de peças, os simuladores, o diagnóstico por sintoma, o AR e a busca na loja funcionam sem `catalogo.json`. O catálogo
acrescenta: números de produtos no mapa, listas instantâneas, selo "Serve no <veículo>" e o botão de compatibilidade.

## Limites conhecidos
- Os adaptadores Shopify e WooCommerce foram escritos para as APIs públicas dessas plataformas, mas **não foram testados
  em lojas reais**.
- A leitura de peça e veículo pelo nome é uma estimativa: confira o relatório do gerador.
- Modelos 3D de carros específicos precisam de arquivos `.glb` com licença adequada; sem eles o veículo aparece com o
  mapa de peças e os simuladores, mas sem a carroceria 3D.
