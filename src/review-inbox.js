const safeArray = (value) => (Array.isArray(value) ? value : []);
const safeString = (value) => (typeof value === 'string' ? value : '');

export const REVIEW_INBOX_TYPE_LABELS = {
  human_review: 'Revisão humana',
  stale_needs_refresh: 'Item stale / needs refresh',
  diff_review: 'Comparar variantes / diff',
  blocked_shot: 'Shot bloqueado',
  readiness_risk: 'Risco de readiness',
  automation_confirmation: 'Sinal de automação',
  decision_follow_up: 'Follow-up editorial',
  operational_signal: 'Sinal operacional'
};

export const REVIEW_INBOX_STATUS_LABELS = {
  pending_review: 'Aguardando review',
  blocked: 'Bloqueado',
  needs_refresh: 'Precisa refresh'
};

export const REVIEW_INBOX_PRIORITY_LABELS = {
  high: 'alta',
  medium: 'média',
  low: 'baixa'
};

export const REVIEW_INBOX_RISK_LABELS = {
  high: 'alto',
  medium: 'médio',
  low: 'baixo'
};

export const REVIEW_INBOX_ENTITY_LABELS = {
  asset: 'asset',
  scene: 'cena',
  shot: 'shot',
  chapter: 'capítulo',
  sequence: 'sequência',
  project: 'projeto'
};

export const REVIEW_INBOX_ACTION_LABELS = {
  approve: 'Aprovar',
  reject: 'Rejeitar',
  defer: 'Adiar',
  'mark-refresh': 'Marcar refresh',
  'open-diff': 'Abrir Diff Viewer',
  'open-lineage': 'Abrir lineage',
  'open-source-entity': 'Abrir contexto',
  'navigate-related-context': 'Navegar contexto'
};

const toTimestamp = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : 0;
};

const isOutputStale = (output, staleCutoff) => {
  const createdAt = toTimestamp(output?.createdAt);
  return createdAt > 0 && createdAt < staleCutoff;
};

const assistiveItemType = (entryType) => {
  if (entryType === 'review required') return 'automation_confirmation';
  if (entryType === 'scene not production-ready') return 'readiness_risk';
  return 'operational_signal';
};

const buildOutputComparisonKey = (output) =>
  [output.sceneId || 'scene:global', output.characterId || 'char:global', output.generationType || 'type:generic'].join('|');

const priorityFromScore = (score = 0) => {
  if (score >= 78) return 'high';
  if (score >= 48) return 'medium';
  return 'low';
};

const pushItem = (bucket, raw) => {
  if (!raw || !raw.id || !raw.type) return;
  bucket.push({
    id: raw.id,
    type: raw.type,
    title: raw.title || 'Item de revisão',
    reason: raw.reason || 'Requer atenção humana.',
    priority: raw.priority || 'medium',
    risk: raw.risk || 'medium',
    status: raw.status || 'pending_review',
    entity: raw.entity || 'project',
    entityId: raw.entityId || '',
    projectId: raw.projectId || '',
    chapterId: raw.chapterId || '',
    sequenceId: raw.sequenceId || '',
    sceneId: raw.sceneId || '',
    source: raw.source || 'Review Inbox',
    createdAt: raw.createdAt || new Date().toISOString(),
    outputId: raw.outputId || '',
    compareOutputIds: safeArray(raw.compareOutputIds),
    outputIds: safeArray(raw.outputIds)
  });
};

const outputLabel = (output) => safeString(output.fileName) || `Output ${safeString(output.id).slice(0, 8)}`;

