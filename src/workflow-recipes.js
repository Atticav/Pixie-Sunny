/**
 * Workflow Recipes / Guided Playbooks
 *
 * Provides a small, extensible set of step-by-step guided playbooks that walk
 * the user through common high-value workflows in the studio.  Each recipe is
 * self-contained and references existing app surfaces via scrollTarget /
 * quickAction anchors so integration is purely additive and requires no
 * changes to existing modules.
 *
 * MVP recipes:
 *   1. nova-cena     – Create a new scene from scratch
 *   2. review-inbox  – Review Inbox resolution flow
 *   3. pre-export    – Pre-export readiness flow
 *   4. sandbox-closure – Guided operational handoff from sandbox to closure export
 *
 * Future recipes can be added to WORKFLOW_RECIPES without touching any
 * other file.
 */

/** Step status values */
export const STEP_STATUSES = ['pending', 'current', 'done', 'skipped'];

/** Recipe status values derived from step states */
export const RECIPE_STATUSES = ['not_started', 'in_progress', 'complete'];

/**
 * Each recipe step shape:
 * {
 *   id: string,
 *   label: string,
 *   rationale: string,
 *   scrollTarget?: string,   // CSS selector to scroll to (optional)
 *   quickAction?: string     // action key handled in app.js (optional)
 * }
 */

