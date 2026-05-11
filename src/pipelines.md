# Extensão de pipelines locais

Este arquivo descreve os pontos de extensão para geração local/offline:

- `runImagePipeline(sceneSpec)` em `src/pipelines.js`
- `runVideoPipeline(videoSpec)` em `src/pipelines.js`

Estratégia recomendada:

1. Receber `sceneSpec` e `videoSpec` gerados pela interface.
2. Converter para payload da ferramenta local (ComfyUI, InvokeAI, etc.).
3. Executar o runner local e salvar saída em pasta local do usuário.
4. Registrar o caminho final em `assets` no app.
