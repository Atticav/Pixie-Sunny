import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClosureExportStatusMessage,
  canGenerateClosureExport,
  buildPreflightStatusMessage,
  buildProjectCollectionSummary,
  buildPromotionGuidance,
  buildReviewInboxSummary,
  isDuplicateSandboxPromotion
} from '../src/product-polish.js';

test('buildProjectCollectionSummary handles empty and populated collections', () => {
  assert.equal(
    buildProjectCollectionSummary({
      count: 0,
      singular: 'sandbox',
      plural: 'sandboxes',
      emptyMessage: 'No sandbox has been created for this project yet.',
      nextStepWhenEmpty: 'create a sandbox',
      nextStepWhenPopulated: 'compare a candidate'
    }),
    'No sandbox has been created for this project yet. Next step: create a sandbox'
  );

  assert.equal(
    buildProjectCollectionSummary({
      count: 2,
      singular: 'checkpoint',
      plural: 'checkpoints',
      emptyMessage: 'No checkpoint has been created for this project yet.',
      nextStepWhenEmpty: 'save a checkpoint',
      nextStepWhenPopulated: 'compare a checkpoint'
    }),
    '2 checkpoints saved locally in this project. Next step: compare a checkpoint'
  );
});

test('buildReviewInboxSummary describes clean and filtered inbox states', () => {
  assert.match(
    buildReviewInboxSummary({ totalCount: 0 }),
    /Inbox is clear for this project/
  );

  assert.equal(
    buildReviewInboxSummary({
      filteredCount: 2,
      totalCount: 5,
      blockedCount: 1,
      highRiskCount: 3,
      hasActiveFilters: true
    }),
    '2/5 visible items with the current filters · 1 blocked · 3 high risk. Next step: resolve the blockers and use Diff Viewer / Context Compare to decide ambiguous cases.'
  );
});

test('buildPromotionGuidance reflects project, sandbox and selection state', () => {
  assert.match(buildPromotionGuidance({ hasProject: false }), /Select a project/);
  assert.match(buildPromotionGuidance({ hasProject: true, sandboxCount: 0 }), /No sandbox available/);
  assert.match(
    buildPromotionGuidance({ hasProject: true, sandboxCount: 2, selectedSandboxName: 'Candidato A' }),
    /Candidate "Candidato A" is ready for review/
  );
});

test('buildPreflightStatusMessage prioritizes blockers, then warnings, then ready state', () => {
  assert.equal(
    buildPreflightStatusMessage({ blockers: 2, warnings: 1, ready: 4 }),
    'Export currently blocked · 2 blocker(s) · 1 warning(s).'
  );
  assert.equal(
    buildPreflightStatusMessage({ blockers: 0, warnings: 3, ready: 4 }),
    'Ready with alerts · 3 warning(s) before the closure export.'
  );
  assert.equal(
    buildPreflightStatusMessage({ blockers: 0, warnings: 0, ready: 5 }),
    'Ready to generate closure export · 5 positive signal(s) in the final preflight.'
  );
});

test('canGenerateClosureExport requires at least one included section', () => {
  assert.equal(canGenerateClosureExport({ readinessSummary: false, reviewInboxDigest: false }), false);
  assert.equal(canGenerateClosureExport({ readinessSummary: true, reviewInboxDigest: false }), true);
});

test('isDuplicateSandboxPromotion detects repeated confirm action payloads', () => {
  const lastPromotion = {
    sandboxId: 'sb-1',
    notes: 'Notas',
    impactSummary: '2 cena(s) · 5 shot(s)'
  };
  assert.equal(
    isDuplicateSandboxPromotion({
      lastPromotion,
      sandboxId: 'sb-1',
      notes: 'Notas',
      impactSummary: '2 cena(s) · 5 shot(s)'
    }),
    true
  );
  assert.equal(
    isDuplicateSandboxPromotion({
      lastPromotion,
      sandboxId: 'sb-1',
      notes: 'Notas alteradas',
      impactSummary: '2 cena(s) · 5 shot(s)'
    }),
    false
  );
});

test('buildClosureExportStatusMessage reports blockers and warnings count', () => {
  assert.equal(
    buildClosureExportStatusMessage({
      filename: 'closure.json',
      blockers: 2,
      warnings: 1
    }),
    'Closure summary generated: closure.json (blockers=2 · warnings=1)'
  );
});
