const safeArray = (value) => (Array.isArray(value) ? value : []);

const scoreToPriority = (score) => {
  if (score >= 80) return 'alta';
  if (score >= 55) return 'média';
  return 'baixa';
};

const computePriorityScore = ({ blocking = false, impact = 0.5, completeness = 0.5, inconsistencyRisk = 0.5 }) => {
  const normalizedImpact = Math.max(0, Math.min(1, impact));
  const normalizedCompleteness = Math.max(0, Math.min(1, completeness));
  const normalizedRisk = Math.max(0, Math.min(1, inconsistencyRisk));
  const score =
    (blocking ? 42 : 0) +
    normalizedImpact * 28 +
    (1 - normalizedCompleteness) * 18 +
    normalizedRisk * 12;
  return Math.round(score);
};

const recommendation = ({
  id,
  type,
  title,
  description,
  status,
  projectId,
  chapterId = '',
  sequenceId = '',
  sceneId = '',
  impact = 0.5,
  completeness = 0.5,
  inconsistencyRisk = 0.5,
  blocking = false,
  quickAction
}) => {
  const priorityScore = computePriorityScore({ blocking, impact, completeness, inconsistencyRisk });
  return {
    id,
    type,
    title,
    description,
    status,
    projectId,
    chapterId,
    sequenceId,
    sceneId,
    factors: {
      blocking,
      impact,
      completeness,
      inconsistencyRisk
    },
    priorityScore,
    priorityLabel: scoreToPriority(priorityScore),
    quickAction
  };
};

const sceneCompleteness = ({ hasShots, hasPrompt, hasOutputs, hasCanonical }) =>
  [hasShots, hasPrompt, hasOutputs, hasCanonical].filter(Boolean).length / 4;

const defaultBundle = () => ({
  summary: {
    total: 0,
    blocked: 0,
    readyToGenerate: 0,
    readyToReview: 0,
    suggested: 0
  },
  recommendations: []
});

