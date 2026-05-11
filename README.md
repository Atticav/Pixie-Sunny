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

- CRUD local-first com criação, edição e exclusão para projetos, livros, capítulos, personagens, cenas e lore
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
- **Prompt Builder orientado por referência** para personagens e cenas
- saídas estruturadas: prompt mestre, negative prompt, versão curta/detalhada, prompt visual/cinematográfico
- presets de estilo, preset cinematográfico e preset de lente/luz
- histórico/versionamento local de prompts, duplicação, favorito/oficial e exportação `.txt`/`.json`
- exportação/importação de backup JSON
- limpeza automática de dados órfãos ao importar backups ou remover entidades relacionadas

## Arquitetura local-first

- Frontend: HTML/CSS/JS vanilla (sem dependências)
- Persistência estruturada: `localStorage` no dispositivo do usuário
- Filesystem local (Mac-first): OPFS (`navigator.storage.getDirectory`) com diretórios dedicados para projetos, referências, outputs, exportações e settings
- Fluxo offline: dados e assets podem ser mantidos localmente
- Pontos de extensão para IA local:
  - `src/pipelines.js#runImagePipeline`
  - `src/pipelines.js#runVideoPipeline`

### App shell Mac-first

A aplicação agora inclui um shell de configuração local em **Mac Local Workspace** para:

- definir convenções de diretórios locais
- inicializar a estrutura de filesystem local
- espelhar o estado estruturado do projeto em arquivo real no disco local
- salvar referências visuais e exportações em diretórios dedicados

### Como os dados ficam salvos localmente

- chave usada no navegador: `pixieSunnyStudio`
- local de armazenamento estruturado: `localStorage` do browser atual
- persistência: automática a cada criação/edição/exclusão
- espelhamento opcional por projeto em filesystem local:
  - `projects/<projectId>/project-state.json`
- referências visuais (quando arquivo local é enviado):
  - `references/<projectId>/<referenceId>-<fileName>`
- exportações (backup e prompt txt/json):
  - `exports/<arquivo>`
- configurações do app local:
  - `settings/app-settings.json`
- portabilidade: use **Exportar JSON** para gerar um backup e **Importar JSON** para restaurar em outro navegador ou máquina
- integridade: imports inválidos são saneados e registros órfãos são descartados para manter a hierarquia projeto → livro → capítulo → cena consistente
- prompts estruturados ficam em `promptDocuments` no mesmo estado local-first, incluindo:
  - alvo (`character` ou `scene`)
  - modo (`image` ou `video`)
  - referências selecionadas
  - presets aplicados
  - versões salvas com campos de preservar/variar e saídas textuais

## Prompt Builder orientado por referência

### Como os prompts são gerados

- **Prompt de personagem** combina:
  - ficha visual canônica
  - referências selecionadas
  - regras de consistência visual
  - notas cinematográficas
  - campos explícitos de **preservar** vs **variar**
- **Prompt de cena** combina:
  - capítulo/cena atual
  - personagens inferidos pelo contexto
  - lore relevante
  - referências visuais selecionadas
  - tom emocional, ambiente, iluminação e composição

### Como os prompts são armazenados

- cada documento de prompt é salvo localmente em `promptDocuments`
- cada documento mantém:
  - metadados do builder (alvo, presets, referências, contexto)
  - status de favorito/oficial
  - múltiplas versões
- cada versão registra:
  - preservar / variar
  - prompt mestre
  - negative prompt
  - versão curta / detalhada
  - prompt visual da cena
  - prompt cinematográfico
  - variações
  - checklist do que deve permanecer fixo

### Como exportar

- use **Exportar texto** para gerar um `.txt` pronto para workflows locais
- use **Exportar JSON** para exportar o documento ativo com metadados e versão atual
- a exportação global do app continua disponível via backup JSON na barra superior

## Estrutura do projeto

- `index.html`: interface inicial utilizável
- `src/app.js`: fluxo da aplicação e telas
- `src/models.js`: modelos de dados
- `src/store.js`: persistência local-first
- `src/local-workspace.js`: camada de filesystem/storage local e convenções de diretório Mac-first
- `src/assistant.js`: fluxos iniciais de escrita/memória/specs
- `src/assistant.js`: geração local de prompts, specs e presets
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
