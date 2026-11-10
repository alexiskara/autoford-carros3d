# Painel de Demanda - guia do lojista

O painel mostra o que seus clientes procuram no site, e principalmente o que eles
procuram e você **não tem** (demanda perdida). Ele tem duas partes:

- `receptor-apps-script.gs`: recebe os eventos do site e guarda numa planilha Google (grátis).
- `painel-demanda.html`: o painel, que você abre no navegador (não precisa instalar nada).

## 1. Publicar o receptor

1. Crie uma planilha Google vazia e abra **Extensões > Apps Script**.
2. Cole o conteúdo de `receptor-apps-script.gs` e salve.
3. Em **Configurações do projeto > Propriedades do script**, crie a propriedade
   `TOKEN` com uma senha longa e aleatória (guarde-a). Opcional: `SENHA_LEITURA`,
   uma senha só para ler os dados.
4. Clique em **Implantar > Nova implantação > App da Web**. Executar como: **Eu**;
   Quem tem acesso: **Qualquer pessoa**. Autorize e copie a URL que termina em `/exec`.

## 2. Ligar o site ao receptor

No `loja.config.json`, acrescente:

```json
"analytics": {
  "endpoint": "https://script.google.com/macros/s/SEU_ID/exec",
  "token": "O_MESMO_TOKEN"
}
```

Publique o site. A cada acesso, os eventos passam a aparecer na aba `eventos` da planilha.

## 3. Abrir o painel

1. Abra `painel-demanda.html` no navegador (duplo clique).
2. Cole a URL do receptor e o token (senha de leitura, se tiver criado) e clique em
   **Carregar do receptor**. Os dados ficam salvos neste navegador para a próxima vez.
3. Alternativas: arraste um arquivo `.json` ou `.csv` exportado da planilha
   (Arquivo > Fazer download > CSV), ou clique em **Modo demonstração** para ver o
   painel com dados fictícios.
4. Use os filtros de período (7/30/90 dias/tudo) e de veículo.

## Como ler os painéis

- **Demanda perdida**: peças buscadas sem produto. Use **Copiar lista** ou **Exportar CSV**
  para decidir o que cadastrar ou comprar.
- **Funil e conversão**: onde os clientes desistem (veículo, parte, resultado, produto, carrinho).
- **Peças mais procuradas, sintomas, veículos, produtos, AR/3D**: orientam estoque e divulgação.

## Privacidade e limites

- O receptor não grava IP nem cabeçalhos; campos como ip, e-mail, telefone e CPF são descartados.
- Quem souber a URL e o token consegue ler ou gravar: não divulgue o token. O token do
  `loja.config.json` fica visível no código do site, então use um token de gravação diferente
  da `SENHA_LEITURA` (que só você usa no painel).
- Apps Script tem cotas diárias gratuitas; para lojas com muito tráfego, exporte e limpe a
  planilha de tempos em tempos. O painel carrega até 20.000 eventos recentes por vez.
- O painel conta sessões pelo identificador `s` enviado pelo site.
