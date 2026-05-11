import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssetLineageGraph } from '../src/asset-lineage.js';

test('buildAssetLineageGraph links supersession and marks current official/source of truth', () => {
  const outputs = [
    {
      id: 'out-a',
      generationType: 'character',
      reviewStatus: 'archived',
      isCanonical: false,
      createdAt: '2026-01-01T10:00:00.000Z',
      sceneId: 'scene-1',
      characterId: 'char-1',
      fileName: 'a.png'
    },
    {
      id: 'out-b',
      generationType: 'character',
      reviewStatus: 'favorite',
      isCanonical: true,
      createdAt: '2026-01-02T10:00:00.000Z',
      sceneId: 'scene-1',
      characterId: 'char-1',
      fileName: 'b.png'
    }
  ];
  const decisionEvents = [
    {
      decisionType: 'supersede',
      scopeType: 'asset',
      targetType: 'generationOutput',
      targetId: 'out-a',
      relatedItemType: 'generationOutput',
      relatedItemId: 'out-b',
      resultingStatus: 'superseded',
      happenedAt: '2026-01-02T11:00:00.000Z'
    },
    {
      decisionType: 'promote_to_canon',
      scopeType: 'asset',
      targetType: 'generationOutput',
      targetId: 'out-b',
      resultingStatus: 'current_official',
      happenedAt: '2026-01-02T12:00:00.000Z'
    }
  ];

  const graph = buildAssetLineageGraph({ outputs, decisionEvents });
  const nodeA = graph.nodes.find((node) => node.id === 'out-a');
  const nodeB = graph.nodes.find((node) => node.id === 'out-b');

  assert.equal(graph.currentOfficialId, 'out-b');
  assert.equal(graph.sourceOfTruthId, 'out-b');
  assert.ok(graph.edges.some((edge) => edge.from === 'out-a' && edge.to === 'out-b' && edge.relation === 'supersedes'));
  assert.ok(nodeA.statusTags.includes('superseded_version'));
  assert.ok(nodeA.statusTags.includes('deprecated_archived_branch'));
  assert.ok(nodeB.statusTags.includes('current_official'));
  assert.ok(nodeB.statusTags.includes('source_of_truth'));
});

test('buildAssetLineageGraph infers derived variants and candidate/approved tags', () => {
  const outputs = [
    {
      id: 'v1',
      generationType: 'scene',
      reviewStatus: 'unreviewed',
      isCanonical: false,
      createdAt: '2026-01-01T09:00:00.000Z',
      sceneId: 'scene-2',
      characterId: ''
    },
    {
      id: 'v2',
      generationType: 'scene',
      reviewStatus: 'candidate',
      isCanonical: false,
      createdAt: '2026-01-01T10:00:00.000Z',
      sceneId: 'scene-2',
      characterId: ''
    }
  ];
  const decisionEvents = [
    {
      decisionType: 'approve',
      scopeType: 'asset',
      targetType: 'generationOutput',
      targetId: 'v2',
      resultingStatus: 'approved',
      happenedAt: '2026-01-01T11:00:00.000Z'
    }
  ];

  const graph = buildAssetLineageGraph({ outputs, decisionEvents });
  const nodeV1 = graph.nodes.find((node) => node.id === 'v1');
  const nodeV2 = graph.nodes.find((node) => node.id === 'v2');

  assert.ok(graph.edges.some((edge) => edge.from === 'v1' && edge.to === 'v2' && edge.relation === 'derived_variant'));
  assert.ok(nodeV1.statusTags.includes('original'));
  assert.ok(nodeV2.statusTags.includes('derived_variant'));
  assert.ok(nodeV2.statusTags.includes('candidate'));
  assert.ok(nodeV2.statusTags.includes('approved_version'));
});