/** Canonical list of starter playbooks. */
export const WORKFLOW_RECIPES = [
  {
    id: 'nova-cena',
    title: 'Create a new scene from scratch',
    description:
      'Complete guide to start a new scene: structure, characters, shots, and image generation.',
    steps: [
      {
        id: 'nova-cena-1',
        label: 'Select or create a project',
        rationale:
          'All content needs a parent project. Make sure the correct project is selected before continuing.',
        scrollTarget: 'section:has(#projectSelect)',
        quickAction: 'scroll-project'
      },
      {
        id: 'nova-cena-2',
        label: 'Create or confirm the main character',
        rationale:
          'A scene is stronger when linked to a character with defined canonical traits.',
        scrollTarget: 'section:has(#characterSelect)',
        quickAction: 'scroll-characters'
      },
      {
        id: 'nova-cena-3',
        label: 'Add relevant lore entries',
        rationale:
          'World rules and lore notes help the prompt generator maintain consistency.',
        scrollTarget: 'section:has(#loreSelect)',
        quickAction: 'scroll-lore'
      },
      {
        id: 'nova-cena-4',
        label: 'Create the scene and fill in the brief',
        rationale:
          'Define the scene’s location, narrative objective, and visual tone.',
        scrollTarget: 'section:has(#sceneSelect)',
        quickAction: 'scroll-scenes'
      },
      {
        id: 'nova-cena-5',
        label: 'Plan shots in Shot Planner',
        rationale:
          'Break the scene into planned shots with visual direction, continuity, and references.',
        scrollTarget: '.sp-section',
        quickAction: 'open-shot-planner'
      },
      {
        id: 'nova-cena-6',
        label: 'Generate images in Generation Studio',
        rationale:
          'Generate image outputs locally for each planned shot.',
        quickAction: 'open-image-gen'
      },
      {
        id: 'nova-cena-7',
        label: 'Review and canonize outputs in Image Review',
        rationale:
          'Select the best outputs, mark them as canon, and resolve continuity conflicts.',
        quickAction: 'open-image-review'
      }
    ]
  },
  {
    id: 'review-inbox',
    title: 'Review Inbox resolution flow',
    description:
      'Step-by-step flow to triage, prioritize, and resolve pending items in the review inbox.',
    steps: [
      {
        id: 'review-inbox-1',
        label: 'Open Review Inbox and check pending items',
        rationale:
          'The inbox consolidates conflicts, risks, and stale items that need human decisions.',
        scrollTarget: '.ri-section',
        quickAction: 'scroll-review-inbox'
      },
      {
        id: 'review-inbox-2',
        label: 'Filter by high priority',
        rationale:
          'Focus first on critical-risk items to avoid pipeline bottlenecks.',
        scrollTarget: '.ri-section',
        quickAction: 'scroll-review-inbox'
      },
      {
        id: 'review-inbox-3',
        label: 'Inspect each item and make a decision',
        rationale:
          'Approve, reject, defer, or mark for refresh. Each decision is recorded in history.',
        scrollTarget: '.ri-section',
        quickAction: 'scroll-review-inbox'
      },
      {
        id: 'review-inbox-4',
        label: 'Resolve diff / compare-context items',
        rationale:
          'Open Diff Viewer for items with context conflicts and validate the differences.',
        scrollTarget: '.dv-section',
        quickAction: 'scroll-diff-viewer'
      },
      {
        id: 'review-inbox-5',
        label: 'Check project readiness in the dashboard',
        rationale:
          'After resolution, confirm that the readiness score improved in the Production Readiness Dashboard.',
        scrollTarget: '.ap-section',
        quickAction: 'scroll-assistive'
      }
    ]
  },
  {
    id: 'pre-export',
    title: 'Pre-export readiness flow',
    description:
      'Guided checklist to ensure the project is ready before generating the export package.',
    steps: [
      {
        id: 'pre-export-1',
        label: 'Check Production Readiness via Assistive Planning',
        rationale:
          'The Assistive Planning panel shows the readiness score and blockers identified by scene/sequence.',
        scrollTarget: '.ap-section',
        quickAction: 'scroll-assistive'
      },
      {
        id: 'pre-export-2',
        label: 'Resolve blocked items in Review Inbox',
        rationale:
          'Every item with status "blocked" or high priority must be resolved before export.',
        scrollTarget: '.ri-section',
        quickAction: 'scroll-review-inbox'
      },
      {
        id: 'pre-export-3',
        label: 'Confirm that canonical outputs are marked',
        rationale:
          'Review the image gallery and ensure each scene has at least one canonical output.',
        quickAction: 'open-image-review'
      },
      {
        id: 'pre-export-4',
        label: 'Review asset lineage and supersession',
        rationale:
          'Check the lineage graph to ensure no superseded asset is still marked as canon.',
        scrollTarget: '.irs-section',
        quickAction: 'open-image-review'
      },
      {
        id: 'pre-export-5',
        label: 'Export project JSON package',
        rationale:
          'Generate the full JSON export as the final snapshot before handoff or publication.',
        quickAction: 'export-json'
      }
    ]
  },
  {
    id: 'sandbox-closure',
    title: 'From sandbox to final closure',
    description:
      'Operational playbook to review a hypothesis, promote the decision, and close the final package with traceability.',
    steps: [
      {
        id: 'sandbox-closure-1',
        label: 'Review the candidate sandbox',
        rationale:
          'Start with Scenario Sandbox to validate purpose, status, and snapshot before comparing with the main workspace.',
        scrollTarget: '.sb-section',
        quickAction: 'scroll-sandbox'
      },
      {
        id: 'sandbox-closure-2',
        label: 'Compare context in Diff Viewer',
        rationale:
          'Use Diff Viewer / Context Compare to understand relevant differences and reduce ambiguity before promotion.',
        scrollTarget: '.dv-section',
        quickAction: 'scroll-diff-viewer'
      },
      {
        id: 'sandbox-closure-3',
        label: 'Confirm Promote / Merge / Commit',
        rationale:
          'Review the summarized impact, record notes, and confirm promotion of the chosen candidate.',
        scrollTarget: '.pm-section',
        quickAction: 'scroll-promote'
      },
      {
        id: 'sandbox-closure-4',
        label: 'Save a Workspace Checkpoint',
        rationale:
          'Create a checkpoint before closure to record the approved operational state.',
        scrollTarget: '.sc-section',
        quickAction: 'scroll-checkpoints'
      },
      {
        id: 'sandbox-closure-5',
        label: 'Resolve Review Inbox and validate readiness',
        rationale:
          'Clear pending blockers and confirm the Production Readiness Dashboard before final export.',
        scrollTarget: '.ri-section',
        quickAction: 'scroll-review-inbox'
      },
      {
        id: 'sandbox-closure-6',
        label: 'Generate Export / Delivery / Production Closure',
        rationale:
          'Finalize the handoff by generating the structured closure summary with the required package sections.',
        scrollTarget: '.pc-section',
        quickAction: 'scroll-closure'
      }
    ]
  }
];