export const buildReviewInboxItems = ({ state, projectId, assistiveBundle, now = new Date().toISOString() }) => {
  if (!state || !projectId) return [];

  const chaptersById = new Map(
    safeArray(state.chapters)
      .filter((chapter) => chapter.projectId === projectId)
      .map((chapter) => [chapter.id, chapter])
  );
  const scenesById = new Map(
    safeArray(state.scenes)
      .filter((scene) => scene.projectId === projectId)
      .map((scene) => [scene.id, scene])
  );
  const outputsById = new Map();
  const projectOutputs = [];

  safeArray(state.generationJobs)
    .filter((job) => job.projectId === projectId)
    .forEach((job) => {
      safeArray(job.outputs).forEach((output) => {
        const merged = { ...output, jobId: output.jobId || job.id };
        outputsById.set(merged.id, merged);
        projectOutputs.push(merged);
      });
    });

  const items = [];

  safeArray(assistiveBundle?.recommendations).forEach((entry) => {
    const scene = scenesById.get(entry.sceneId || '');
    const chapter = chaptersById.get(entry.chapterId || scene?.chapterId || '');
    pushItem(items, {
      id: `assistive:${entry.id}`,
      type: assistiveItemType(entry.type),
      title: entry.title,
      reason: `${entry.description} (via dashboard de readiness e rules engine local).`,
      priority: priorityFromScore(entry.priorityScore),
      risk: entry.status === 'blocked' ? 'high' : entry.status === 'ready-to-review' ? 'medium' : 'low',
      status: entry.status === 'blocked' ? 'blocked' : 'pending_review',
      entity: entry.sceneId ? 'scene' : entry.chapterId ? 'chapter' : entry.sequenceId ? 'sequence' : 'project',
      entityId: entry.sceneId || entry.chapterId || entry.sequenceId || projectId,
      projectId,
      chapterId: chapter?.id || entry.chapterId || '',
      sequenceId: entry.sequenceId || '',
      sceneId: scene?.id || entry.sceneId || '',
      source: 'Production Readiness Dashboard · Local Automation Rules Engine',
      createdAt: now
    });
  });

  const staleCutoff = toTimestamp(now) - 1000 * 60 * 60 * 24 * 14;

  projectOutputs.forEach((output) => {
    const isPendingReview = output.reviewStatus === 'unreviewed' || output.reviewStatus === 'candidate';
    const scene = scenesById.get(output.sceneId || '');
    const chapter = chaptersById.get(scene?.chapterId || '');

    if (isPendingReview) {
      pushItem(items, {
        id: `review:${output.id}`,
        type: 'human_review',
        title: `${outputLabel(output)} aguardando decisão`,
        reason: 'Output gerado/local que ainda depende de confirmação humana para aprovação, rejeição ou deferimento.',
        priority: output.reviewStatus === 'candidate' ? 'high' : 'medium',
        risk: output.isCanonical ? 'high' : 'medium',
        status: 'pending_review',
        entity: 'asset',
        entityId: output.id,
        projectId,
        chapterId: chapter?.id || '',
        sceneId: scene?.id || '',
        source: 'Image Review Studio · Approval & Decision History Layer',
        createdAt: output.createdAt,
        outputId: output.id
      });
    }

    const isStale = isOutputStale(output, staleCutoff);
    if (isPendingReview && isStale) {
      pushItem(items, {
        id: `stale:${output.id}`,
        type: 'stale_needs_refresh',
        title: `${outputLabel(output)} precisa refresh`,
        reason: 'Item está em revisão há muito tempo e deve ser revalidado no contexto atual do pipeline.',
        priority: 'medium',
        risk: 'medium',
        status: 'needs_refresh',
        entity: 'asset',
        entityId: output.id,
        projectId,
        chapterId: chapter?.id || '',
        sceneId: scene?.id || '',
        source: 'Change Impact / Dependency Refresh System',
        createdAt: output.createdAt,
        outputId: output.id
      });
    }
  });

  const compareBuckets = new Map();
  projectOutputs.forEach((output) => {
    const key = buildOutputComparisonKey(output);
    if (!compareBuckets.has(key)) compareBuckets.set(key, []);
    compareBuckets.get(key).push(output);
  });

  compareBuckets.forEach((outputs, key) => {
    const pending = outputs
      .filter((output) => output.reviewStatus === 'unreviewed' || output.reviewStatus === 'candidate')
      .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
    if (pending.length < 2) return;
    const [a, b] = pending;
    const scene = scenesById.get(a.sceneId || b.sceneId || '');
    const chapter = chaptersById.get(scene?.chapterId || '');
    pushItem(items, {
      id: `diff:${key}`,
      type: 'diff_review',
      title: `Comparar variantes antes de decidir`,
      reason: `Existem múltiplos candidatos semelhantes (${outputLabel(a)} vs ${outputLabel(b)}) pedindo aprovação editorial.`,
      priority: 'high',
      risk: 'medium',
      status: 'pending_review',
      entity: 'asset',
      entityId: a.id,
      projectId,
      chapterId: chapter?.id || '',
      sceneId: scene?.id || '',
      source: 'Diff Viewer / Context Compare Workspace',
      createdAt: a.createdAt || now,
      compareOutputIds: [a.id, b.id],
      outputId: a.id
    });
  });

  safeArray(state.shots)
    .filter((shot) => shot.projectId === projectId)
    .forEach((shot) => {
      const scene = scenesById.get(shot.sceneId || '');
      const chapter = chaptersById.get(shot.chapterId || scene?.chapterId || '');
      const risks = safeArray(shot.continuityRisks);
      const blocked = shot.status === 'needs redo';
      const missingContinuityReferences = safeArray(shot.continuityMustKeep).length > 0 && safeArray(shot.continuityReferenceIds).length === 0;
      if (!blocked && !risks.length && !missingContinuityReferences) return;
      pushItem(items, {
        id: `shot:${shot.id}`,
        type: 'blocked_shot',
        title: `Shot bloqueado: ${shot.title}`,
        reason: blocked
          ? 'Shot marcado como needs redo e requer decisão humana para destravar sequência.'
          : missingContinuityReferences
            ? 'Shot exige continuidade, mas sem referência canônica vinculada.'
            : `Riscos de continuidade detectados: ${risks.slice(0, 2).join(', ')}`,
        priority: blocked ? 'high' : 'medium',
        risk: blocked || risks.length > 1 ? 'high' : 'medium',
        status: blocked ? 'blocked' : 'pending_review',
        entity: 'shot',
        entityId: shot.id,
        projectId,
        chapterId: chapter?.id || '',
        sequenceId: shot.beatId || '',
        sceneId: scene?.id || shot.sceneId || '',
        source: 'Consistency Checker · Production Board',
        createdAt: shot.updatedAt || shot.createdAt || now
      });
    });

  safeArray(state.decisionHistory)
    .filter((event) => event.projectId === projectId)
    .filter((event) => ['superseded', 'needs_revision', 'rejected'].includes(event.resultingStatus))
    .slice()
    .sort((a, b) => toTimestamp(b.happenedAt) - toTimestamp(a.happenedAt))
    .slice(0, 12)
    .forEach((event) => {
      const relatedOutput = outputsById.get(event.targetId || event.relatedItemId || '');
      const scene = scenesById.get(relatedOutput?.sceneId || '');
      const chapter = chaptersById.get(scene?.chapterId || '');
      pushItem(items, {
        id: `decision:${event.id}`,
        type: 'decision_follow_up',
        title: `Follow-up editorial: ${event.resultingStatus}`,
        reason: event.rationale || 'Evento crítico recente na trilha de decisão exige verificação operacional.',
        priority: event.resultingStatus === 'superseded' ? 'high' : 'medium',
        risk: event.resultingStatus === 'rejected' ? 'medium' : 'high',
        status: 'pending_review',
        entity: event.scopeType || 'asset',
        entityId: event.scopeId || event.targetId,
        projectId,
        chapterId: chapter?.id || '',
        sceneId: scene?.id || '',
        source: 'Editorial Timeline / Activity Feed · Approval & Decision History Layer',
        createdAt: event.happenedAt,
        outputId: relatedOutput?.id || ''
      });
    });

  const dedup = new Map();
  items.forEach((item) => {
    if (!dedup.has(item.id)) dedup.set(item.id, item);
  });

  return [...dedup.values()].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const riskOrder = { high: 0, medium: 1, low: 2 };
    const priorityDelta = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    if (priorityDelta !== 0) return priorityDelta;
    const riskDelta = (riskOrder[a.risk] ?? 3) - (riskOrder[b.risk] ?? 3);
    if (riskDelta !== 0) return riskDelta;
    return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
  });
};

