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
    return `${emptyMessage} Next step: ${nextStepWhenEmpty}`;
  }
  return `${count} ${selectPluralForm(count, singular, plural)} saved locally in this project. Next step: ${nextStepWhenPopulated}`;
};

export const buildReviewInboxSummary = ({
  filteredCount = 0,
  totalCount = 0,
  blockedCount = 0,
  highRiskCount = 0,
  hasActiveFilters = false
}) => {
  if (totalCount <= 0) {
    return 'Inbox is clear for this project. Next step: confirm the Production Readiness Dashboard or create a checkpoint before the closure export.';
  }
  const visibleSummary = hasActiveFilters
    ? `${filteredCount}/${totalCount} visible items with the current filters`
    : `${totalCount} actionable items`;
  return `${visibleSummary} · ${blockedCount} blocked · ${highRiskCount} high risk. Next step: resolve the blockers and use Diff Viewer / Context Compare to decide ambiguous cases.`;
};

export const buildPromotionGuidance = ({
  hasProject = false,
  sandboxCount = 0,
  selectedSandboxName = ''
}) => {
  if (!hasProject) {
    return 'Select a project to review candidates and record promotions with traceability.';
  }
  if (sandboxCount <= 0) {
    return 'No sandbox available. Next step: create a sandbox or update a candidate to review-ready before promoting.';
  }
  if (!selectedSandboxName) {
    return 'Select a candidate sandbox to review impact, add notes, and confirm the promotion.';
  }
  return `Candidate "${selectedSandboxName}" is ready for review. Next step: validate the impact, record editorial context, and confirm the promotion.`;
};

export const buildPreflightStatusMessage = ({
  blockers = 0,
  warnings = 0,
  ready = 0
}) => {
  if (blockers > 0) {
    return `Export currently blocked · ${blockers} blocker(s) · ${warnings} warning(s).`;
  }
  if (warnings > 0) {
    return `Ready with alerts · ${warnings} warning(s) before the closure export.`;
  }
  return `Ready to generate closure export · ${ready} positive signal(s) in the final preflight.`;
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
  const suffix = `blockers=${blockers} · warnings=${warnings}`;
  if (!filename) return `Closure summary generated (${suffix})`;
  return `Closure summary generated: ${filename} (${suffix})`;
};
