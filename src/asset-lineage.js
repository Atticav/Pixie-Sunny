const safeString = (value) => (typeof value === 'string' ? value : '');

const byNewest = (a, b) => safeString(b.createdAt).localeCompare(safeString(a.createdAt));

const lineageKeyForOutput = (output) =>
  [safeString(output.sceneId), safeString(output.characterId), safeString(output.generationType)].join('|');

const pushEdge = (edges, index, edge) => {
  const key = `${edge.from}->${edge.to}:${edge.relation}`;
  if (!index.has(key)) {
    index.add(key);
    edges.push(edge);
  }
};

const latestStatusTarget = (decisionEvents, statuses) =>
  (decisionEvents || [])
    .filter(
      (event) =>
        safeString(event.scopeType) === 'asset' &&
        statuses.includes(safeString(event.resultingStatus)) &&
        safeString(event.targetType || 'generationOutput') === 'generationOutput' &&
        safeString(event.targetId)
    )
    .sort((a, b) => safeString(b.happenedAt).localeCompare(safeString(a.happenedAt)))[0]?.targetId || '';

export const buildAssetLineageGraph = ({ outputs = [], decisionEvents = [], canonPromotions = [] } = {}) => {
  const safeOutputs = Array.isArray(outputs) ? outputs.filter((output) => output && safeString(output.id)) : [];
  const outputMap = new Map(safeOutputs.map((output) => [output.id, output]));
  const edges = [];
  const edgeKeys = new Set();

  // Supersession edges from editorial decisions.
  (Array.isArray(decisionEvents) ? decisionEvents : []).forEach((event) => {
    if (
      safeString(event.decisionType) === 'supersede' &&
      safeString(event.targetType || 'generationOutput') === 'generationOutput' &&
      safeString(event.targetId) &&
      safeString(event.relatedItemType) === 'generationOutput' &&
      safeString(event.relatedItemId) &&
      outputMap.has(event.targetId) &&
      outputMap.has(event.relatedItemId)
    ) {
      pushEdge(edges, edgeKeys, {
        from: event.targetId,
        to: event.relatedItemId,
        relation: 'supersedes',
        happenedAt: safeString(event.happenedAt),
        inferred: false
      });
    }
  });

  // Inferred lineage chain by variant key and creation time.
  const groups = new Map();
  safeOutputs.forEach((output) => {
    const key = lineageKeyForOutput(output);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(output);
  });
  groups.forEach((group) => {
    const ordered = group.slice().sort((a, b) => safeString(a.createdAt).localeCompare(safeString(b.createdAt)));
    for (let i = 1; i < ordered.length; i += 1) {
      pushEdge(edges, edgeKeys, {
        from: ordered[i - 1].id,
        to: ordered[i].id,
        relation: 'derived_variant',
        happenedAt: safeString(ordered[i].createdAt),
        inferred: true
      });
    }
  });

  const predecessorMap = new Map();
  const successorMap = new Map();
  edges.forEach((edge) => {
    if (!predecessorMap.has(edge.to)) predecessorMap.set(edge.to, []);
    predecessorMap.get(edge.to).push(edge);
    if (!successorMap.has(edge.from)) successorMap.set(edge.from, []);
    successorMap.get(edge.from).push(edge);
  });

  const currentOfficialId =
    latestStatusTarget(decisionEvents, ['current_official']) ||
    latestStatusTarget(decisionEvents, ['approved']) ||
    safeString(
      safeOutputs
        .filter((output) => output.isCanonical)
        .sort(byNewest)[0]?.id
    );
  const sourceOfTruthId = currentOfficialId;

  const approvedIds = new Set(
    (Array.isArray(decisionEvents) ? decisionEvents : [])
      .filter((event) => ['approved', 'current_official'].includes(safeString(event.resultingStatus)))
      .map((event) => safeString(event.targetId))
      .filter(Boolean)
  );
  const canonPromotionIds = new Set(
    (Array.isArray(canonPromotions) ? canonPromotions : []).map((promotion) => safeString(promotion.outputId)).filter(Boolean)
  );

  const nodes = safeOutputs
    .slice()
    .sort(byNewest)
    .map((output) => {
      const predecessors = predecessorMap.get(output.id) || [];
      const successors = successorMap.get(output.id) || [];
      const hasSupersedingEdge = successors.some((edge) => edge.relation === 'supersedes');
      const hasVariantPredecessor = predecessors.some((edge) => edge.relation === 'derived_variant');

      const statusTags = [];
      if (!hasVariantPredecessor) statusTags.push('original');
      if (hasVariantPredecessor) statusTags.push('derived_variant');
      if (safeString(output.reviewStatus) === 'candidate') statusTags.push('candidate');
      if (approvedIds.has(output.id)) statusTags.push('approved_version');
      if (hasSupersedingEdge) statusTags.push('superseded_version');
      if (output.isCanonical || canonPromotionIds.has(output.id)) statusTags.push('canon_promoted_version');
      if (safeString(output.reviewStatus) === 'archived') statusTags.push('deprecated_archived_branch');
      if (output.id === currentOfficialId) statusTags.push('current_official');
      if (output.id === sourceOfTruthId) statusTags.push('source_of_truth');

      return {
        id: output.id,
        label: output.fileName || `Output ${output.id.substring(0, 8)}`,
        output,
        predecessors,
        successors,
        statusTags
      };
    });

  return {
    nodes,
    edges: edges.slice().sort((a, b) => safeString(b.happenedAt).localeCompare(safeString(a.happenedAt))),
    currentOfficialId,
    sourceOfTruthId
  };
};
