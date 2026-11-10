# Modelos reais (.glb) e giro 360° com fotos

O visualizador de peças usa modelos 3D gerados por código (esquemáticos). Para um visual **fotorrealista**,
você pode trocar qualquer peça por um modelo real ou por fotos 360°. Os dois recursos já estão prontos no
código; falta só você fornecer os arquivos.

## 1) Modelo real em glTF/GLB
1. Obtenha o modelo da peça (CAD do fornecedor convertido para GLB, escaneamento 3D, ou banco de modelos com licença).
2. No Blender (ou outro editor), deixe **cada peça como um objeto de primeiro nível** e, em *Custom Properties*
   (vira `extras` no glTF), adicione:
   - `part`: a chave da peça (ex.: `lente-farol`, `lampada-farol`, `refletor`...). As chaves válidas estão no
     objeto `GRUPOS` de `fonte/pagina-completa.html`; a peça principal usa a chave do próprio sistema (ex.: `farol`).
   - `d`: vetor da explosão, em unidades do modelo, ex.: `[0, 0, 1.2]`.
   - `at`: atraso da peça na animação (0 a 0.6). Opcional.
3. Exporte em .glb (com compressão Draco/Meshopt se ficar pesado; alvo de até 3 MB).
4. Hospede o arquivo (no repositório `autoford-carros3d`, por exemplo) e registre em `fonte/pagina-completa.html`:
   `const MODELOS_REAIS = { 'farol': 'https://cdn.jsdelivr.net/gh/alexiskara/autoford-carros3d@COMMIT/app/farol.glb' };`
5. Rode `node dev/build.cjs`, publique e atualize o commit na página (veja PUBLICAR.md).


## 2) Giro 360° com fotos reais
1. Fotografe a peça sobre fundo liso, girando em passos iguais (24 a 36 fotos). Nomeie `01.jpg`, `02.jpg`...
2. Hospede a pasta e registre em `fonte/pagina-completa.html`:
   `const GIROS_360 = { 'farol': { base: 'https://.../farol/', n: 36, ext: 'jpg', pad: 2, inicio: 1 } };`
   Pontos clicáveis são opcionais: `hotspots: [{ de: 0, ate: 8, x: 40, y: 55, k: 'lente-farol', nome: 'Lente' }]`.
3. Quando a peça tem fotos, aparece o botão **360°** no palco para alternar entre o modelo 3D e as fotos.

## Realidade aumentada
O botão de AR gera um .glb do modelo atual e abre no visualizador do aparelho (Android: Scene Viewer/WebXR;
iPhone: Quick Look). Funciona também com os modelos reais da opção 1. Só abre em celulares compatíveis.
