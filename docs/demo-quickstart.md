# Demo Quick Start — Pixie Sunny

Guia curto para onboarding, avaliação e demo do fluxo principal do produto.

## 1) Setup rápido (2 minutos)

1. Abra `index.html` no navegador  
   **ou**
2. Rode:

```bash
python -m http.server 8080
```

Depois abra `http://localhost:8080`.

> O app é **local-first no MacBook** e não depende de backend SaaS para o fluxo principal.

## 2) Fluxo principal (visão de lançamento)

Use este mapa para entender como os módulos se conectam:

1. **Workflow Recipes / Guided Playbooks**  
   ponto de entrada guiado para operações recorrentes.
2. **Review Inbox / Triage Workspace** + **Diff Viewer / Context Compare**  
   revisar sinais críticos, comparar contexto e reduzir ambiguidade de decisão.
3. **Production Readiness Dashboard**  
   validar sinais de prontidão antes de promover/fechar.
4. **State Snapshot / Workspace Checkpoints**  
   registrar marcos de estado para rastreabilidade.
5. **Workspace Branching / Scenario Sandbox**  
   explorar hipóteses sem contaminar o workspace principal.
6. **Promote / Merge / Commit-to-Main Flow**  
   confirmar decisão com resumo de impacto e trilha registrada.
7. **Export / Delivery / Production Closure Layer**  
   gerar fechamento final (`.json`) com composição selecionável.

## 3) Roteiro recomendado de demo (10–15 minutos)

### Caminho A — do sandbox ao fechamento (recomendado)

1. Abra **Workflow Recipes** e selecione `Do sandbox ao closure final`
2. Vá para **Scenario Sandbox** e selecione/ajuste um sandbox `review-ready`
3. Use **Diff Viewer / Context Compare** para comparar contexto principal vs candidato
4. Passe por **Review Inbox** para triagem rápida de pendências
5. Confira o **Production Readiness Dashboard**
6. Salve um **Workspace Checkpoint**
7. Execute **Promote / Merge / Commit-to-Main**
8. Finalize em **Export / Delivery / Production Closure** gerando o summary JSON

### Caminho B — pré-export rápido

1. Abra o playbook `Fluxo de prontidão pré-export`
2. Revise blockers/warnings
3. Gere o export JSON final com as seções necessárias

## 4) Conteúdo demo-friendly (sem seed obrigatório)

Para uma demo limpa e rápida:

- crie um projeto dedicado (ex.: `Demo Launch Readiness`)
- mantenha pelo menos 1 sandbox `review-ready`
- mantenha 1 checkpoint recente
- deixe 1 item visível na inbox para mostrar triagem
- gere 1 closure export no final para mostrar handoff local

## 5) O que mostrar no pitch de lançamento

- fluxo **ponta a ponta**: hipótese → revisão → decisão → promoção → fechamento
- governança de contexto: Inbox + Diff + Readiness + Decision History
- operação **100% local-first**, com rastreabilidade e export final estruturado
