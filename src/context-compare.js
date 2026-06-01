const toStringValue = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const normalizeLine = (line) => line.replace(/\s+/g, ' ').trim();
const PROMPT_SECTION_PATTERN = /prompt|briefing/i;
const CONTINUITY_SECTION_PATTERN = /continuidade|continuity/i;

export const buildLineDiff = (beforeText = '', afterText = '') => {
  const beforeLines = toStringValue(beforeText).split(/\r?\n/).map((line) => line.trimEnd());
  const afterLines = toStringValue(afterText).split(/\r?\n/).map((line) => line.trimEnd());

  const rows = [];
  let i = 0;
  let j = 0;

  while (i < beforeLines.length || j < afterLines.length) {
    const before = i < beforeLines.length ? beforeLines[i] : null;
    const after = j < afterLines.length ? afterLines[j] : null;

    if (before === after && before !== null) {
      rows.push({ type: 'equal', text: before });
      i += 1;
      j += 1;
      continue;
    }

    const nextBefore = i + 1 < beforeLines.length ? beforeLines[i + 1] : null;
    const nextAfter = j + 1 < afterLines.length ? afterLines[j + 1] : null;

    if (before !== null && nextBefore === after) {
      rows.push({ type: 'removed', text: before });
      i += 1;
      continue;
    }

    if (after !== null && before === nextAfter) {
      rows.push({ type: 'added', text: after });
      j += 1;
      continue;
    }

    if (before !== null) {
      rows.push({ type: 'removed', text: before });
      i += 1;
    }
    if (after !== null) {
      rows.push({ type: 'added', text: after });
      j += 1;
    }
  }

  const added = rows.filter((row) => row.type === 'added').length;
  const removed = rows.filter((row) => row.type === 'removed').length;
  return { rows, stats: { added, removed, changed: added + removed } };
};

export const buildMetadataDiff = (before = {}, after = {}) => {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].sort();
  const rows = keys.map((key) => {
    const previous = toStringValue(before?.[key]).trim();
    const next = toStringValue(after?.[key]).trim();
    let type = 'equal';
    if (previous && !next) type = 'removed';
    else if (!previous && next) type = 'added';
    else if (normalizeLine(previous) !== normalizeLine(next)) type = 'changed';
    return { key, type, before: previous, after: next };
  });

  return {
    rows,
    changed: rows.filter((row) => row.type === 'changed').length,
    added: rows.filter((row) => row.type === 'added').length,
    removed: rows.filter((row) => row.type === 'removed').length,
    unchanged: rows.filter((row) => row.type === 'equal').length
  };
};

export const buildDiffSummary = ({ metadataDiff, sectionDiffs }) => {
  const changedSections = (sectionDiffs || []).filter((section) => section.diff.stats.changed > 0).length;
  const textOps = (sectionDiffs || []).reduce((acc, section) => acc + section.diff.stats.changed, 0);
  return {
    changedSections,
    textOps,
    metadataChanged: metadataDiff?.changed || 0,
    metadataAdded: metadataDiff?.added || 0,
    metadataRemoved: metadataDiff?.removed || 0
  };
};

export const buildSemanticHighlights = ({ metadataDiff, sectionDiffs }) => {
  const keys = new Set((metadataDiff?.rows || []).filter((row) => row.type !== 'equal').map((row) => row.key));
  const sectionLabels = new Set((sectionDiffs || []).filter((section) => section.diff.stats.changed > 0).map((section) => section.label));
  const highlights = [];

  if (keys.has('reviewStatus') || keys.has('resultingStatus') || keys.has('isCanonical')) {
    highlights.push('Relevant editorial/canonical change.');
  }
  if (keys.has('sceneId') || keys.has('chapterId') || keys.has('beatId') || keys.has('characterId') || keys.has('targetId')) {
    highlights.push('Narrative context/scope changed.');
  }
  if (keys.has('score') || keys.has('status') || keys.has('readiness')) {
    highlights.push('Production readiness signal changed.');
  }
  if ([...sectionLabels].some((label) => PROMPT_SECTION_PATTERN.test(label))) {
    highlights.push('Prompt/brief changed semantically.');
  }
  if ([...sectionLabels].some((label) => CONTINUITY_SECTION_PATTERN.test(label))) {
    highlights.push('Continuity risks should be reviewed.');
  }

  if (!highlights.length && ((metadataDiff?.changed || 0) > 0 || (metadataDiff?.added || 0) > 0 || (metadataDiff?.removed || 0) > 0)) {
    highlights.push('Metadata changed with potential pipeline impact.');
  }

  return highlights;
};
