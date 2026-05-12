const selectPluralForm = (count, singular, plural) => (count === 1 ? singular : plural);

export const buildProjectCollectionSummary = ({
  count = 0,
  singular,
  plural,
  emptyMessage,
  nextStepWhenEmpty,
  nextStepWhenPopulated
}) => {
  if (count <= 0) {
    return `${emptyMessage} Próximo passo: ${nextStepWhenEmpty}`;
  }
  return `${count} ${selectPluralForm(count, singular, plural)} salvos localmente neste projeto. Próximo passo: ${nextStepWhenPopulated}`;
};

export const buildReviewInboxSummary = ({
  filteredCount = 0,
  totalCount = 0,
  blockedCount = 0,
  highRiskCount = 0,
  hasActiveFilters = false
}) => {
  if (totalCount <= 0) {
    return 'Inbox limpa neste projeto. Próximo passo: confirme o Production Readiness Dashboard ou gere um checkpoint antes do export de fechamento.';
  }
  const visibleSummary = hasActiveFilters
    ? `${filteredCount}/${totalCount} itens visíveis com os filtros atuais`
    : `${totalCount} itens acionáveis`;
  return `${visibleSummary} · ${blockedCount} bloqueado(s) · ${highRiskCount} de alto risco. Próximo passo: resolva os bloqueios e use o Diff Viewer / Context Compare para decidir os casos ambíguos.`;
};

export const buildPromotionGuidance = ({
  hasProject = false,
  sandboxCount = 0,
  selectedSandboxName = ''
}) => {
  if (!hasProject) {
    return 'Selecione um projeto para revisar candidatos e registrar promoções com rastreabilidade.';
  }
  if (sandboxCount <= 0) {
    return 'Nenhum sandbox disponível. Próximo passo: crie um sandbox ou atualize um candidato para review-ready antes de promover.';
  }
  if (!selectedSandboxName) {
    return 'Selecione um sandbox candidato para revisar impacto, adicionar notas e confirmar a promoção.';
  }
  return `Candidato "${selectedSandboxName}" pronto para revisão. Próximo passo: valide o impacto, registre contexto editorial e confirme a promoção.`;
};

export const buildPreflightStatusMessage = ({
  blockers = 0,
  warnings = 0,
  ready = 0
}) => {
  if (blockers > 0) {
    return `Export bloqueado no momento · ${blockers} bloqueador(es) · ${warnings} aviso(s).`;
  }
  if (warnings > 0) {
    return `Pronto com alertas · ${warnings} aviso(s) antes do export de fechamento.`;
  }
  return `Pronto para gerar export de fechamento · ${ready} sinal(is) positivos no preflight final.`;
};

export const canGenerateClosureExport = (includes = {}) =>
  Object.values(includes || {}).some((value) => value === true);

export const isDuplicateSandboxPromotion = ({
  lastPromotion = null,
  sandboxId = '',
  notes = '',
  impactSummary = ''
}) => {
  if (!lastPromotion || !sandboxId) return false;
  return (
    lastPromotion.sandboxId === sandboxId &&
    (lastPromotion.notes || '') === notes &&
    (lastPromotion.impactSummary || '') === impactSummary
  );
};

export const buildClosureExportStatusMessage = ({
  filename = '',
  blockers = 0,
  warnings = 0
}) => {
  const suffix = `bloqueadores=${blockers} · avisos=${warnings}`;
  if (!filename) return `Resumo de closure gerado (${suffix})`;
  return `Resumo de closure gerado: ${filename} (${suffix})`;
};
