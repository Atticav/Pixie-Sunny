import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiffSummary,
  buildLineDiff,
  buildMetadataDiff,
  buildSemanticHighlights
} from '../src/context-compare.js';

test('buildLineDiff tracks added and removed lines for inline comparison', () => {
  const diff = buildLineDiff('linha A\nlinha B\nlinha C', 'linha A\nlinha X\nlinha C\nlinha D');
  assert.equal(diff.stats.added, 2);
  assert.equal(diff.stats.removed, 1);
  assert.ok(diff.rows.some((row) => row.type === 'added' && row.text === 'linha X'));
  assert.ok(diff.rows.some((row) => row.type === 'removed' && row.text === 'linha B'));
});

test('buildMetadataDiff classifies changed, added and removed fields', () => {
  const diff = buildMetadataDiff(
    { reviewStatus: 'candidate', score: '2', sceneId: 'scene-1' },
    { reviewStatus: 'favorite', score: '4', characterId: 'char-1' }
  );
  assert.equal(diff.changed, 2);
  assert.equal(diff.added, 1);
  assert.equal(diff.removed, 1);
  assert.equal(diff.rows.find((row) => row.key === 'reviewStatus')?.type, 'changed');
});

test('buildDiffSummary and semantic highlights expose useful compare signals', () => {
  const metadataDiff = buildMetadataDiff(
    { reviewStatus: 'candidate', readiness: 'blocked' },
    { reviewStatus: 'favorite', readiness: 'ready-to-review' }
  );
  const sectionDiffs = [
    { label: 'Prompt principal', diff: buildLineDiff('old prompt', 'new prompt') },
    { label: 'Continuidade', diff: buildLineDiff('regra 1', 'regra 1\nregra 2') }
  ];

  const summary = buildDiffSummary({ metadataDiff, sectionDiffs });
  assert.equal(summary.changedSections, 2);
  assert.ok(summary.textOps > 0);

  const highlights = buildSemanticHighlights({ metadataDiff, sectionDiffs });
  assert.ok(highlights.some((entry) => entry.includes('editorial/canônica')));
  assert.ok(highlights.some((entry) => entry.includes('Prompt/briefing')));
  assert.ok(highlights.some((entry) => entry.includes('continuidade')));
});
