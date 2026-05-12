const pluralize = (count, singular, plural) => (count === 1 ? singular : plural);

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
  return `${count} ${pluralize(count, singular, plural)} local-first neste projeto. Próximo passo: ${nextStepWhenPopulated}`;
};

export const buildReviewInboxSummary = ({
  filteredCount = 0,
  totalCount = 0,
  blockedCount = 0,
  highRiskCount = 0,
  hasActiveFilters = false
}) => {
  if (totalCount <= 0) {
    return 'Inbox limpa neste projeto. Próximo passo: confirme o Production Readiness Dashboard ou gere um checkpoint antes do closure export.';
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
    return `Export bloqueado no momento · ${blockers} blocker(s) · ${warnings} warning(s).`;
  }
  if (warnings > 0) {
    return `Pronto com alertas · ${warnings} warning(s) antes do closure export.`;
  }
  return `Pronto para gerar closure export · ${ready} sinal(is) positivos no preflight.`;
};
