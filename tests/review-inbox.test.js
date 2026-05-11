import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewInboxItems, applyReviewInboxFiltersAndSort, groupReviewInboxItems } from '../src/review-inbox.js';

const baseState = {
  projects: [{ id: 'p1', name: 'Projeto 1' }],
  chapters: [{ id: 'c1', projectId: 'p1', title: 'Capítulo 1' }],
  scenes: [{ id: 's1', projectId: 'p1', chapterId: 'c1', title: 'Cena 1' }],
  beats: [],
  shots: [
    {
      id: 'sh-1',
      projectId: 'p1',
      chapterId: 'c1',
      sceneId: 's1',
      beatId: '',
      title: 'Shot crítico',
      status: 'needs redo',
      continuityMustKeep: ['olhos verdes'],
      continuityReferenceIds: [],
      continuityRisks: ['roupa inconsistente'],
      updatedAt: '2026-05-01T10:00:00.000Z'
    }
  ],
  generationJobs: [
    {
      id: 'j1',
      projectId: 'p1',
      status: 'done',
      outputs: [
        {
          id: 'o1',
          sceneId: 's1',
          characterId: 'char-1',
          generationType: 'character',
          reviewStatus: 'candidate',
          fileName: 'hero-v1.png',
          createdAt: '2026-04-01T10:00:00.000Z'
        },
        {
          id: 'o2',
          sceneId: 's1',
          characterId: 'char-1',
          generationType: 'character',
          reviewStatus: 'unreviewed',
          fileName: 'hero-v2.png',
          createdAt: '2026-04-02T10:00:00.000Z'
        }
      ]
    }
  ],
  decisionHistory: [
    {
      id: 'd1',
      projectId: 'p1',
      scopeType: 'asset',
      scopeId: 'o1',
      targetId: 'o1',
      resultingStatus: 'needs_revision',
      rationale: 'Rever detalhes de continuidade',
      happenedAt: '2026-05-05T10:00:00.000Z'
    }
  ]
};

test('buildReviewInboxItems consolidates critical review signals', () => {
  const assistiveBundle = {
    recommendations: [
      {
        id: 'rec1',
        type: 'review required',
        title: 'Review requerido para Cena 1',
        description: '2 outputs aguardando triagem.',
        status: 'ready-to-review',
        priorityScore: 82,
        sceneId: 's1',
        chapterId: 'c1',
        sequenceId: ''
      }
    ]
  };

  const items = buildReviewInboxItems({
    state: baseState,
    projectId: 'p1',
    assistiveBundle,
    now: '2026-05-11T10:00:00.000Z'
  });

  assert.ok(items.some((item) => item.type === 'human_review'));
  assert.ok(items.some((item) => item.type === 'stale_needs_refresh'));
  assert.ok(items.some((item) => item.type === 'diff_review'));
  assert.ok(items.some((item) => item.type === 'blocked_shot'));
  assert.ok(items.some((item) => item.type === 'decision_follow_up'));
  assert.ok(items.some((item) => item.type === 'automation_confirmation'));
});

test('applyReviewInboxFiltersAndSort filters by status/type and query', () => {
  const items = buildReviewInboxItems({
    state: baseState,
    projectId: 'p1',
    assistiveBundle: { recommendations: [] },
    now: '2026-05-11T10:00:00.000Z'
  });

  const filtered = applyReviewInboxFiltersAndSort(items, {
    type: 'diff_review',
    status: 'pending_review',
    query: 'comparar',
    sortBy: 'newest'
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].type, 'diff_review');
});

test('groupReviewInboxItems groups by selected field', () => {
  const items = buildReviewInboxItems({
    state: baseState,
    projectId: 'p1',
    assistiveBundle: { recommendations: [] },
    now: '2026-05-11T10:00:00.000Z'
  });

  const grouped = groupReviewInboxItems(items, 'priority');
  const keys = grouped.map((entry) => entry.key);

  assert.ok(keys.includes('high') || keys.includes('medium') || keys.includes('low'));
  assert.ok(grouped.every((entry) => Array.isArray(entry.items)));
});