export const buildAssistivePlanningBundle = ({
  state,
  projectId,
  scopeType = 'project',
  scopeValue = ''
}) => {
  if (!projectId) return defaultBundle();

  const chapters = safeArray(state?.chapters).filter((chapter) => chapter.projectId === projectId);
  const scenes = safeArray(state?.scenes).filter((scene) => scene.projectId === projectId);
  const beats = safeArray(state?.beats).filter((beat) => beat.projectId === projectId);
  const shots = safeArray(state?.shots).filter((shot) => shot.projectId === projectId);
  const prompts = safeArray(state?.promptDocuments).filter((prompt) => prompt.projectId === projectId);
  const references = safeArray(state?.referenceImages).filter((reference) => reference.projectId === projectId);
  const outputs = safeArray(state?.generationJobs)
    .filter((job) => job.projectId === projectId)
    .flatMap((job) => safeArray(job.outputs));

  const scopedSceneIds = new Set(
    scenes
      .filter((scene) => {
        if (scopeType === 'chapter' && scopeValue) return scene.chapterId === scopeValue;
        if (scopeType === 'scene' && scopeValue) return scene.id === scopeValue;
        if (scopeType === 'sequence' && scopeValue) {
          const beat = beats.find((entry) => entry.id === scopeValue);
          return beat ? scene.id === beat.sceneId : false;
        }
        return true;
      })
      .map((scene) => scene.id)
  );

  const recommendations = [];

  scenes
    .filter((scene) => scopedSceneIds.has(scene.id))
    .forEach((scene) => {
      const sceneShots = shots.filter((shot) => shot.sceneId === scene.id);
      const scenePrompts = prompts.filter((prompt) => prompt.targetType === 'scene' && prompt.targetId === scene.id);
      const sceneOutputs = outputs.filter((output) => output.sceneId === scene.id);
      const sceneCharacterIds = new Set(
        sceneShots
          .flatMap((shot) => [shot.focusCharacterId, ...safeArray(shot.linkedCharacterIds)])
          .filter(Boolean)
      );
      const sceneReferences = references.filter(
        (reference) =>
          reference.linkedEntityId === scene.id ||
          (reference.linkedEntityType === 'scene' && !reference.linkedEntityId) ||
          (sceneCharacterIds.size > 0 && sceneCharacterIds.has(reference.characterId))
      );
      const sceneBeats = beats.filter((beat) => beat.sceneId === scene.id);
      const unreviewed = sceneOutputs.filter(
        (output) => output.reviewStatus === 'unreviewed' || output.reviewStatus === 'candidate'
      );
      const canonical = sceneOutputs.filter((output) => output.isCanonical);
      // score is 0-5 in this app; 1-2 is treated as low-fidelity canonical quality that needs attention.
      const lowScoreCanon = canonical.filter((output) => output.score > 0 && output.score <= 2);
      const conflictedCanon = canonical.filter(
        (output) => output.reviewStatus === 'rejected' || output.reviewStatus === 'archived'
      );
      const continuityRisks = sceneShots.flatMap((shot) => safeArray(shot.continuityRisks)).length;
      const missingContinuityRefs = sceneShots.filter(
        (shot) => safeArray(shot.continuityMustKeep).length > 0 && safeArray(shot.continuityReferenceIds).length === 0
      ).length;

      const hasShots = sceneShots.length > 0;
      const hasPrompt = scenePrompts.length > 0;
      const hasOutputs = sceneOutputs.length > 0;
      const hasCanonical = canonical.length > 0;
      const completeness = sceneCompleteness({ hasShots, hasPrompt, hasOutputs, hasCanonical });
      // Heuristic weights tuned for practical ordering:
      // 0.35 base scene importance, +0.09 per shot (editorial load), +0.08 per beat (narrative dependency breadth).
      const impact = Math.min(1, 0.35 + sceneShots.length * 0.09 + sceneBeats.length * 0.08);
      const inconsistencyRisk = Math.min(
        1,
        continuityRisks * 0.15 + missingContinuityRefs * 0.25 + lowScoreCanon.length * 0.2 + conflictedCanon.length * 0.3
      );
      const chapterId = scene.chapterId || '';
      const sequenceId = sceneBeats[0]?.id || '';

      if (!hasShots || !hasPrompt) {
        const gaps = [!hasShots ? 'shot planning incompleto' : '', !hasPrompt ? 'prompt grounding ausente' : '']
          .filter(Boolean)
          .join(' + ');
        recommendations.push(
          recommendation({
            id: `missing:${scene.id}`,
            type: 'missing dependency',
            title: `Dependência faltante em "${scene.title}"`,
            description: `A cena está bloqueada por ${gaps}.`,
            status: 'blocked',
            projectId,
            chapterId,
            sequenceId,
            sceneId: scene.id,
            impact,
            completeness,
            inconsistencyRisk,
            blocking: true,
            quickAction: !hasShots
              ? { id: 'open-shot-planner', label: 'Abrir Shot Planner' }
              : { id: 'open-prompt-builder', label: 'Abrir Prompt Builder' }
          })
        );
      }

      if (conflictedCanon.length || lowScoreCanon.length || continuityRisks) {
        recommendations.push(
          recommendation({
            id: `canon-conflict:${scene.id}`,
            type: 'canon conflict to resolve',
            title: `Conflito canônico em "${scene.title}"`,
            description: `Há sinais de inconsistência (canon fraco/conflitante ou riscos de continuidade).`,
            status: 'blocked',
            projectId,
            chapterId,
            sequenceId,
            sceneId: scene.id,
            impact,
            completeness,
            inconsistencyRisk: Math.max(0.55, inconsistencyRisk),
            blocking: true,
            quickAction: { id: 'open-image-review', label: 'Revisar no Image Review' }
          })
        );
      }

      if (unreviewed.length) {
        recommendations.push(
          recommendation({
            id: `review:${scene.id}`,
            type: 'review required',
            title: `Review requerido para "${scene.title}"`,
            description: `${unreviewed.length} output(s) aguardando triagem/revisão canônica.`,
            status: 'ready-to-review',
            projectId,
            chapterId,
            sequenceId,
            sceneId: scene.id,
            impact,
            completeness,
            inconsistencyRisk,
            quickAction: { id: 'open-image-review', label: 'Abrir revisão' }
          })
        );
      }

      if (hasPrompt && !hasOutputs) {
        recommendations.push(
          recommendation({
            id: `asset:${scene.id}`,
            type: 'recommended asset to generate',
            title: `Gerar asset recomendado para "${scene.title}"`,
            description: `Contexto pronto sem output gerado. Próximo passo: gerar primeiro lote de imagens.`,
            status: 'ready-to-generate',
            projectId,
            chapterId,
            sequenceId,
            sceneId: scene.id,
            impact,
            completeness,
            inconsistencyRisk,
            quickAction: { id: 'open-image-gen', label: 'Abrir gerador' }
          })
        );
      }

      const nextActionDescription = !hasShots
        ? 'Estruturar beats/shots para destravar a produção.'
        : !hasPrompt
          ? 'Montar prompt grounding oficial antes da geração.'
          : unreviewed.length
            ? 'Priorizar revisão para aprovar canon e reduzir retrabalho.'
            : !hasCanonical
              ? 'Promover o melhor output ao canon para estabilizar continuidade.'
              : sceneReferences.length
                ? 'Seguir para geração de variações e pack de export.'
                : 'Adicionar referências visuais para fortalecer consistência.';

      recommendations.push(
        recommendation({
          id: `next:${scene.id}`,
          type: 'next best action',
          title: `Próxima melhor ação · "${scene.title}"`,
          description: nextActionDescription,
          status: !hasShots || !hasPrompt ? 'blocked' : unreviewed.length ? 'ready-to-review' : 'ready-to-generate',
          projectId,
          chapterId,
          sequenceId,
          sceneId: scene.id,
          impact,
          completeness,
          inconsistencyRisk,
          blocking: !hasShots || !hasPrompt,
          quickAction: !hasShots
            ? { id: 'open-shot-planner', label: 'Planejar shots' }
            : !hasPrompt
              ? { id: 'open-prompt-builder', label: 'Montar prompt' }
              : { id: 'open-image-gen', label: 'Executar geração' }
        })
      );

      if (!hasCanonical || !hasShots || !hasPrompt || continuityRisks) {
        recommendations.push(
          recommendation({
            id: `prod-ready:${scene.id}`,
            type: 'scene not production-ready',
            title: `Cena ainda não pronta para produção: "${scene.title}"`,
            description: `Completude atual ${Math.round(completeness * 100)}%. Falta fechar dependências/revisão para liberar produção.`,
            status: 'blocked',
            projectId,
            chapterId,
            sequenceId,
            sceneId: scene.id,
            impact,
            completeness,
            inconsistencyRisk,
            blocking: true,
            quickAction: { id: 'open-shot-planner', label: 'Verificar pipeline da cena' }
          })
        );
      }
    });

  const sorted = recommendations
    .sort((a, b) => b.priorityScore - a.priorityScore || a.title.localeCompare(b.title, 'pt-BR'))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    summary: {
      total: sorted.length,
      blocked: sorted.filter((entry) => entry.status === 'blocked').length,
      readyToGenerate: sorted.filter((entry) => entry.status === 'ready-to-generate').length,
      readyToReview: sorted.filter((entry) => entry.status === 'ready-to-review').length,
      suggested: sorted.filter((entry) => entry.status === 'suggested').length
    },
    recommendations: sorted
  };
};
