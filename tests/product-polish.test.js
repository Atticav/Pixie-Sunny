import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPreflightStatusMessage,
  buildProjectCollectionSummary,
  buildPromotionGuidance,
  buildReviewInboxSummary
} from '../src/product-polish.js';

test('buildProjectCollectionSummary handles empty and populated collections', () => {
  assert.equal(
    buildProjectCollectionSummary({
      count: 0,
      singular: 'sandbox',
      plural: 'sandboxes',
      emptyMessage: 'Nenhum sandbox criado ainda neste projeto.',
      nextStepWhenEmpty: 'crie um sandbox',
      nextStepWhenPopulated: 'compare um candidato'
    }),
    'Nenhum sandbox criado ainda neste projeto. Próximo passo: crie um sandbox'
  );

  assert.equal(
    buildProjectCollectionSummary({
      count: 2,
      singular: 'checkpoint',
      plural: 'checkpoints',
      emptyMessage: 'Nenhum checkpoint criado ainda neste projeto.',
      nextStepWhenEmpty: 'salve um checkpoint',
      nextStepWhenPopulated: 'compare um checkpoint'
    }),
    '2 checkpoints local-first neste projeto. Próximo passo: compare um checkpoint'
  );
});

test('buildReviewInboxSummary describes clean and filtered inbox states', () => {
  assert.match(
    buildReviewInboxSummary({ totalCount: 0 }),
    /Inbox limpa neste projeto/
  );

  assert.equal(
    buildReviewInboxSummary({
      filteredCount: 2,
      totalCount: 5,
      blockedCount: 1,
      highRiskCount: 3,
      hasActiveFilters: true
    }),
    '2/5 itens visíveis com os filtros atuais · 1 bloqueado(s) · 3 de alto risco. Próximo passo: resolva os bloqueios e use o Diff Viewer / Context Compare para decidir os casos ambíguos.'
  );
});

test('buildPromotionGuidance reflects project, sandbox and selection state', () => {
  assert.match(buildPromotionGuidance({ hasProject: false }), /Selecione um projeto/);
  assert.match(buildPromotionGuidance({ hasProject: true, sandboxCount: 0 }), /Nenhum sandbox disponível/);
  assert.match(
    buildPromotionGuidance({ hasProject: true, sandboxCount: 2, selectedSandboxName: 'Candidato A' }),
    /Candidato "Candidato A" pronto para revisão/
  );
});

test('buildPreflightStatusMessage prioritizes blockers, then warnings, then ready state', () => {
  assert.equal(
    buildPreflightStatusMessage({ blockers: 2, warnings: 1, ready: 4 }),
    'Export bloqueado no momento · 2 blocker(s) · 1 warning(s).'
  );
  assert.equal(
    buildPreflightStatusMessage({ blockers: 0, warnings: 3, ready: 4 }),
    'Pronto com alertas · 3 warning(s) antes do closure export.'
  );
  assert.equal(
    buildPreflightStatusMessage({ blockers: 0, warnings: 0, ready: 5 }),
    'Pronto para gerar closure export · 5 sinal(is) positivos no preflight.'
  );
});