export const applyReviewInboxFiltersAndSort = (items, filters = {}) => {
  const query = safeString(filters.query).toLowerCase();
  const sortBy = safeString(filters.sortBy) || 'priority';
  const list = safeArray(items)
    .filter((item) => (filters.type ? item.type === filters.type : true))
    .filter((item) => (filters.priority ? item.priority === filters.priority : true))
    .filter((item) => (filters.risk ? item.risk === filters.risk : true))
    .filter((item) => (filters.status ? item.status === filters.status : true))
    .filter((item) => (filters.entity ? item.entity === filters.entity : true))
    .filter((item) => (filters.chapterId ? item.chapterId === filters.chapterId : true))
    .filter((item) => (filters.sceneId ? item.sceneId === filters.sceneId : true))
    .filter((item) => {
      if (!query) return true;
      const hay = `${item.title} ${item.reason} ${item.source}`.toLowerCase();
      return hay.includes(query);
    });

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const riskOrder = { high: 0, medium: 1, low: 2 };

  list.sort((a, b) => {
    if (sortBy === 'newest') return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    if (sortBy === 'oldest') return toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
    if (sortBy === 'risk') {
      const riskDelta = (riskOrder[a.risk] ?? 3) - (riskOrder[b.risk] ?? 3);
      if (riskDelta !== 0) return riskDelta;
      return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    }
    if (sortBy === 'type') {
      const typeDelta = safeString(a.type).localeCompare(safeString(b.type), 'pt-BR');
      if (typeDelta !== 0) return typeDelta;
      return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    }
    const priorityDelta = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
    if (priorityDelta !== 0) return priorityDelta;
    const riskDelta = (riskOrder[a.risk] ?? 3) - (riskOrder[b.risk] ?? 3);
    if (riskDelta !== 0) return riskDelta;
    return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
  });

  return list;
};

