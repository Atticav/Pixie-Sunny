# Pixie Sunny — Estúdio Criativo Local-First

MVP executável para uso pessoal focado em:

- escrita assistida de livros e construção de universos
- memória persistente (lore/cânone)
- organização por projetos, livros, capítulos, cenas e personagens
- base de especificações para geração fiel de imagem e vídeo em workflow local/offline

## Comece por aqui (Docs + Demo + Launch Readiness)

Se você está chegando agora, use esta ordem curta:

1. **Quick start local:** seção [Como rodar localmente](#como-rodar-localmente)
2. **Fluxo principal + roteiro de demo:** [`docs/demo-quickstart.md`](docs/demo-quickstart.md)
3. **Configuração de geração local (opcional):** [`docs/image-generation.md`](docs/image-generation.md)

Princípios do produto:

- **local-first no MacBook**
- **sem backend SaaS obrigatório**
- **estado e operação rastreáveis** (recipes, checkpoints, sandbox, promote/merge, closure)

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
  - beats e shots com status editorial
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
- **Shot Planner** local-first com organização por capítulo → cena → beat → shot
- camada de **continuidade visual** com campos de preservar/variar/riscos e referências canônicas da sequência
- associação pragmática entre shot e prompts, outputs de imagem aprovados/canônicos, vídeos locais, referências visuais e personagens
- filtros por personagem, cena, capítulo, status editorial e tipo de plano
- progressão visual/narrativa da sequência e comparação contextual entre shot anterior/atual/próximo
- camada de **Assistive Planning / Creative Orchestration** com recomendações automáticas:
  - next best action
  - missing dependency
  - review required
  - canon conflict to resolve
  - recommended asset to generate
  - scene not production-ready
- priorização pragmática por bloqueio, impacto, completude e risco de inconsistência
- visualização por projeto, capítulo, sequência e cena com quick actions para abrir os estúdios certos do pipeline
- exportação/importação de backup JSON
- limpeza automática de dados órfãos ao importar backups ou remover entidades relacionadas

### QA / Hardening pass (focado)

- guardrails adicionais para ações inválidas em Promote / Merge e Export / Closure
- prevenção de duplicidade acidental na confirmação de promoções de sandbox
- validação explícita para evitar gerar closure export sem seções incluídas
- mensagens de status mais claras no fechamento de export (blockers/warnings)
- persistência local mais resiliente com recuperação via backup quando o payload principal estiver corrompido

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
- planejamento visual também é persistido localmente no mesmo estado, em `beats` e `shots`, preservando ordem de cena, vínculos editoriais e continuidade
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

## Shot Planner + Continuidade Visual

O app agora dá o passo de **assets isolados para sequência planejada**:

- use o bloco **Shot Planner & Continuidade Visual** para navegar por capítulo, cena, personagem, status e tipo de plano
- crie **beats** para estruturar a intenção dramática da cena e depois adicione **shots** em ordem editorial
- cada shot registra:
  - tipo de plano
  - ângulo
  - movimento de câmera
  - personagem em foco
  - emoção dominante
  - ambiente
  - objetivo narrativo
  - ritmo/intensidade
  - notas do diretor
  - progressão visual e narrativa
- vincule cada shot aos artefatos já existentes do pipeline local-first:
  - `promptDocuments`
  - outputs de imagem revisados/canônicos
  - vídeos locais em `assets`
  - referências visuais em `referenceImages`
  - personagens canônicos
- use os campos de continuidade para marcar:
  - o que precisa permanecer igual
  - o que pode variar
  - riscos de quebra
  - referências canônicas da sequência

### Como isso conecta com o pipeline já existente

- **Prompt Builder** segue sendo a origem dos prompts estruturados que podem ser ligados diretamente ao shot
- **Image Review + Canon Promotion** fornece imagens aprovadas/canônicas para ancorar continuidade entre shots
- **Image-to-Video / assets locais** podem ser associados a shots específicos para manter histórico audiovisual da sequência
- tudo continua **local-first e Mac-first**, sem backend SaaS, reaproveitando o mesmo storage estruturado do projeto

## Assistive Planning / Creative Orchestration Layer

O app agora conecta todas as camadas em um copiloto operacional:

- recomenda próximos passos práticos com base no estado real do pipeline
- detecta dependências faltantes e bloqueios de produção por cena
- prioriza revisão canônica quando há outputs aguardando triagem
- sinaliza conflitos canônicos e riscos de continuidade
- sugere assets para gerar quando prompt grounding já está pronto
- indica explicitamente quando a cena ainda não está production-ready

### Como encaixa no pipeline atual

- usa **Shot Planner** para detectar cobertura e lacunas de sequência
- usa **Prompt Builder / Prompt Grounding** para validar se a cena já está pronta para gerar
- usa **Image Review + Canon Promotion** para priorizar revisão e resolver conflitos canônicos
- usa **Story/Lore + referências** para reduzir risco de inconsistência antes de avançar
- tudo permanece **local-first no MacBook**, sem backend SaaS

## Review Inbox / Triage Workspace

O app agora inclui uma camada operacional de revisão humana para centralizar sinais críticos dispersos:

- consolida em uma inbox única itens que pedem atenção humana (review, risco, bloqueio, stale/refresh, follow-up editorial)
- integra sinais do:
  - **Production Readiness Dashboard / Assistive Planning**
  - **Consistency Checker** (riscos e bloqueios em shots)
  - **Diff Viewer / Context Compare Workspace** (candidatos para comparação)
  - **Asset Version Lineage / Supersession Graph**
  - **Approval & Decision History Layer / Editorial Timeline**
  - **Change Impact / Dependency Refresh**
  - **Local Automation Rules Engine / Batch Queue**
- oferece triagem com:
  - filtros por tipo, prioridade, risco, status, entidade, capítulo e cena
  - ordenação e agrupamento
  - explicação explícita do porquê o item está na inbox
  - quick actions: approve, reject, defer, mark for refresh, open diff, open lineage, open source entity, navigate context
  - ações em lote para reduzir custo operacional de revisão
  - saved views/filtros salvos para rotinas recorrentes de operação editorial
  - navegação por teclado (setas, espaço para seleção, enter para abrir contexto)
- arquitetura segue **local-first no MacBook**, sem backend SaaS

## State Snapshot / Workspace Checkpoints (MVP)

O app agora inclui uma camada de checkpoints operacionais para memória explícita de trabalho:

- cria checkpoints nomeados por projeto com metadata básica:
  - nome
  - timestamp
  - motivo (`reason`)
  - notas (`notes`)
- guarda um snapshot útil e leve do estado operacional (contagens de entidades, sinais de inbox e readiness)
- lista checkpoints existentes localmente no workspace (sem backend SaaS)
- compara checkpoint vs estado atual com:
  - diff de metadata
  - highlights semânticos
  - diff textual de contexto para readiness/inbox
- integrações rápidas no próprio painel:
  - abrir **Diff Viewer / Context Compare**
  - abrir **Editorial Timeline / Decision History**
  - navegar para **Production Readiness Dashboard**
  - navegar para **Review Inbox / Triage Workspace**

Este MVP estabelece a base para evoluções futuras (restore, branching e fluxos mais avançados) mantendo escopo pequeno e mergeável.

## Workspace Branching / Scenario Sandbox (MVP)

O app agora inclui uma superfície local-first para experimentar caminhos alternativos sem contaminar o workspace principal:

- cria sandboxes por projeto com metadata básica:
  - nome
  - propósito
  - status/categoria (`exploratory`, `candidate`, `review-ready`)
  - timestamps de criação/atualização
- lista sandboxes existentes no workspace local
- permite selecionar um sandbox e comparar rapidamente sandbox vs estado principal com:
  - diff de metadata operacional
  - highlights semânticos
  - diff textual de contexto (readiness/inbox)
- integrações rápidas no painel:
  - **Diff Viewer / Context Compare**
  - **Editorial Timeline / Decision History**
  - **Review Inbox / Triage Workspace**
  - **Workflow Recipes / Guided Playbooks**
  - **State Snapshot / Workspace Checkpoints**
- inclui atualização manual de snapshot do sandbox para registrar progresso exploratório

Este slice entrega valor prático imediato e prepara a fundação para próximos passos de **promote/merge/commit-to-main** sem depender de backend SaaS.

## Promote / Merge / Commit-to-Main Flow (MVP)

O app agora inclui um fluxo local-first para promover um sandbox candidato ao workspace principal, registrando a decisão de forma rastreável:

- seleciona um sandbox existente (com status `exploratory`, `candidate` ou `review-ready`) como candidato à promoção
- exibe um **resumo compacto de promoção**:
  - sandbox de origem (nome, propósito, status/readiness)
  - target (workspace principal do projeto)
  - impacto por snapshot: cenas, personagens, beats, shots, prompts, outputs, decisões
  - timestamp do snapshot de referência
- aceita **notas opcionais** sobre a promoção antes da confirmação
- fluxo de **confirmação guiada** com botão "Confirmar promoção →" + opção de cancelar
- registra a promoção em `state.sandboxPromotions` com metadata completa:
  - `sandboxId`, nome, propósito, status do sandbox de origem
  - `sandboxSnapshot` no momento da promoção
  - `targetLabel`, notas, `impactSummary`
  - `status: 'confirmed'` e `promotedAt`
- exibe **histórico de promoções** do projeto na mesma superfície
- botão "Promover →" nos cards de sandbox permite iniciar o fluxo diretamente, com scroll automático para a seção
- integração com **Workspace Branching / Scenario Sandbox**: sandboxes com status `review-ready` aparecem como candidatos naturais

### Onde se encaixa no fluxo maior

```
[criar sandbox] → [explorar] → [comparar vs workspace principal] → [confirmar promoção] → [registro rastreável]
```

Este MVP recovery slice fecha o ciclo decisório básico e estabelece fundação para:
- resolução de conflitos conceituais em promoções futuras
- rollback / revert de promoções
- merge com diff assistido entre sandbox e workspace principal
- governança de branch health e promoções automáticas baseadas em readiness

## Export / Delivery / Production Closure Layer (MVP)

O app agora inclui uma superfície prática de fechamento final de produção, local-first e sem dependência SaaS:

- painel de **preflight/readiness final** com três grupos visíveis:
  - `ready items`
  - `warnings`
  - `blockers`
- agrega sinais de:
  - **Production Readiness Dashboard**
  - **Review Inbox / Triage Workspace**
  - dependências faltantes e follow-ups editoriais quando detectáveis
- inclui ações rápidas para navegar direto para:
  - readiness
  - inbox
  - sandbox
  - promote/merge
  - checkpoints
- permite escolher o que entra no fechamento/export (`includes`):
  - readiness summary
  - inbox digest
  - histórico de promoções
  - checkpoints
  - timeline editorial
  - snapshot metrics
- gera um **closure export summary** estruturado (`.json`) com:
  - metadados do projeto
  - resumo de preflight (ready/warnings/blockers)
  - composição do pacote
  - seções incluídas
- salva no workspace local (quando habilitado) e registra histórico em `state.productionClosures`

### Como este MVP se conecta ao roadmap de delivery

Este slice fecha o fluxo operacional ponta a ponta no nível MVP:

```
[readiness + inbox + branch/promote/checkpoint sinais] → [preflight final] → [seleção de composição] → [closure export local]
```

Com essa base, evoluções futuras podem adicionar:
- empacotamento multi-arquivo (assets + manifests)
- validações mais estritas por tipo de entrega

## Product Polish + UX Consistency Pass

Passo de acabamento focado para deixar as superfícies operacionais mais coesas sem redesenhar o produto:

- naming e labels mais consistentes entre Review Inbox, Scenario Sandbox, Promote / Merge, Checkpoints e Production Closure
- empty states e mensagens-resumo com indicação explícita do próximo passo
- navegação rápida entre superfícies operacionais relacionadas
- playbook adicional cobrindo o fluxo de sandbox até closure final
- automações de entrega e handoff local.

## Approval & Decision History Layer

O app agora registra e navega decisões editoriais/operacionais por item:

- decisões suportadas:
  - approve
  - reject
  - promote to canon
  - supersede
  - send back for revision
  - archive/deprecate
- escopos suportados:
  - asset
  - shot
  - scene
  - sequence
  - briefing
  - canon entry
  - visual reference
- cada evento guarda:
  - tipo de decisão
  - timestamp
  - rationale/notas
  - item alvo
  - item relacionado/substituto (quando houver)
  - status resultante

### Onde usar no app

- no **Image Review + Canon Promotion**, ações de revisão passam a registrar trilha de decisão
- a aba **Decision History** mostra histórico navegável por escopo/item, com filtros de status editorial
- há visão rápida de **latest approved** e destaques de **current official / superseded / pending review**
- eventos de canon e referências conectam Story Bible, Character Canon, Reference Studio, Prompt/Briefing, Production Board e Consistency flows por escopos relacionados
- tudo segue **local-first e Mac-first**, sem backend SaaS

## Asset Version Lineage / Supersession Graph

O app agora inclui uma camada estrutural de evolução de assets/outputs para visualizar cadeia de versões, supersessão e origem editorial:

- modela e exibe relações `original`
- modela e exibe relações `derived / variant`
- modela e exibe relações `candidate`
- modela e exibe relações `approved version`
- modela e exibe relações `superseded version`
- modela e exibe relações `canon-promoted version`
- modela e exibe relações `deprecated / archived branch`
- destaca `current official` e `source of truth` por projeto/fluxo de revisão
- permite navegar predecessores e sucessores diretamente da aba de lineage para a revisão detalhada
- aplica filtros por tipo de asset e status de versão para inspeção rápida

### Onde usar no app

- no **Image Review Studio**, nova aba **Lineage / Supersession** para navegar o grafo incremental de evolução
- integração direta com **Approval & Decision History** (eventos `supersede`, `approve`, `promote_to_canon`)
- integração com **Image Review + Canon Promotion** e **Reference Studio** via marcadores de canon e promoções
- base pronta para timeline editorial, ancestry/diff viewer e governança visual mais forte em próximos PRs
- arquitetura segue **local-first no MacBook**, sem backend SaaS

## Diff Viewer / Context Compare Workspace

O app agora inclui um workspace de comparação pragmático para inspecionar mudanças reais entre versões conectadas do pipeline:

- modos de diff:
  - **side-by-side** para leitura comparativa direta de versão A vs B
  - **inline** para inspeção linha a linha em texto relevante
- tipos suportados na comparação:
  - canon entries (personagens e universe memory/lore)
  - briefings e versões de prompt
  - prompts de geração (output prompt + notas)
  - cenas
  - shots
  - assets metadata (outputs, referências e assets locais)
  - sinais editoriais/readiness (status de revisão, canon, contexto e prontidão)
- conexões de versão sugeridas automaticamente por fluxos já existentes:
  - **Approval & Decision History Layer**
  - **Asset Version Lineage / Supersession Graph**
  - **canon promotion**
  - **refresh / rewrite** de versões de prompt

### Como encaixa no pipeline geral

- roda dentro do **Image Review Studio** (aba **Diff Viewer / Context Compare**), local-first no MacBook
- conecta inspeção de diff com:
  - Decision History
  - Lineage / Supersession
  - Prompt Grounding / Context Assembly
  - Story Bible / Universe Memory
  - Character Canon Studio
  - Reference Studio
  - Scene Briefing Generator / Director Pack
  - Production Board
  - Assistive Planning (impacto/readiness)
- fornece highlights semânticos e quick links para revisar/aprofundar as ações no fluxo
- mantém a base pronta para próximos PRs de review editorial avançado, merge guidance e governança contextual mais forte

## Docs + Demo + Launch Readiness (este pass)

Melhorias aplicadas neste pass focado de lançamento:

- novo guia curto de onboarding + demo em `docs/demo-quickstart.md`
- documentação concisa do fluxo principal ponta a ponta e das superfícies-chave
- roteiro recomendado para demonstração (10–15 min) com caminho de navegação claro
- framing explícito de operação local-first e handoff sem SaaS

## Estrutura do projeto

- `index.html`: interface inicial utilizável
- `src/app.js`: fluxo da aplicação e telas
- `src/models.js`: modelos de dados
- `src/store.js`: persistência local-first
- `src/local-workspace.js`: camada de filesystem/storage local e convenções de diretório Mac-first
- `src/assistant.js`: fluxos de escrita/memória, geração local de prompts, specs e presets
- `src/asset-lineage.js`: construção local do grafo de lineage/supersession de versões de assets
- `src/pipelines.js`: integração futura com geradores locais
- `src/pipelines.md`: guia de extensão de pipeline
- `docs/demo-quickstart.md`: roteiro curto de onboarding + demo + fluxo principal
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
