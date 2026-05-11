# Pixie Sunny — Estúdio Criativo Local-First

MVP executável para uso pessoal focado em:

- escrita assistida de livros e construção de universos
- memória persistente (lore/cânone)
- organização por projetos, livros, capítulos, cenas e personagens
- base de especificações para geração fiel de imagem e vídeo em workflow local/offline

## Como rodar localmente

### Opção 1 (mais simples)
Abra `index.html` no navegador.

### Opção 2 (servidor local)
```bash
python -m http.server 8080
# depois abra http://localhost:8080
```

## Funcionalidades já implementadas

- CRUD básico local-first com persistência em `localStorage`
- estrutura de dados para:
  - projetos
  - livros
  - capítulos
  - personagens (com traços canônicos + prompt mestre + negative prompt)
  - cenas
  - memória/lore
  - assets locais (imagem/vídeo/referências)
- sugestão inicial de escrita baseada em capítulo + lore + personagens
- busca em memória/lore
- geração de **spec** de imagem para fidelidade narrativa/visual
- geração de **spec** de vídeo (image-to-video) com foco em pipeline local
- exportação/importação de backup JSON

## Arquitetura local-first

- Frontend: HTML/CSS/JS vanilla (sem dependências)
- Persistência: `localStorage` no dispositivo do usuário
- Fluxo offline: dados e assets podem ser mantidos localmente
- Pontos de extensão para IA local:
  - `src/pipelines.js#runImagePipeline`
  - `src/pipelines.js#runVideoPipeline`

## Estrutura do projeto

- `index.html`: interface inicial utilizável
- `src/app.js`: fluxo da aplicação e telas
- `src/models.js`: modelos de dados
- `src/store.js`: persistência local-first
- `src/assistant.js`: fluxos iniciais de escrita/memória/specs
- `src/pipelines.js`: integração futura com geradores locais
- `src/pipelines.md`: guia de extensão de pipeline
- `tests/store.test.js`: testes focados em persistência e busca de lore

## Testes

```bash
npm test
```

## Próximas etapas recomendadas

1. Conectar `src/pipelines.js` com runner local de imagem/vídeo.
2. Adicionar versionamento canônico de personagens e cenas aprovadas.
3. Implementar ranking automático de fidelidade visual por checklist canônico.
4. Adicionar integração opcional com transcrição/áudio ambiente local.