export const groupReviewInboxItems = (items, groupBy = 'type') => {
  const keyField = safeString(groupBy) || 'type';
  const groups = new Map();
  safeArray(items).forEach((item) => {
    const key = safeString(item[keyField]) || 'outros';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  return [...groups.entries()].map(([key, groupedItems]) => ({
    key,
    label: key,
    items: groupedItems
  }));
};

export const formatReviewInboxGroupLabel = (groupBy, key) => {
  const value = safeString(key) || 'outros';
  if (!groupBy || groupBy === 'type') return REVIEW_INBOX_TYPE_LABELS[value] || value;
  if (groupBy === 'status') return REVIEW_INBOX_STATUS_LABELS[value] || value;
  if (groupBy === 'priority') return `Prioridade ${REVIEW_INBOX_PRIORITY_LABELS[value] || value}`;
  if (groupBy === 'risk') return `Risco ${REVIEW_INBOX_RISK_LABELS[value] || value}`;
  if (groupBy === 'entity') return REVIEW_INBOX_ENTITY_LABELS[value] || value;
  if (groupBy === 'sceneId') return value === 'outros' ? 'Sem cena vinculada' : `Cena ${value}`;
  if (groupBy === 'chapterId') return value === 'outros' ? 'Sem capítulo vinculado' : `Capítulo ${value}`;
  if (groupBy === 'source') return value;
  return value;
};