/**
 * Returns a recipe by id, or null if not found.
 * @param {string} id
 * @returns {object|null}
 */
export const getRecipeById = (id) => WORKFLOW_RECIPES.find((r) => r.id === id) || null;

/**
 * Normalizes a single step-progress entry from persisted state.
 * Ensures unknown statuses fall back to 'pending'.
 * @param {object} raw
 * @returns {{ stepId: string, status: string }}
 */
const normalizeStepProgress = (raw) => ({
  stepId: typeof raw?.stepId === 'string' ? raw.stepId : '',
  status: STEP_STATUSES.includes(raw?.status) ? raw.status : 'pending'
});

/**
 * Derives the per-step display state for a recipe given stored progress.
 *
 * Rules:
 *   - If a step has an explicit entry in stepProgress, use that status.
 *   - Otherwise all steps before the first non-done step are 'done', the
 *     first non-done step is 'current', and the rest are 'pending'.
 *   - If all steps are done the recipe is 'complete'.
 *
 * @param {object} recipe         - a WORKFLOW_RECIPES entry
 * @param {object[]} stepProgress - array of { stepId, status } from stored state
 * @returns {{ steps: Array<{ id, label, rationale, scrollTarget, quickAction, status }>, recipeStatus: string }}
 */
export const buildRecipeProgress = (recipe, stepProgress = []) => {
  if (!recipe || !Array.isArray(recipe.steps)) {
    return { steps: [], recipeStatus: 'not_started' };
  }

  const progressMap = new Map(
    stepProgress
      .map(normalizeStepProgress)
      .filter((p) => p.stepId)
      .map((p) => [p.stepId, p.status])
  );

  let foundCurrent = false;
  const steps = recipe.steps.map((step) => {
    const stored = progressMap.get(step.id);
    let status;
    if (stored) {
      status = stored;
    } else if (foundCurrent) {
      status = 'pending';
    } else {
      status = 'current';
      foundCurrent = true;
    }
    return { ...step, status };
  });

  const allDone = steps.every((s) => s.status === 'done' || s.status === 'skipped');
  const anyProgress = steps.some((s) => s.status === 'done' || s.status === 'current');
  const recipeStatus = allDone ? 'complete' : anyProgress ? 'in_progress' : 'not_started';

  return { steps, recipeStatus };
};

/**
 * Advances one step in a recipe: marks the step as done, returns updated
 * stepProgress array.
 *
 * @param {string}   recipeId
 * @param {string}   stepId
 * @param {object[]} stepProgress  current stored progress array
 * @returns {object[]} updated stepProgress array
 */
export const markStepDone = (recipeId, stepId, stepProgress = []) => {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return stepProgress;
  const stepExists = recipe.steps.some((s) => s.id === stepId);
  if (!stepExists) return stepProgress;

  const existing = stepProgress.filter((p) => p.stepId !== stepId);
  return [...existing, { stepId, status: 'done' }];
};

/**
 * Resets all step progress for a given recipe.
 *
 * @param {string}   recipeId
 * @param {object[]} stepProgress  current stored progress array
 * @returns {object[]} updated stepProgress array (recipe steps removed)
 */
export const resetRecipeProgress = (recipeId, stepProgress = []) => {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return stepProgress;
  const stepIds = new Set(recipe.steps.map((s) => s.id));
  return stepProgress.filter((p) => !stepIds.has(p.stepId));
};

/**
 * Returns a summary object for all recipes given current step progress.
 *
 * @param {object[]} stepProgress
 * @returns {Array<{ id, title, recipeStatus, completedSteps, totalSteps }>}
 */
export const buildRecipesSummary = (stepProgress = []) =>
  WORKFLOW_RECIPES.map((recipe) => {
    const { steps, recipeStatus } = buildRecipeProgress(recipe, stepProgress);
    const completedSteps = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
    return {
      id: recipe.id,
      title: recipe.title,
      recipeStatus,
      completedSteps,
      totalSteps: recipe.steps.length
    };
  });
